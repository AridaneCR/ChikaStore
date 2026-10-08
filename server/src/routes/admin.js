const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Movement = require('../models/Movement');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { changeStatus, updateItems } = require('../services/orderService');
const { HttpError } = require('../utils/money');
const { randomInternalEan13 } = require('../utils/barcode');
const { importProducts } = require('../services/productImport');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Id no válido' });
  return next();
});

const TZ = process.env.STORE_TZ || 'Europe/Madrid';
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const intOrUndef = (v) => (v === undefined || v === '' ? undefined : Number(v));

/* =============================== PRODUCTOS =============================== */

function productPayload(body) {
  const data = {};
  for (const k of ['name', 'description', 'category', 'imageUrl', 'active']) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  // Código de barras: '' o null lo quita
  if (body.barcode !== undefined) data.barcode = body.barcode === '' || body.barcode === null ? undefined : body.barcode;
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => !Product.TAGS.includes(t))) {
      throw new HttpError(400, 'Etiquetas no válidas');
    }
    data.tags = [...new Set(body.tags)];
  }
  for (const k of ['priceEurCents', 'priceCoins']) {
    if (body[k] !== undefined) {
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `${k} debe ser un entero ≥ 0`);
      data[k] = n;
    }
  }
  if (body.stock !== undefined) {
    if (body.stock === null || body.stock === '') data.stock = null;
    else {
      const n = Number(body.stock);
      if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'El stock debe ser un entero ≥ 0');
      data.stock = n;
    }
  }
  return data;
}

router.get('/products', async (req, res) => {
  const { q, category, active } = req.query;
  const filter = {};
  if (q) {
    const term = String(q).trim();
    filter.$or = [{ name: { $regex: escapeRegex(term), $options: 'i' } }, { barcode: term.toUpperCase() }];
  }
  if (category) filter.category = category;
  if (active === 'true' || active === 'false') filter.active = active === 'true';
  res.json(await Product.find(filter).sort({ name: 1 }).lean());
});

router.post('/products', async (req, res) => {
  const product = await Product.create(productPayload(req.body || {}));
  res.status(201).json(product);
});

// Genera un EAN-13 interno que no use ningún otro producto
async function freeInternalBarcode() {
  for (let i = 0; i < 20; i += 1) {
    const code = randomInternalEan13();
    // eslint-disable-next-line no-await-in-loop
    if (!(await Product.exists({ barcode: code }))) return code;
  }
  throw new HttpError(503, 'No se pudo generar un código, inténtalo de nuevo');
}

// Importación masiva desde Excel/CSV: { rows: [{ columna: valor }], dryRun: true|false }
router.post('/products/import', async (req, res) => {
  const { rows, dryRun = true } = req.body || {};
  res.json(await importProducts(rows, { dryRun: dryRun !== false }));
});

router.post('/products/barcode/generate', async (req, res) => {
  res.json({ barcode: await freeInternalBarcode() });
});

// Asigna un código interno a todos los productos que no tengan
router.post('/products/barcode/fill', async (req, res) => {
  const missing = await Product.find({ barcode: { $exists: false } }, { _id: 1 }).lean();
  let filled = 0;
  for (const p of missing) {
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: p._id, barcode: { $exists: false } }, { $set: { barcode: await freeInternalBarcode() } });
    filled += 1;
  }
  res.json({ filled });
});

router.patch('/products/:id', async (req, res) => {
  const payload = productPayload(req.body || {});
  const update = { ...payload };
  if ('barcode' in payload && payload.barcode === undefined) {
    delete update.barcode;
    update.$unset = { barcode: 1 };
  }
  const product = await Product.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!product) throw new HttpError(404, 'Producto no encontrado');
  res.json(product);
});

// No se borra físicamente (los pedidos antiguos lo referencian): se desactiva
router.delete('/products/:id', async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!product) throw new HttpError(404, 'Producto no encontrado');
  res.json(product);
});

// Subida de imagen a Cloudinary (opcional; si no está configurado, usa una URL de imagen)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new HttpError(501, 'Cloudinary no está configurado: pega una URL de imagen');
  }
  if (!req.file) throw new HttpError(400, 'No se recibió ninguna imagen');
  const { v2: cloudinary } = require('cloudinary'); // eslint-disable-line global-require
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'chikastore' }, (err, r) => (err ? reject(err) : resolve(r)))
      .end(req.file.buffer);
  });
  res.json({ url: result.secure_url });
});

