// Todo el dinero se guarda en CÉNTIMOS (enteros) para evitar errores de coma flotante.
// Relación CHIKACOINS: 1 € = 100 CHIKACOINS  →  1 céntimo = 1 CHIKACOIN.
const COINS_PER_EURO = 100;

function eurosToCents(euros) {
  const n = Number(euros);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

function coinsEarnedForCents(cents) {
  return Math.floor((cents * COINS_PER_EURO) / 100);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { COINS_PER_EURO, eurosToCents, coinsEarnedForCents, HttpError };
