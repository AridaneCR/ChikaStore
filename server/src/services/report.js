// Informe para exportar a PDF: pedidos y saldos de los usuarios en un periodo
// (día, semana de lunes a domingo, mes o año), en la hora de la tienda.
const Order = require('../models/Order');
const User = require('../models/User');
const Movement = require('../models/Movement');
const { HttpError } = require('../utils/money');

const TZ = process.env.STORE_TZ || 'Europe/Madrid';
const PERIODS = ['day', 'week', 'month', 'year'];
const PAID = ['pagado', 'entregado'];

// Diferencia (ms) entre la hora local de la tienda y UTC en un instante dado
function tzOffsetMs(date, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante en que empieza el día (y, m, d) en la zona horaria de la tienda */
function zonedMidnight(y, m, d, tz = TZ) {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz); // corrige el cambio de hora
  return new Date(t);
}

const parts = (utcMs) => {
  const d = new Date(utcMs);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
};

const fmtCal = (y, m, d, opts) => new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, m - 1, d)));

/** { from, to, label, key } del periodo que contiene la fecha "AAAA-MM-DD" (o "AAAA-MM", "AAAA") */
function periodRange(period, dateStr, tz = TZ) {
  if (!PERIODS.includes(period)) throw new HttpError(400, 'Periodo no válido');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(dateStr || today));
  if (!m) throw new HttpError(400, 'Fecha no válida');
  const y = +m[1];
  const mo = +(m[2] || 1);
  const d = +(m[3] || 1);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new HttpError(400, 'Fecha no válida');

  let start; let end; let label; let key;
  if (period === 'day') {
    start = [y, mo, d];
    end = parts(Date.UTC(y, mo - 1, d + 1));
    label = fmtCal(y, mo, d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  } else if (period === 'week') {
    const dow = (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7; // lunes = 0
    start = parts(Date.UTC(y, mo - 1, d - dow));
    end = parts(Date.UTC(y, mo - 1, d - dow + 7));
    const last = parts(Date.UTC(y, mo - 1, d - dow + 6));
    const sameYear = start[0] === last[0];
    label = `semana del ${fmtCal(...start, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })} al ${fmtCal(...last, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    key = `${start[0]}-${String(start[1]).padStart(2, '0')}-${String(start[2]).padStart(2, '0')}-semana`;
  } else if (period === 'month') {
    start = [y, mo, 1];
    end = parts(Date.UTC(y, mo, 1));
    label = fmtCal(y, mo, 1, { month: 'long', year: 'numeric' });
    key = `${y}-${String(mo).padStart(2, '0')}`;
  } else {
    start = [y, 1, 1];
    end = [y + 1, 1, 1];
    label = `año ${y}`;
    key = String(y);
  }
  return { from: zonedMidnight(...start, tz), to: zonedMidnight(...end, tz), label, key, period };
}

async function buildReport(period, dateStr) {
  const range = periodRange(period, dateStr);
  const inRange = { $gte: range.from, $lt: range.to };

  const [orders, paidInRange, movements, users] = await Promise.all([
    Order.find({ createdAt: inRange }).sort({ createdAt: 1 }).limit(10000).populate('user', 'fullName email').lean(),
    Order.find({ paidAt: inRange, status: { $in: PAID } }, { currency: 1, total: 1, paidWith: 1 }).lean(),
    Movement.find({ createdAt: inRange }, { user: 1, currency: 1, amount: 1, type: 1 }).lean(),
    User.find({}, { fullName: 1, email: 1, role: 1, active: 1, balanceEurCents: 1, balanceCoins: 1 }).sort({ fullName: 1 }).lean(),
  ]);

  // Resumen de pedidos hechos en el periodo
  const byStatus = { sin_pagar: 0, pagado: 0, entregado: 0, cancelado: 0 };
  let createdEur = 0; let createdCoins = 0; let pendingEur = 0;
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.status === 'cancelado') continue;
    if (o.currency === 'EUR') createdEur += o.total; else createdCoins += o.total;
    if (o.status === 'sin_pagar' && o.currency === 'EUR') pendingEur += o.total;
  }
  // Lo cobrado en el periodo (según la fecha de pago)
  const cobrado = { tienda: 0, saldo_eur: 0, coins: 0 };
  for (const o of paidInRange) {
    if (o.currency === 'COINS') cobrado.coins += o.total;
    else if (o.paidWith === 'saldo_eur') cobrado.saldo_eur += o.total;
    else cobrado.tienda += o.total;
  }

  // Movimientos de saldo por usuario y totales por tipo
  const perUser = new Map();
  const byType = {};
  for (const mv of movements) {
    const k = String(mv.user);
    const u = perUser.get(k) || { eurIn: 0, eurOut: 0, coinsIn: 0, coinsOut: 0 };
    const field = `${mv.currency === 'EUR' ? 'eur' : 'coins'}${mv.amount >= 0 ? 'In' : 'Out'}`;
    u[field] += Math.abs(mv.amount);
    perUser.set(k, u);
    const t = `${mv.type}_${mv.currency}`;
    byType[t] = (byType[t] || 0) + mv.amount;
  }

  const orderCount = new Map();
  for (const o of orders) if (o.user) orderCount.set(String(o.user._id), (orderCount.get(String(o.user._id)) || 0) + 1);

  const userRows = users.map((u) => ({
    id: String(u._id),
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    active: u.active,
    balanceEurCents: u.balanceEurCents || 0,
    balanceCoins: u.balanceCoins || 0,
    orders: orderCount.get(String(u._id)) || 0,
    ...(perUser.get(String(u._id)) || { eurIn: 0, eurOut: 0, coinsIn: 0, coinsOut: 0 }),
  }));

  return {
    period: range.period,
    label: range.label,
    key: range.key,
    from: range.from,
    to: range.to,
    generatedAt: new Date(),
    summary: {
      orders: orders.length,
      byStatus,
      createdEurCents: createdEur,
      createdCoins,
      pendingEurCents: pendingEur,
      cobrado,
      movements: byType,
      totalBalanceEurCents: userRows.reduce((s, u) => s + u.balanceEurCents, 0),
      totalBalanceCoins: userRows.reduce((s, u) => s + u.balanceCoins, 0),
    },
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      code: o.code,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      customer: o.user ? o.user.fullName : '(usuario borrado)',
      email: o.user ? o.user.email : '',
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      currency: o.currency,
      total: o.total,
      status: o.status,
      paidWith: o.paidWith,
    })),
    users: userRows,
  };
}

module.exports = { buildReport, periodRange, zonedMidnight };