/* ================================ PEDIDOS ================================ */

router.get('/orders', async (req, res) => {
  const { status, currency, q, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (currency) filter.currency = currency;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999`);
  }
  if (q) {
    const term = String(q).trim();
    const users = await User.find(
      { $or: [{ fullName: { $regex: escapeRegex(term), $options: 'i' } }, { email: { $regex: escapeRegex(term), $options: 'i' } }] },
      { _id: 1 }
    ).lean();
    const or = [{ code: { $regex: escapeRegex(term) } }, { user: { $in: users.map((u) => u._id) } }];
    if (/^\d+$/.test(term)) or.push({ orderNumber: Number(term) });
    filter.$or = or;
  }
  const lim = Math.min(Number(limit) || 50, 200);
  const pg = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim)
      .populate('user', 'fullName email')
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ items, total, page: pg, pages: Math.ceil(total / lim) || 1 });
});

router.get('/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'fullName email').lean();
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  res.json(order);
});

// { status?, adminNote?, items?: [{ productId, quantity }] }
router.patch('/orders/:id', async (req, res) => {
  const { status, adminNote, items } = req.body || {};
  if (items) await updateItems(req.params.id, items);
  if (status) await changeStatus(req.params.id, status, req.user._id);
  if (adminNote !== undefined) await Order.updateOne({ _id: req.params.id }, { adminNote: String(adminNote) });
  const order = await Order.findById(req.params.id).populate('user', 'fullName email').lean();
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  res.json(order);
});

/* ================================ USUARIOS =============================== */

router.get('/users', async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    const t = escapeRegex(String(q).trim());
    filter.$or = [
      { fullName: { $regex: t, $options: 'i' } },
      { email: { $regex: t, $options: 'i' } },
    ];
  }
  const users = await User.find(filter).sort({ fullName: 1 }).limit(500);
  res.json(users.map((u) => u.toPublic()));
});

router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  const [orders, movements] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    Movement.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  res.json({ user: user.toPublic(), orders, movements });
});

// Crear usuario desde el panel: { fullName, email, password, role?, balanceEurCents?, balanceCoins? }
// El admin pone la contraseña inicial; después solo la cambia el propio usuario.
router.post('/users', async (req, res) => {
  const { fullName, email, password, role = 'user', note } = req.body || {};
  if (!fullName || !email || !password) {
    throw new HttpError(400, 'Nombre completo, correo y contraseña son obligatorios');
  }
  if (String(password).length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  if (!['user', 'admin'].includes(role)) throw new HttpError(400, 'Rol no válido');

  const balances = {};
  for (const field of ['balanceEurCents', 'balanceCoins']) {
    const v = intOrUndef(req.body[field]);
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0) throw new HttpError(400, 'El saldo inicial debe ser un entero ≥ 0');
    balances[field] = v;
  }

  const user = await User.create({
    fullName,
    email,
    role,
    password: await bcrypt.hash(String(password), 10),
    ...balances,
  });

  const movements = [];
  if (balances.balanceEurCents) movements.push({ user: user._id, currency: 'EUR', amount: balances.balanceEurCents, type: 'recarga', by: req.user._id, note: note || 'Saldo inicial' });
  if (balances.balanceCoins) movements.push({ user: user._id, currency: 'COINS', amount: balances.balanceCoins, type: 'ajuste', by: req.user._id, note: note || 'Saldo inicial' });
  if (movements.length) await Movement.insertMany(movements);

  res.status(201).json(user.toPublic());
});

// Edita cualquier dato del usuario MENOS la contraseña
router.patch('/users/:id', async (req, res) => {
  const body = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');

  for (const k of ['fullName', 'email', 'role', 'active']) {
    if (body[k] !== undefined) user[k] = body[k];
  }
  if (String(user._id) === String(req.user._id) && (user.role !== 'admin' || user.active === false)) {
    throw new HttpError(400, 'No puedes quitarte el rol de admin ni desactivarte a ti mismo');
  }

  const movements = [];
  for (const [field, currency] of [['balanceEurCents', 'EUR'], ['balanceCoins', 'COINS']]) {
    const v = intOrUndef(body[field]);
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0) throw new HttpError(400, 'El saldo debe ser un entero ≥ 0');
    const diff = v - user[field];
    if (diff !== 0) {
      movements.push({ user: user._id, currency, amount: diff, type: 'ajuste', by: req.user._id, note: body.note || 'Ajuste manual' });
      user[field] = v;
    }
  }

  await user.save();
  if (movements.length) await Movement.insertMany(movements);
  res.json(user.toPublic());
});

// Recarga de saldo: { currency: 'EUR'|'COINS', amount (céntimos o coins, puede ser negativo), note }
router.post('/users/:id/topup', async (req, res) => {
  const { currency, note } = req.body || {};
  const amount = Number(req.body?.amount);
  if (!['EUR', 'COINS'].includes(currency)) throw new HttpError(400, 'Moneda no válida');
  if (!Number.isInteger(amount) || amount === 0) throw new HttpError(400, 'Cantidad no válida');

  const field = currency === 'EUR' ? 'balanceEurCents' : 'balanceCoins';
  const cond = amount < 0 ? { [field]: { $gte: -amount } } : {};
  const user = await User.findOneAndUpdate({ _id: req.params.id, ...cond }, { $inc: { [field]: amount } }, { new: true });
  if (!user) throw new HttpError(400, 'Usuario no encontrado o saldo insuficiente');

  await Movement.create({
    user: user._id, currency, amount, type: amount > 0 ? 'recarga' : 'ajuste', by: req.user._id, note: note || '',
  });
  res.json(user.toPublic());
});

/* ============================== ESTADÍSTICAS ============================= */

const PAID = ['pagado', 'entregado'];
const FORMATS = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };

// Resumen del panel: tarjetas + gráfico para el periodo elegido
//   day   → tarjetas de HOY y gráfico de los últimos 14 días
//   month → tarjetas del MES actual y gráfico por semanas (Sem 1…5)
//   year  → tarjetas del AÑO actual y gráfico por meses
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

router.get('/overview', async (req, res) => {
  const period = ['day', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const prefix = { day: today, month: today.slice(0, 7), year: today.slice(0, 4) }[period];

  // Claves del gráfico
  let keys;
  let labels;
  if (period === 'day') {
    keys = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    labels = keys.map((k) => `${k.slice(8)}/${k.slice(5, 7)}`);
  } else if (period === 'month') {
    const [y, m] = today.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    keys = Array.from({ length: Math.ceil(days / 7) }, (_, i) => String(i + 1));
    labels = keys.map((k) => `Sem ${k}`);
  } else {
    keys = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    labels = MONTHS;
  }

  const since = new Date(Date.now() - 400 * 864e5);
  const dateStr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

  const [paid] = await Order.aggregate([
    { $match: { status: { $in: PAID }, paidAt: { $gte: since } } },
    { $addFields: { d: dateStr('$paidAt') } },
    {
      $facet: {
        scope: [
          { $match: { d: { $regex: `^${prefix}` } } },
          {
            $group: {
              _id: null,
              eurCents: { $sum: { $cond: [{ $eq: ['$currency', 'EUR'] }, '$total', 0] } },
              coins: { $sum: { $cond: [{ $eq: ['$currency', 'COINS'] }, '$total', 0] } },
            },
          },
        ],
        series: [
          { $match: { currency: 'EUR', d: period === 'day' ? { $gte: keys[0] } : { $regex: `^${prefix}` } } },
          {
            $group: {
              _id:
                period === 'day'
                  ? '$d'
                  : period === 'month'
                    ? { $toString: { $ceil: { $divide: [{ $toInt: { $substrBytes: ['$d', 8, 2] } }, 7] } } }
                    : { $substrBytes: ['$d', 5, 2] },
              eurCents: { $sum: '$total' },
            },
          },
        ],
      },
    },
  ]);

  const [created] = await Order.aggregate([
    { $match: { status: { $ne: 'cancelado' }, createdAt: { $gte: since } } },
    { $addFields: { d: dateStr('$createdAt') } },
    { $match: { d: { $regex: `^${prefix}` } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        eur: { $sum: { $cond: [{ $eq: ['$currency', 'EUR'] }, 1, 0] } },
        coins: { $sum: { $cond: [{ $eq: ['$currency', 'COINS'] }, 1, 0] } },
      },
    },
  ]);

  const [pending] = await Order.aggregate([
    { $match: { status: 'sin_pagar' } },
    { $group: { _id: null, eurCents: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);

  const byKey = new Map((paid?.series || []).map((s) => [String(s._id), s.eurCents]));
  res.json({
    period,
    today,
    revenueEurCents: paid?.scope?.[0]?.eurCents || 0,
    coinsRedeemed: paid?.scope?.[0]?.coins || 0,
    orders: { total: created?.total || 0, eur: created?.eur || 0, coins: created?.coins || 0 },
    pending: { orders: pending?.orders || 0, eurCents: pending?.eurCents || 0 },
    series: keys.map((k, i) => ({ key: k, label: labels[i], eurCents: byKey.get(k) || 0 })),
  });
});

// GET /stats?period=day|month|year&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/stats', async (req, res) => {
  const period = FORMATS[req.query.period] ? req.query.period : 'day';
  const now = new Date();
  const defaultFrom = {
    day: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29),
    month: new Date(now.getFullYear(), now.getMonth() - 11, 1),
    year: new Date(now.getFullYear() - 4, 0, 1),
  }[period];
  const from = req.query.from ? new Date(req.query.from) : defaultFrom;
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : now;

  const series = await Order.aggregate([
    { $match: { status: { $in: PAID }, paidAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: FORMATS[period], date: '$paidAt', timezone: TZ } },
        eurCents: { $sum: { $cond: [{ $eq: ['$currency', 'EUR'] }, '$total', 0] } },
        coins: { $sum: { $cond: [{ $eq: ['$currency', 'COINS'] }, '$total', 0] } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ period, from, to, series: series.map((s) => ({ bucket: s._id, eurCents: s.eurCents, coins: s.coins, orders: s.orders })) });
});

// Resumen: hoy / este mes / este año + pendientes + top clientes
router.get('/summary', async (req, res) => {
  const fmt = (d, f) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, ...f }).format(d);
  const now = new Date();
  const today = fmt(now, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);

  const [buckets] = await Order.aggregate([
    { $match: { status: { $in: PAID }, paidAt: { $gte: new Date(now.getFullYear() - 1, 0, 1) } } },
    {
      $addFields: {
        d: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: TZ } },
        eur: { $cond: [{ $eq: ['$currency', 'EUR'] }, '$total', 0] },
        coin: { $cond: [{ $eq: ['$currency', 'COINS'] }, '$total', 0] },
      },
    },
    {
      $facet: {
        today: [{ $match: { d: today } }, { $group: { _id: null, eurCents: { $sum: '$eur' }, coins: { $sum: '$coin' }, orders: { $sum: 1 } } }],
        month: [{ $match: { d: { $regex: `^${month}` } } }, { $group: { _id: null, eurCents: { $sum: '$eur' }, coins: { $sum: '$coin' }, orders: { $sum: 1 } } }],
        year: [{ $match: { d: { $regex: `^${year}` } } }, { $group: { _id: null, eurCents: { $sum: '$eur' }, coins: { $sum: '$coin' }, orders: { $sum: 1 } } }],
      },
    },
  ]);

  const pick = (arr) => ({ eurCents: arr?.[0]?.eurCents || 0, coins: arr?.[0]?.coins || 0, orders: arr?.[0]?.orders || 0 });

  const [pending] = await Order.aggregate([
    { $match: { status: 'sin_pagar' } },
    { $group: { _id: null, eurCents: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);

  const topCustomers = await Order.aggregate([
    { $match: { status: { $in: PAID }, currency: 'EUR' } },
    { $group: { _id: '$user', eurCents: { $sum: '$total' }, orders: { $sum: 1 } } },
    { $sort: { eurCents: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 0, userId: '$_id', fullName: '$user.fullName', eurCents: 1, orders: 1 } },
  ]);

  const [users, products] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Product.countDocuments({ active: true }),
  ]);

  res.json({
    today: pick(buckets?.today),
    month: pick(buckets?.month),
    year: pick(buckets?.year),
    pending: { eurCents: pending?.eurCents || 0, orders: pending?.orders || 0 },
    topCustomers,
    users,
    products,
  });
});

module.exports = router;
