require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');
  if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en el .env');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🗄️  Conectado a MongoDB');

  // Ya no se guarda el DNI: lo borra de los usuarios antiguos y quita su índice
  const User = require('./models/User');
  await require('./utils/purgeDni').purgeDni(User);
  await User.syncIndexes();
  await require('./models/Product').syncIndexes(); // índice único del código de barras

  createApp().listen(PORT, () => console.log(`🐉 ChikakuShop API en http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
