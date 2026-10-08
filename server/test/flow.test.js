// Pruebas de extremo a extremo con una MongoDB en memoria.  Ejecuta: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const { generateOrderCode } = require('../src/services/orderCode');

let mongo;
let server;
let base;

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Order.init()]);
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test('flujo completo: registro, compra en coins y en euros, pago en tienda, cancelación', async () => {
  // Admin
  await User.create({ fullName: 'Admin', email: 'admin@test.com', password: await bcrypt.hash('adminadmin', 10), role: 'admin' });
  const adminLogin = await call('/auth/login', { method: 'POST', body: { identifier: 'admin@test.com', password: 'adminadmin' } });
  assert.equal(adminLogin.status, 200);
  const admin = adminLogin.data.token;

  // Correo no válido → error
  const bad = await call('/auth/register', { method: 'POST', body: { fullName: 'X', email: 'no-es-un-correo', password: '12345678' } });
  assert.equal(bad.status, 400);

  // Aunque alguien mande un DNI, no se guarda
  const reg = await call('/auth/register', { method: 'POST', body: { fullName: 'Ana Pérez', dni: '12345678Z', email: 'ana@test.com', password: '12345678' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.dni, undefined);
  assert.equal((await User.collection.findOne({ email: 'ana@test.com' })).dni, undefined);
  const ana = reg.data.token;
  const anaId = reg.data.user.id;

  // Correo repetido → 409
  assert.equal((await call('/auth/register', { method: 'POST', body: { fullName: 'Ana 2', email: 'ANA@test.com', password: '12345678' } })).status, 409);

  // Login con el correo (sin distinguir mayúsculas)
  assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'Ana@Test.com', password: '12345678' } })).status, 200);

  // Producto con dos precios
  const prod = await call('/admin/products', { method: 'POST', token: admin, body: { name: 'Poción', priceEurCents: 500, priceCoins: 600, stock: 10 } });
  assert.equal(prod.status, 201);
  const pid = prod.data._id;

  // Compra en coins sin saldo → 402
  assert.equal((await call('/orders', { method: 'POST', token: ana, body: { currency: 'COINS', items: [{ productId: pid, quantity: 1 }] } })).status, 402);

  // Compra en euros sin saldo → SIN PAGAR
  const o1 = await call('/orders', { method: 'POST', token: ana, body: { currency: 'EUR', items: [{ productId: pid, quantity: 2 }] } });
  assert.equal(o1.status, 201);
  assert.equal(o1.data.status, 'sin_pagar');
  assert.equal(o1.data.total, 1000);
  assert.match(o1.data.code, new RegExp(`^${new Date().getFullYear()}-\\d{4}$`));

  // Admin lo marca pagado en tienda → +1000 CC (10 € × 100)
  const paid = await call(`/admin/orders/${o1.data._id}`, { method: 'PATCH', token: admin, body: { status: 'pagado' } });
  assert.equal(paid.data.status, 'pagado');
  assert.equal(paid.data.coinsEarned, 1000);
  let me = (await call('/auth/me', { token: ana })).data.user;
  assert.equal(me.balanceCoins, 1000);

  // Compra en coins → PAGADO automáticamente
  const o2 = await call('/orders', { method: 'POST', token: ana, body: { currency: 'COINS', items: [{ productId: pid, quantity: 1 }] } });
  assert.equal(o2.data.status, 'pagado');
  assert.equal(o2.data.coinsEarned, 0);
  assert.notEqual(o2.data.code, o1.data.code);
  assert.equal(o2.data.orderNumber, o1.data.orderNumber + 1);

  // Recarga de 20 € y compra en euros con saldo → PAGADO + recompensa
  await call(`/admin/users/${anaId}/topup`, { method: 'POST', token: admin, body: { currency: 'EUR', amount: 2000 } });
  const o3 = await call('/orders', { method: 'POST', token: ana, body: { currency: 'EUR', items: [{ productId: pid, quantity: 1 }] } });
  assert.equal(o3.data.status, 'pagado');
  assert.equal(o3.data.paidWith, 'saldo_eur');
  me = (await call('/auth/me', { token: ana })).data.user;
  assert.equal(me.balanceEurCents, 1500);
  assert.equal(me.balanceCoins, 1000 - 600 + 500);

  // Cancelar o2 (coins) → devuelve 600 CC y el stock
  await call(`/admin/orders/${o2.data._id}`, { method: 'PATCH', token: admin, body: { status: 'cancelado' } });
  me = (await call('/auth/me', { token: ana })).data.user;
  assert.equal(me.balanceCoins, 1500);

  // Stock: 10 - 2 - 1 - 1 + 1 = 7
  const list = await call('/admin/products', { token: admin });
  assert.equal(list.data[0].stock, 7);

  // El admin edita el usuario pero NO la contraseña
  await call(`/admin/users/${anaId}`, { method: 'PATCH', token: admin, body: { fullName: 'Ana P. Gómez', password: 'hackeada' } });
  assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'ana@test.com', password: '12345678' } })).status, 200);

  // Estadísticas
  const stats = await call('/admin/stats?period=month', { token: admin });
  assert.equal(stats.status, 200);
  const summary = await call('/admin/summary', { token: admin });
  assert.equal(summary.data.today.eurCents, 1500);
  for (const period of ['day', 'month', 'year']) {
    // eslint-disable-next-line no-await-in-loop
    const ov = await call(`/admin/overview?period=${period}`, { token: admin });
    assert.equal(ov.status, 200);
    assert.equal(ov.data.revenueEurCents, 1500);
    assert.equal(ov.data.series.reduce((s, b) => s + b.eurCents, 0), 1500);
  }

  // Códigos de barras
  assert.equal((await call(`/admin/products/${pid}`, { method: 'PATCH', token: admin, body: { barcode: '8410076472862' } })).status, 400); // dígito de control mal
  assert.equal((await call(`/admin/products/${pid}`, { method: 'PATCH', token: admin, body: { barcode: '036000291452' } })).data.barcode, '036000291452');
  let scanned = await call('/products/barcode/0036000291452'); // el mismo UPC-A leído como EAN-13
  assert.equal(scanned.status, 200);
  assert.equal(scanned.data._id, pid);
  assert.equal((await call('/products/barcode/9999999999994')).status, 404);
  const p2 = await call('/admin/products', { method: 'POST', token: admin, body: { name: 'Dados', priceEurCents: 100, priceCoins: 100, barcode: '036000291452' } });
  assert.equal(p2.status, 409); // código repetido
  const p3 = await call('/admin/products', { method: 'POST', token: admin, body: { name: 'Dados', priceEurCents: 100, priceCoins: 100 } });
  assert.equal(p3.status, 201);
  const gen = await call('/admin/products/barcode/generate', { method: 'POST', token: admin });
  assert.match(gen.data.barcode, /^2\d{12}$/);
  const fill = await call('/admin/products/barcode/fill', { method: 'POST', token: admin });
  assert.equal(fill.data.filled, 1);
  scanned = await call(`/products/barcode/${(await call('/admin/products?q=Dados', { token: admin })).data[0].barcode}`);
  assert.equal(scanned.data.name, 'Dados');
  // Quitar el código
  assert.equal((await call(`/admin/products/${pid}`, { method: 'PATCH', token: admin, body: { barcode: '' } })).data.barcode, undefined);
  await call(`/admin/products/${p3.data._id}`, { method: 'DELETE', token: admin });

  // Importación masiva (Excel): vista previa y luego guardar
  const rows = [
    { 'Nombre *': 'EJEMPLO – Sobre de cartas', 'Precio € *': '5' },
    { 'Nombre *': 'Bolígrafo rúnico', 'Categoría': 'merchandising', 'Precio € *': '2,50', 'Stock': '10', 'Código de barras': '5901234123457', 'Etiquetas': 'nuevo' },
    { 'Nombre *': 'Poción', 'Precio € *': '6', 'Precio CC': '550' }, // ya existe → actualizar
    { 'Nombre *': 'Mal', 'Precio € *': 'gratis' },
  ];
  const preview = await call('/admin/products/import', { method: 'POST', token: admin, body: { rows } });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.data.summary, { create: 1, update: 1, error: 1, skip: 1 });
  assert.equal((await call('/products/barcode/5901234123457')).status, 404); // la vista previa no guarda
  const imported = await call('/admin/products/import', { method: 'POST', token: admin, body: { rows, dryRun: false } });
  assert.equal(imported.data.summary.create, 1);
  assert.equal(imported.data.summary.update, 1);
  const boli = await call('/products/barcode/5901234123457');
  assert.equal(boli.data.priceEurCents, 250);
  assert.equal(boli.data.priceCoins, 250); // sin precio CC → € × 100
  assert.equal(boli.data.category, 'Merchandising');
  const pocion = (await call('/admin/products?q=Poción', { token: admin })).data[0];
  assert.equal(pocion.priceEurCents, 600);
  assert.equal(pocion.priceCoins, 550);
  assert.equal((await call('/admin/products/import', { method: 'POST', token: admin, body: { rows: [{ Foo: 1 }] } })).status, 400);

  // Etiquetas y filtro por etiqueta
  await call(`/admin/products/${pid}`, { method: 'PATCH', token: admin, body: { tags: ['nuevo', 'oferta'] } });
  assert.equal((await call('/products?tag=oferta')).data.total, 1);
  assert.equal((await call('/products?tag=destacado')).data.total, 0);

  // El admin crea un usuario con saldo inicial, y ese usuario puede entrar
  const created = await call('/admin/users', { method: 'POST', token: admin, body: { fullName: 'Luis Pérez', email: 'luis@test.com', password: 'clave1234', balanceEurCents: 1000, balanceCoins: 300 } });
  assert.equal(created.status, 201);
  assert.equal(created.data.balanceEurCents, 1000);
  assert.equal(created.data.role, 'user');
  assert.equal((await call('/auth/login', { method: 'POST', body: { identifier: 'luis@test.com', password: 'clave1234' } })).status, 200);
  // Correo repetido → 409
  assert.equal((await call('/admin/users', { method: 'POST', token: admin, body: { fullName: 'X', email: 'luis@test.com', password: 'clave1234' } })).status, 409);
  // Un usuario normal no puede crear usuarios
  assert.equal((await call('/admin/users', { method: 'POST', token: ana, body: { fullName: 'X', email: 'x2@test.com', password: 'clave1234' } })).status, 403);

  // Un usuario normal no entra al panel
  assert.equal((await call('/admin/summary', { token: ana })).status, 403);
});

test('código de pedido: pasa a 5 dígitos cuando se agotan las 10.000 combinaciones', async () => {
  await Order.deleteMany({});
  const year = new Date().getFullYear();
  const user = new mongoose.Types.ObjectId();
  const product = new mongoose.Types.ObjectId();
  const docs = [];
  for (let n = 0; n < 10000; n += 1) {
    docs.push({
      orderNumber: 100000 + n, code: `${year}-${String(n).padStart(4, '0')}`, user, currency: 'EUR', total: 1,
      items: [{ product, name: 'x', quantity: 1, unitPrice: 1 }],
    });
  }
  await Order.insertMany(docs);

  const code = await generateOrderCode();
  assert.match(code, new RegExp(`^${year}-\\d{5}$`));
});
