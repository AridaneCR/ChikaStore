require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');
  if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en el .env');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🗄️  Conectado a MongoDB');

  // Pone al día los índices de usuarios (p. ej. el DNI pasó a ser opcional: único solo si existe)
  await require('./models/User').syncIndexes();

  createApp().listen(PORT, () => console.log(`🐉 CHIKASTORE API en http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
