/**
 * Crea (o actualiza) la cuenta de administrador definida en el .env.
 *   npm run seed            → solo el admin
 *   npm run seed -- --demo  → admin + productos de ejemplo
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const { randomInternalEan13 } = require('./utils/barcode');

const DEMO_PRODUCTS = [
  // nombre, descripción corta, categoría, etiquetas, € (céntimos), CHIKACOINS, stock
  ['Sobre de cartas coleccionables', 'Booster pack', 'Sobres', ['nuevo', 'destacado'], 500, 500, 42],
  ['Fundas mate negras', '100 fundas', 'Fundas', ['destacado'], 999, 900, 30],
  ['Bebida energética 500 ml', 'Lata', 'Bebidas', ['destacado'], 250, 250, 64],
  ['Toploader rígido', '25 unidades', 'Accesorios TCG', ['destacado'], 350, 350, 20],
  ['Tapete de rol', 'Edición aventureros', 'Accesorios TCG', ['destacado', 'oferta'], 2500, 2500, 6],
  ['Refresco de cola zero 330 ml', 'Lata', 'Bebidas', ['destacado'], 180, 180, 80],
  ['Set de dados metálicos', '7 dados', 'Dados', ['nuevo'], 1490, 1490, 15],
  ['Patatas fritas sal marina', 'Bolsa 150 g', 'Snacks', ['nuevo'], 220, 200, 40],
  ['Juego de mesa: Mazmorra exprés', '2-5 jugadores', 'Juegos de mesa', ['nuevo', 'oferta'], 2995, 2800, 4],
  ['Camiseta ChikakuShop', 'Talla única', 'Merchandising', ['oferta'], 1500, 1400, 12],
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.syncIndexes(); // el DNI es opcional: índice único solo para quien lo tenga
  await Product.syncIndexes(); // código de barras único

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!email || !process.env.ADMIN_PASSWORD) throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD en el .env');

  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await User.findOneAndUpdate(
    { email },
    {
      $set: { role: 'admin', password, active: true },
      $setOnInsert: {
        fullName: process.env.ADMIN_NAME || 'Administrador',
        ...(process.env.ADMIN_DNI ? { dni: process.env.ADMIN_DNI } : {}),
        email,
      },
    },
    { upsert: true, runValidators: true }
  );
  console.log(`👑 Admin listo: ${email}`);

  if (process.argv.includes('--demo')) {
    for (const [name, description, category, tags, priceEurCents, priceCoins, stock] of DEMO_PRODUCTS) {
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { name },
        { $setOnInsert: { name, description, category, tags, priceEurCents, priceCoins, stock, barcode: randomInternalEan13() } },
        { upsert: true }
      );
    }
    console.log(`🎲 ${DEMO_PRODUCTS.length} productos de ejemplo creados`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { DEMO_PRODUCTS };
