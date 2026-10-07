const crypto = require('crypto');

// Códigos de barras de producto.
// - EAN-13 / EAN-8 / UPC-A (solo dígitos): se comprueba el dígito de control.
// - Cualquier otro código (Code128, códigos propios…): letras, números y guiones, de 4 a 32.
// - Los códigos que genera la tienda son EAN-13 que empiezan por "2" (rango reservado para uso interno).

function normalizeBarcode(value) {
  if (value === undefined || value === null) return undefined;
  const v = String(value).trim().replace(/\s+/g, '').toUpperCase();
  return v || undefined;
}

/** Dígito de control GS1 para los dígitos dados (sin el de control). */
function gs1CheckDigit(digits) {
  let sum = 0;
  const arr = String(digits).split('').reverse();
  arr.forEach((d, i) => {
    sum += Number(d) * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code) {
  return Number(code.slice(-1)) === gs1CheckDigit(code.slice(0, -1));
}

function isValidBarcode(value) {
  const v = normalizeBarcode(value);
  if (!v) return false;
  if (/^\d+$/.test(v) && [8, 12, 13].includes(v.length)) return hasValidCheckDigit(v);
  return /^[0-9A-Z-]{4,32}$/.test(v);
}

/** Formas equivalentes de un mismo código (UPC-A de 12 dígitos = EAN-13 con un 0 delante). */
function barcodeVariants(value) {
  const v = normalizeBarcode(value);
  if (!v) return [];
  const out = new Set([v]);
  if (/^\d{12}$/.test(v)) out.add(`0${v}`);
  if (/^0\d{12}$/.test(v)) out.add(v.slice(1));
  return [...out];
}

/** EAN-13 interno aleatorio: "2" + 11 dígitos + dígito de control. */
function randomInternalEan13() {
  let body = '2';
  for (let i = 0; i < 11; i += 1) body += crypto.randomInt(0, 10);
  return body + gs1CheckDigit(body);
}

module.exports = { normalizeBarcode, isValidBarcode, barcodeVariants, gs1CheckDigit, randomInternalEan13 };
