const mongoose = require('mongoose');

const STATUSES = ['sin_pagar', 'pagado', 'entregado', 'cancelado'];

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    // Precio unitario congelado en el momento de la compra (céntimos o coins según currency)
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: Number, required: true, unique: true },
    // Año + dígitos aleatorios, ej. "2026-0427". Si se agotan las 10.000 combinaciones del año → 5 dígitos.
    code: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    currency: { type: String, enum: ['EUR', 'COINS'], required: true },
    total: { type: Number, required: true, min: 0 }, // céntimos si EUR, coins si COINS
    status: { type: String, enum: STATUSES, default: 'sin_pagar', index: true },
    // Cómo se pagó: saldo de chikacoins, saldo en € o en la tienda física
    paidWith: { type: String, enum: ['coins', 'saldo_eur', 'tienda', null], default: null },
    paidAt: { type: Date, default: null },
    coinsEarned: { type: Number, default: 0 },
    adminNote: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ paidAt: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
