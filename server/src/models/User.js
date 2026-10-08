const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo electrónico no válido'],
    },
    // Sin contraseña si la cuenta se creó con Google o Discord (puede crear una con «¿Olvidaste tu contraseña?»)
    password: { type: String, select: false },
    // Sube al cambiar la contraseña: invalida las sesiones abiertas antes
    tokenVersion: { type: Number, default: 0 },
    // Recuperación de contraseña: solo se guarda el hash del enlace
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    // Login social
    googleId: { type: String },
    discordId: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    balanceEurCents: { type: Number, default: 0, min: 0 },
    balanceCoins: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } });
userSchema.index({ discordId: 1 }, { unique: true, partialFilterExpression: { discordId: { $type: 'string' } } });
userSchema.index({ resetTokenHash: 1 }, { sparse: true });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    balanceEurCents: this.balanceEurCents,
    balanceCoins: this.balanceCoins,
    active: this.active,
    linked: { google: Boolean(this.googleId), discord: Boolean(this.discordId) },
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
