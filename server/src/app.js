const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

function createApp() {
  const app = express();

  // En Render (y casi cualquier hosting) la app va detrás de un proxy: así Express ve la IP
  // real del cliente y el límite de intentos de login no se comparte entre todos los usuarios.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  // Orígenes permitidos (CLIENT_URL, separados por comas). Se ignoran espacios y la "/" final,
  // porque el navegador envía el origen sin barra: "https://chikastore.onrender.com".
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'test') console.log('🌐 CORS permitido para:', origins.join(', '));
  app.use(helmet());
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, name: 'CHIKASTORE' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Manejador de errores central (Express 5 captura los errores de funciones async)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join('. ') });
    }
    if (err.name === 'CastError') return res.status(400).json({ error: 'Dato no válido' });
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      if (field === 'barcode') return res.status(409).json({ error: 'Ya hay otro producto con ese código de barras' });
      const names = { email: 'correo electrónico', dni: 'DNI' };
      return res.status(409).json({ error: `Ya existe una cuenta con ese ${names[field] || field}` });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { createApp };
