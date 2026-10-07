const mongoose = require('mongoose');
const { isValidDni, normalizeDni } = require('../utils/dni');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    // DNI/NIE opcional. Si se rellena, se valida la letra y no puede repetirse.
    dni: {
      type: String,
      default: undefined,
      set: (v) => normalizeDni(v) || undefined,
      validate: { validator: (v) => v == null || isValidDni(v), message: 'DNI/NIE no válido' },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo electrónico no válido'],
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    balanceEurCents: { type: Number, default: 0, min: 0 },
    balanceCoins: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Único solo entre los usuarios que tienen DNI (los que no lo tienen no chocan entre sí)
userSchema.index({ dni: 1 }, { unique: true, partialFilterExpression: { dni: { $type: 'string' } } });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    fullName: this.fullName,
    dni: this.dni || null,
    email: this.email,
    role: this.role,
    balanceEurCents: this.balanceEurCents,
    balanceCoins: this.balanceCoins,
    active: this.active,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
