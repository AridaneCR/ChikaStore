// Validación de DNI y NIE españoles (letra de control incluida)
const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

function normalizeDni(value = '') {
  return String(value).toUpperCase().replace(/[\s-]/g, '');
}

function isValidDni(value) {
  const dni = normalizeDni(value);
  let match = dni.match(/^(\d{8})([A-Z])$/);
  if (match) return LETTERS[Number(match[1]) % 23] === match[2];

  // NIE: X/Y/Z + 7 dígitos + letra
  match = dni.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (match) {
    const prefix = { X: '0', Y: '1', Z: '2' }[match[1]];
    return LETTERS[Number(prefix + match[2]) % 23] === match[3];
  }
  return false;
}

module.exports = { normalizeDni, isValidDni };
