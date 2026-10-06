const mongoose = require('mongoose');
const { isValidDni, normalizeDni } = require('../utils/dni');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    dni: {
      type: String,
      required: true,
      unique: true,
      set: normalizeDni,
      validate: { validator: isValidDni, message: 'DNI/NIE no válido' },
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

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    fullName: this.fullName,
    dni: this.dni,
    email: this.email,
    role: this.role,
    balanceEurCents: this.balanceEurCents,
    balanceCoins: this.balanceCoins,
    active: this.active,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
