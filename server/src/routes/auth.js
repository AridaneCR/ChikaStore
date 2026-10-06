const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');
const { normalizeDni } = require('../utils/dni');
const { HttpError } = require('../utils/money');

const router = express.Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.post('/register', limiter, async (req, res) => {
  const { fullName, dni, email, password } = req.body || {};
  if (!fullName || !dni || !email || !password) {
    throw new HttpError(400, 'Nombre completo, DNI, correo y contraseña son obligatorios');
  }
  if (String(password).length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');

  const hash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ fullName, dni, email, password: hash });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

// Se puede entrar con el correo o con el DNI
router.post('/login', limiter, async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) throw new HttpError(400, 'Introduce tu correo o DNI y la contraseña');

  const id = String(identifier).trim();
  const query = id.includes('@') ? { email: id.toLowerCase() } : { dni: normalizeDni(id) };
  const user = await User.findOne(query).select('+password');

  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    throw new HttpError(401, 'Credenciales incorrectas');
  }
  if (!user.active) throw new HttpError(403, 'Tu cuenta está desactivada');

  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
