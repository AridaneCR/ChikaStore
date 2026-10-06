const express = require('express');
const Order = require('../models/Order');
const Movement = require('../models/Movement');
const { requireAuth } = require('../middleware/auth');
const { createOrder } = require('../services/orderService');

const router = express.Router();
router.use(requireAuth);

// Crear pedido: { items: [{ productId, quantity }], currency: 'EUR' | 'COINS' }
router.post('/', async (req, res) => {
  const order = await createOrder(req.user._id, req.body?.items, req.body?.currency);
  res.status(201).json(order);
});

router.get('/mine', async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(orders);
});

router.get('/mine/movements', async (req, res) => {
  const list = await Movement.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json(list);
});

router.get('/mine/:id', async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  return res.json(order);
});

module.exports = router;
