const crypto = require('crypto');
const Order = require('../models/Order');

/**
 * Genera un código de pedido único con el formato  AÑO-DÍGITOS  (ej. "2026-0427").
 * - Empieza con 4 dígitos aleatorios.
 * - Si TODAS las combinaciones de 4 dígitos de ese año están usadas, pasa a 5 dígitos
 *   (y así sucesivamente, por si algún día se agotan también las de 5).
 * La unicidad final la garantiza el índice único de `code` en MongoDB; quien llama
 * reintenta si dos pedidos simultáneos eligen el mismo código.
 */
async function generateOrderCode(date = new Date()) {
  const year = date.getFullYear();

  for (let digits = 4; digits <= 9; digits += 1) {
    const capacity = 10 ** digits;
    const pattern = new RegExp(`^${year}-\\d{${digits}}$`);
    const used = await Order.countDocuments({ code: pattern });
    if (used >= capacity) continue; // todas las combinaciones usadas → un dígito más

    const make = (n) => `${year}-${String(n).padStart(digits, '0')}`;

    // Con poca ocupación, unos cuantos intentos aleatorios bastan
    if (used / capacity < 0.9) {
      for (let i = 0; i < 25; i += 1) {
        const candidate = make(crypto.randomInt(0, capacity));
        // eslint-disable-next-line no-await-in-loop
        if (!(await Order.exists({ code: candidate }))) return candidate;
      }
    }

    // Muy ocupado: se listan los usados y se elige uno libre al azar
    const usedCodes = new Set(
      (await Order.find({ code: pattern }, { code: 1, _id: 0 }).lean()).map((o) => o.code)
    );
    const free = [];
    for (let n = 0; n < capacity; n += 1) {
      const c = make(n);
      if (!usedCodes.has(c)) free.push(c);
    }
    if (free.length) return free[crypto.randomInt(0, free.length)];
  }
  throw new Error('No quedan códigos de pedido disponibles');
}

module.exports = { generateOrderCode };
