const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Counter = require('../models/Counter');
const Movement = require('../models/Movement');
const { generateOrderCode } = require('./orderCode');
const { coinsEarnedForCents, HttpError } = require('../utils/money');

const MAX_QTY_PER_ITEM = 99;

/* ---------- helpers de stock y saldo (operaciones atómicas) ---------- */

async function reserveStock(lines) {
  const done = [];
  for (const line of lines) {
    if (line.product.stock === null || line.product.stock === undefined) continue;
    // eslint-disable-next-line no-await-in-loop
    const ok = await Product.findOneAndUpdate(
      { _id: line.product._id, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } }
    );
    if (!ok) {
      await releaseStock(done);
      throw new HttpError(409, `No hay stock suficiente de "${line.product.name}"`);
    }
    done.push({ productId: line.product._id, quantity: line.quantity });
  }
  return done;
}

async function releaseStock(reserved) {
  for (const r of reserved) {
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: r.productId, stock: { $ne: null } }, { $inc: { stock: r.quantity } });
  }
}

async function chargeBalance(userId, field, amount) {
  if (amount === 0) return true;
  const res = await User.updateOne(
    { _id: userId, [field]: { $gte: amount } },
    { $inc: { [field]: -amount } }
  );
  return res.modifiedCount === 1;
}

async function credit(userId, field, amount) {
  if (amount) await User.updateOne({ _id: userId }, { $inc: { [field]: amount } });
}

/** Resta coins sin bajar de 0 (por si el usuario ya se gastó la recompensa). Devuelve lo restado. */
async function debitCoinsUpTo(userId, amount) {
  if (!amount) return 0;
  const user = await User.findById(userId, { balanceCoins: 1 });
  const take = Math.min(amount, user ? user.balanceCoins : 0);
  if (take > 0) await User.updateOne({ _id: userId }, { $inc: { balanceCoins: -take } });
  return take;
}

/* ---------------------------- creación ---------------------------- */

async function buildLines(rawItems, currency) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(400, 'El carrito está vacío');
  }
  // Agrupa productos repetidos
  const qtyById = new Map();
  for (const it of rawItems) {
    const id = String(it.productId || '');
    const q = Number(it.quantity);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(q) || q < 1) {
      throw new HttpError(400, 'Producto o cantidad no válidos');
    }
    qtyById.set(id, (qtyById.get(id) || 0) + q);
  }

  const products = await Product.find({ _id: { $in: [...qtyById.keys()] }, active: true });
  if (products.length !== qtyById.size) {
    throw new HttpError(400, 'Algún producto ya no está disponible');
  }

  return products.map((product) => {
    const quantity = qtyById.get(String(product._id));
    if (quantity > MAX_QTY_PER_ITEM) throw new HttpError(400, `Máximo ${MAX_QTY_PER_ITEM} unidades por producto`);
    const unitPrice = currency === 'COINS' ? product.priceCoins : product.priceEurCents;
    return { product, quantity, unitPrice };
  });
}

async function insertOrderWithUniqueIds(data) {
  // Reintenta si dos pedidos simultáneos chocan en el código (índice único)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const [orderNumber, code] = await Promise.all([Counter.next('orderNumber'), generateOrderCode()]);
    try {
      // eslint-disable-next-line no-await-in-loop
      return await Order.create({ ...data, orderNumber, code });
    } catch (err) {
      if (err && err.code === 11000) continue;
      throw err;
    }
  }
  throw new HttpError(503, 'No se pudo generar un número de pedido, inténtalo de nuevo');
}

/**
 * Crea un pedido.
 * - COINS: se cobra del saldo de chikacoins y queda PAGADO (si no llega el saldo → error).
 * - EUR:   si el saldo en € cubre el total se cobra y queda PAGADO (+ chikacoins de recompensa);
 *          si no, queda SIN PAGAR y se paga en la tienda física.
 */
