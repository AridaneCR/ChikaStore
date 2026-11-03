const express = require('express');
const Product = require('../models/Product');
const TicketHolder = require('../models/TicketHolder');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Un evento se da por terminado al acabar (o 6 horas después de empezar si no tiene hora de fin)
const endOf = (p) => new Date(p.event?.endsAt || new Date(new Date(p.event?.startsAt).getTime() + 6 * 3600e3));

// Eventos visibles: ?past=1 para los que ya pasaron. Marca los que el usuario ya tiene.
router.get('/', requireAuth, async (req, res) => {
  const past = req.query.past === '1';
  const all = await Product.find({ kind: 'entrada', active: true }).sort({ 'event.startsAt': past ? -1 : 1 }).lean();
  const now = new Date();
  const list = all.filter((p) => (endOf(p) < now) === past).slice(0, 100);
  const mine = await TicketHolder.find({ user: req.user._id, event: { $in: list.map((p) => p._id) } })
    .populate('order', 'code status orderNumber')
    .lean();
  const byEvent = new Map(mine.map((h) => [String(h.event), h]));
  res.json(list.map((p) => {
    const h = byEvent.get(String(p._id));
    return { ...p, owned: Boolean(h), myOrder: h?.order || null };
  }));
});

module.exports = router;
