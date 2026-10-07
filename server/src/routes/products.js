const express = require('express');
const Product = require('../models/Product');
const { barcodeVariants } = require('../utils/barcode');

const router = express.Router();
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Catálogo público (solo productos activos)
// ?q=texto &category=Sobres &tag=nuevo|destacado|oferta &sort=... &page &limit
router.get('/', async (req, res) => {
  const { q, category, tag, page = 1, limit = 24, sort = 'name' } = req.query;
  const filter = { active: true };
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { description: rx }, { category: rx }];
  }

  const sorts = {
    name: { name: 1 },
    eur_asc: { priceEurCents: 1 },
    eur_desc: { priceEurCents: -1 },
    coins_asc: { priceCoins: 1 },
    new: { createdAt: -1 },
  };
  const lim = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const pg = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sorts[sort] || sorts.name).skip((pg - 1) * lim).limit(lim).lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page: pg, pages: Math.ceil(total / lim) || 1 });
});

router.get('/categories', (req, res) => {
  res.json(Product.CATEGORIES);
});

// Buscar un producto por su código de barras (lo usa el escáner del móvil)
router.get('/barcode/:code', async (req, res) => {
  const variants = barcodeVariants(req.params.code);
  const product = variants.length ? await Product.findOne({ barcode: { $in: variants }, active: true }).lean() : null;
  if (!product) return res.status(404).json({ error: 'No hay ningún producto con ese código' });
  return res.json(product);
});

router.get('/:id', async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, active: true }).lean();
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  return res.json(product);
});

module.exports = router;
