const mongoose = require('mongoose');

// Quién tiene entrada para cada evento. El índice único (evento + usuario) garantiza
// que nadie pueda comprar dos veces la misma entrada, ni siquiera con dos pedidos a la vez.
const ticketHolderSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  },
  { timestamps: true }
);

ticketHolderSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('TicketHolder', ticketHolderSchema);
