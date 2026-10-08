const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');
const { HttpError } = require('../utils/money');
const mailer = require('../utils/mailer');
const { allowedOrigins, pickClientOrigin } = require('../utils/origins');

const router = express.Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
// Más estricto para no poder usar la web para mandar correos en bucle
const mailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Prueba dentro de unos minutos.' } });

const RESET_TTL_MS = 60 * 60 * 1000; // el enlace de recuperación caduca en 1 hora
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const checkPassword = (password) => {
  if (String(password || '').length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
};

router.post('/register', limiter, async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email || !password) {
    throw new HttpError(400, 'Nombre completo, correo y contraseña son obligatorios');
  }
  checkPassword(password);

  const hash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ fullName, email, password: hash });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

// Se entra con el correo electrónico
router.post('/login', limiter, async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) throw new HttpError(400, 'Introduce tu correo y la contraseña');

  const email = String(identifier).trim().toLowerCase();
  const user = await User.findOne({ email }).select('+password');

  // Las cuentas creadas con Google/Discord no tienen contraseña hasta que la crean
  if (!user || !user.password || !(await bcrypt.compare(String(password), user.password))) {
    throw new HttpError(401, 'Credenciales incorrectas');
  }
  if (!user.active) throw new HttpError(403, 'Tu cuenta está desactivada');

  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

/* ======================== RECUPERAR CONTRASEÑA ======================== */

// { email } → si existe la cuenta, envía un enlace. La respuesta es siempre la misma
// para no revelar qué correos están registrados.
router.post('/forgot', mailLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) throw new HttpError(400, 'Introduce tu correo electrónico');

  const user = await User.findOne({ email });
  if (user && user.active) {
    const token = crypto.randomBytes(32).toString('base64url');
    await User.updateOne(
      { _id: user._id },
      { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + RESET_TTL_MS) }
    );
    const origin = pickClientOrigin(process.env.APP_URL || req.get('origin'));
    const link = `${origin}/#/restablecer?token=${token}`;
    const mail = mailer.resetPasswordEmail({ name: user.fullName, link });
    // Sin esperar: la respuesta tarda lo mismo exista o no la cuenta
    Promise.resolve()
      .then(() => mailer.sendMail({ to: user.email, name: user.fullName, ...mail }))
      .catch((err) => console.error('✉️  Error enviando el correo de recuperación:', err.message));
  }
  res.json({ ok: true });
});

// { token, password } → cambia la contraseña, cierra las sesiones anteriores y entra
router.post('/reset', limiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) throw new HttpError(400, 'Falta el enlace de recuperación');
  checkPassword(password);

  const user = await User.findOneAndUpdate(
    { resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } },
    {
      $set: { password: await bcrypt.hash(String(password), 10) },
      $unset: { resetTokenHash: '', resetTokenExpires: '' },
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );
  if (!user) throw new HttpError(400, 'El enlace no es válido o ha caducado. Pide uno nuevo.');
  if (!user.active) throw new HttpError(403, 'Tu cuenta está desactivada');

  res.json({ token: signToken(user), user: user.toPublic() });
});

/* ============================ LOGIN SOCIAL ============================ */

const discordReady = () => Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);

// Qué botones mostrar (así no hace falta recompilar el frontend al activarlos)
router.get('/providers', (req, res) => {
  res.json({ google: process.env.GOOGLE_CLIENT_ID || null, discord: discordReady() });
});

// Busca la cuenta vinculada; si no hay, la une por correo (verificado por Google/Discord) o la crea
async function socialUser(provider, providerId, email, name) {
  const field = `${provider}Id`;
  let user = await User.findOne({ [field]: providerId });
  if (!user) {
    const mail = String(email).toLowerCase();
    user = await User.findOne({ email: mail });
    if (user) {
      if (user[field] && user[field] !== providerId) throw new HttpError(409, 'Esta cuenta ya está vinculada a otro usuario');
      user[field] = providerId;
      await user.save();
    } else {
      user = await User.create({ fullName: String(name || mail.split('@')[0]).slice(0, 120), email: mail, [field]: providerId });
    }
  }
  if (!user.active) throw new HttpError(403, 'Tu cuenta está desactivada');
  return user;
}

