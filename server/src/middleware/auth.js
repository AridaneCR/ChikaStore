const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, v: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Necesitas iniciar sesión' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.t) return res.status(401).json({ error: 'Sesión no válida' }); // códigos temporales (login social), no sesiones
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ error: 'Sesión no válida' });
    // Tras cambiar la contraseña, las sesiones anteriores dejan de valer
    if ((payload.v || 0) !== (user.tokenVersion || 0)) return res.status(401).json({ error: 'Sesión caducada, vuelve a entrar' });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión caducada, vuelve a entrar' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo para el administrador' });
  return next();
}

module.exports = { signToken, requireAuth, requireAdmin };
