const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');
const { HttpError } = require('../utils/money');

const router = express.Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.post('/register', limiter, async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email || !password) {
    throw new HttpError(400, 'Nombre completo, correo y contraseña son obligatorios');
  }
  if (String(password).length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');

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
