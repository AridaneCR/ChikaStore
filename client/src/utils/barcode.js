// Códigos de barras EAN-13 / EAN-8 / UPC-A: validación y dibujo en SVG (sin librerías).

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((p) => p.replace(/./g, (b) => (b === '1' ? '0' : '1')));
const G = R.map((p) => p.split('').reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLG', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export const normalizeBarcode = (v) => String(v ?? '').trim().replace(/\s+/g, '').toUpperCase();

export function gs1CheckDigit(digits) {
  let sum = 0;
  String(digits).split('').reverse().forEach((d, i) => {
    sum += Number(d) * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10;
}

const validCheck = (code) => Number(code.slice(-1)) === gs1CheckDigit(code.slice(0, -1));

export function isValidBarcode(value) {
  const v = normalizeBarcode(value);
  if (!v) return false;
  if (/^\d+$/.test(v) && [8, 12, 13].includes(v.length)) return validCheck(v);
  return /^[0-9A-Z-]{4,32}$/.test(v);
}

/** Módulos (1 = barra, 0 = espacio) de un EAN-13/UPC-A/EAN-8 válido, o null si no se puede dibujar. */
export function eanModules(value) {
  let v = normalizeBarcode(value);
  if (!/^\d+$/.test(v) || !validCheck(v)) return null;
  if (v.length === 12) v = `0${v}`; // UPC-A = EAN-13 con 0 delante
  if (v.length === 13) {
    const parity = PARITY[Number(v[0])];
    let m = '101';
    for (let i = 1; i <= 6; i += 1) m += (parity[i - 1] === 'L' ? L : G)[Number(v[i])];
    m += '01010';
    for (let i = 7; i <= 12; i += 1) m += R[Number(v[i])];
    return `${m}101`;
  }
  if (v.length === 8) {
    let m = '101';
    for (let i = 0; i < 4; i += 1) m += L[Number(v[i])];
    m += '01010';
    for (let i = 4; i < 8; i += 1) m += R[Number(v[i])];
    return `${m}101`;
  }
  return null;
}

/** SVG del código de barras (como texto, para pintarlo en React o en una ventana de impresión). */
export function barcodeSvg(value, { height = 60, module = 2, showText = true } = {}) {
  const code = normalizeBarcode(value);
  const modules = eanModules(code);
  if (!modules) return null;
  const quietL = 11;
  const quietR = 7;
  const width = (modules.length + quietL + quietR) * module;
  const textH = showText ? 16 : 0;
  let bars = '';
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === '1') {
      let j = i;
      while (modules[j] === '1') j += 1;
      bars += `<rect x="${(quietL + i) * module}" y="0" width="${(j - i) * module}" height="${height}"/>`;
      i = j;
    } else i += 1;
  }
  const text = showText
    ? `<text x="${width / 2}" y="${height + 14}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="14" letter-spacing="2">${code}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + textH}" width="${width}" height="${height + textH}" role="img" aria-label="Código de barras ${code}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars}</g>${text}</svg>`;
}
