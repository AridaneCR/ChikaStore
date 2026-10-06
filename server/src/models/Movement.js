const mongoose = require('mongoose');

// Historial de movimientos de saldo (recargas, compras, recompensas, devoluciones, ajustes)
const movementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currency: { type: String, enum: ['EUR', 'COINS'], required: true },
    amount: { type: Number, required: true }, // positivo = entra, negativo = sale
    type: {
      type: String,
      enum: ['recarga', 'compra', 'recompensa', 'devolucion', 'ajuste'],
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Movement', movementSchema);