// Google: el navegador obtiene un "ID token" con el botón de Google y lo envía aquí
router.post('/google', limiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(404, 'El acceso con Google no está activado');
  const credential = String(req.body?.credential || '');
  if (!credential) throw new HttpError(400, 'Falta la credencial de Google');

  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const info = r.ok ? await r.json() : null;
  const valid = info
    && info.aud === clientId
    && ['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)
    && Number(info.exp) * 1000 > Date.now()
    && (info.email_verified === true || info.email_verified === 'true')
    && info.email && info.sub;
  if (!valid) throw new HttpError(401, 'No se pudo verificar tu cuenta de Google');

  const user = await socialUser('google', String(info.sub), info.email, info.name);
  res.json({ token: signToken(user), user: user.toPublic() });
});

// Discord: flujo OAuth con redirecciones. El navegador va a /discord → Discord → /discord/callback
// → vuelve a la web con un código de un solo uso que se cambia por la sesión en /social/exchange.
const STATE_COOKIE = 'ck_oauth';

const discordRedirectUri = (req) =>
  process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/discord/callback`;

const readCookie = (req, name) => {
  const pair = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
};

const cookieOpts = (req) => ({ httpOnly: true, secure: req.secure, sameSite: 'lax', path: '/api/auth/discord' });

router.get('/discord', limiter, (req, res) => {
  if (!discordReady()) throw new HttpError(404, 'El acceso con Discord no está activado');
  const origin = pickClientOrigin(req.query.from);
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = jwt.sign({ o: origin, n: nonce }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.cookie(STATE_COOKIE, nonce, { ...cookieOpts(req), maxAge: 10 * 60 * 1000 });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.DISCORD_CLIENT_ID,
    scope: 'identify email',
    redirect_uri: discordRedirectUri(req),
    state,
    prompt: 'none',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
  let origin = allowedOrigins()[0];
  const back = (path) => res.redirect(`${origin}/#${path}`);
  const fail = (msg) => back(`/login?error=${encodeURIComponent(msg)}`);

  let state;
  try {
    state = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    origin = pickClientOrigin(state.o);
  } catch {
    return fail('El inicio de sesión con Discord ha caducado. Inténtalo otra vez.');
  }
  const nonce = readCookie(req, STATE_COOKIE);
  res.clearCookie(STATE_COOKIE, cookieOpts(req));
  if (!nonce || nonce !== state.n) return fail('No se pudo verificar el inicio de sesión. Inténtalo otra vez.');
  if (req.query.error || !req.query.code) return fail('Has cancelado el inicio de sesión con Discord.');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(req.query.code),
        redirect_uri: discordRedirectUri(req),
      }),
    });
    if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
    const { access_token: accessToken } = await tokenRes.json();

    const meRes = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${accessToken}` } });
    if (!meRes.ok) throw new Error(`users/@me ${meRes.status}`);
    const me = await meRes.json();
    if (!me.email || !me.verified) return fail('Tu cuenta de Discord no tiene un correo verificado.');

    const user = await socialUser('discord', String(me.id), me.email, me.global_name || me.username);
    const code = jwt.sign({ sub: String(user._id), t: 'social', j: crypto.randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '2m' });
    return back(`/social?code=${encodeURIComponent(code)}`);
  } catch (err) {
    if (err.status) return fail(err.message);
    console.error('Discord OAuth:', err.message);
    return fail('No se pudo iniciar sesión con Discord. Inténtalo otra vez.');
  }
});

// Cambia el código de un solo uso de /discord/callback por la sesión
const usedCodes = new Map(); // j → caducidad
router.post('/social/exchange', limiter, async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(String(req.body?.code || ''), process.env.JWT_SECRET);
  } catch {
    throw new HttpError(400, 'El inicio de sesión ha caducado. Inténtalo otra vez.');
  }
  const now = Date.now();
  for (const [j, exp] of usedCodes) if (exp < now) usedCodes.delete(j);
  if (payload.t !== 'social' || usedCodes.has(payload.j)) throw new HttpError(400, 'El inicio de sesión ha caducado. Inténtalo otra vez.');
  usedCodes.set(payload.j, payload.exp * 1000);

  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw new HttpError(403, 'Tu cuenta está desactivada');
  res.json({ token: signToken(user), user: user.toPublic() });
});

module.exports = router;
