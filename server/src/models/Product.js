const mongoose = require('mongoose');

const CATEGORIES = [
  'Sobres',
  'Fundas',
  'Accesorios TCG',
  'Bebidas',
  'Snacks',
  'Juegos de mesa',
  'Dados',
  'Merchandising',
  'Otros',
];
const TAGS = ['nuevo', 'destacado', 'oferta'];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Descripción corta que aparece bajo el nombre (ej. "100 fundas", "Lata")
    description: { type: String, default: '', maxlength: 300 },
    category: { type: String, enum: CATEGORIES, default: 'Otros' },
    tags: { type: [{ type: String, enum: TAGS }], default: [] },
    imageUrl: { type: String, default: '' },
    // Los dos precios los elige el admin de forma independiente
    priceEurCents: { type: Number, required: true, min: 0 },
    priceCoins: { type: Number, required: true, min: 0 },
    // null = sin control de stock
    stock: { type: Number, default: null, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ active: 1, category: 1 });
productSchema.index({ active: 1, tags: 1 });

module.exports = mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.TAGS = TAGS;