async function createOrder(userId, rawItems, currency) {
  if (!['EUR', 'COINS'].includes(currency)) throw new HttpError(400, 'Moneda no válida');

  const lines = await buildLines(rawItems, currency);
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const reserved = await reserveStock(lines);
  let charged = null; // { field, amount }

  try {
    let status = 'sin_pagar';
    let paidWith = null;

    if (currency === 'COINS') {
      if (!(await chargeBalance(userId, 'balanceCoins', total))) {
        throw new HttpError(402, 'No tienes suficientes CHIKACOINS');
      }
      charged = { field: 'balanceCoins', amount: total };
      status = 'pagado';
      paidWith = 'coins';
    } else if (await chargeBalance(userId, 'balanceEurCents', total)) {
      charged = { field: 'balanceEurCents', amount: total };
      status = 'pagado';
      paidWith = 'saldo_eur';
    }

    const coinsEarned = currency === 'EUR' && status === 'pagado' ? coinsEarnedForCents(total) : 0;

    const order = await insertOrderWithUniqueIds({
      user: userId,
      items: lines.map((l) => ({
        product: l.product._id,
        name: l.product.name,
        imageUrl: l.product.imageUrl,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      currency,
      total,
      status,
      paidWith,
      paidAt: status === 'pagado' ? new Date() : null,
      coinsEarned,
    });

    const movements = [];
    if (charged) {
      movements.push({ user: userId, currency, amount: -total, type: 'compra', order: order._id });
    }
    if (coinsEarned) {
      await credit(userId, 'balanceCoins', coinsEarned);
      movements.push({ user: userId, currency: 'COINS', amount: coinsEarned, type: 'recompensa', order: order._id });
    }
    if (movements.length) await Movement.insertMany(movements);

    return order;
  } catch (err) {
    if (charged) await credit(userId, charged.field, charged.amount);
    await releaseStock(reserved);
    throw err;
  }
}

/* ------------------------- gestión (admin) ------------------------- */

const ALLOWED = {
  sin_pagar: ['pagado', 'cancelado'],
  pagado: ['entregado', 'cancelado', 'sin_pagar'],
  entregado: ['pagado'],
  cancelado: [],
};

async function changeStatus(orderId, newStatus, adminId) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  if (order.status === newStatus) return order;
  if (!(ALLOWED[order.status] || []).includes(newStatus)) {
    throw new HttpError(400, `No se puede pasar de "${order.status}" a "${newStatus}"`);
  }

  const userId = order.user;
  const movements = [];

  if (order.status === 'sin_pagar' && newStatus === 'pagado') {
    // Pagado en la tienda física
    order.paidWith = 'tienda';
    order.paidAt = new Date();
    if (order.currency === 'EUR') {
      order.coinsEarned = coinsEarnedForCents(order.total);
      await credit(userId, 'balanceCoins', order.coinsEarned);
      movements.push({ user: userId, currency: 'COINS', amount: order.coinsEarned, type: 'recompensa', order: order._id, by: adminId });
    }
  }

  if (order.status === 'pagado' && newStatus === 'sin_pagar') {
    if (order.paidWith !== 'tienda') {
      throw new HttpError(400, 'Solo se puede desmarcar un pago hecho en la tienda');
    }
    const taken = await debitCoinsUpTo(userId, order.coinsEarned);
    if (taken) movements.push({ user: userId, currency: 'COINS', amount: -taken, type: 'ajuste', order: order._id, by: adminId, note: 'Pago desmarcado' });
    order.coinsEarned = 0;
    order.paidWith = null;
    order.paidAt = null;
  }

  if (newStatus === 'cancelado') {
    await releaseStock(order.items.map((i) => ({ productId: i.product, quantity: i.quantity })));
    if (order.status === 'pagado') {
      // Devolución: lo pagado vuelve al saldo (coins → coins; € de saldo o tienda → saldo en €)
      const field = order.currency === 'COINS' ? 'balanceCoins' : 'balanceEurCents';
      await credit(userId, field, order.total);
      movements.push({ user: userId, currency: order.currency, amount: order.total, type: 'devolucion', order: order._id, by: adminId });
      const taken = await debitCoinsUpTo(userId, order.coinsEarned);
      if (taken) movements.push({ user: userId, currency: 'COINS', amount: -taken, type: 'ajuste', order: order._id, by: adminId, note: 'Recompensa retirada por cancelación' });
    }
  }

  order.status = newStatus;
  await order.save();
  if (movements.length) await Movement.insertMany(movements);
  return order;
}

/** Modifica las cantidades de un pedido SIN PAGAR (cantidad 0 = quitar el producto). */
async function updateItems(orderId, newItems) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  if (order.status !== 'sin_pagar') {
    throw new HttpError(400, 'Solo se pueden modificar los productos de pedidos sin pagar');
  }

  const wanted = new Map();
  for (const it of newItems || []) {
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q < 0 || q > MAX_QTY_PER_ITEM) throw new HttpError(400, 'Cantidad no válida');
    wanted.set(String(it.productId), q);
  }

  const reserved = [];
  const released = [];
  try {
    for (const item of order.items) {
      const key = String(item.product);
      if (!wanted.has(key)) continue;
      const diff = wanted.get(key) - item.quantity;
      if (diff > 0) {
        // eslint-disable-next-line no-await-in-loop
        const res = await Product.updateOne(
          { _id: item.product, stock: { $gte: diff } },
          { $inc: { stock: -diff } }
        );
        if (res.modifiedCount === 1) {
          reserved.push({ productId: item.product, quantity: diff });
        } else {
          // eslint-disable-next-line no-await-in-loop
          const p = await Product.findById(item.product, { stock: 1 });
          const unlimited = p && (p.stock === null || p.stock === undefined);
          if (!unlimited) throw new HttpError(409, `No hay stock suficiente de "${item.name}"`);
        }
      } else if (diff < 0) {
        released.push({ productId: item.product, quantity: -diff });
      }
    }
  } catch (err) {
    await releaseStock(reserved);
    throw err;
  }

  const items = order.items
    .map((i) => {
      const key = String(i.product);
      return wanted.has(key) ? { ...i.toObject(), quantity: wanted.get(key) } : i.toObject();
    })
    .filter((i) => i.quantity > 0);

  if (items.length === 0) {
    await releaseStock(reserved);
    throw new HttpError(400, 'El pedido no puede quedarse vacío; cancélalo en su lugar');
  }

  await releaseStock(released);
  order.items = items;
  order.total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  await order.save();
  return order;
}

module.exports = { createOrder, changeStatus, updateItems };
