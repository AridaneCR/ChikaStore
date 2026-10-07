// Leer y escribir hojas de cálculo sin librerías externas.
// - readSpreadsheet(file): .xlsx (Excel, LibreOffice, Google Sheets) o .csv → [{ cabecera: valor }]
// - writeXlsx(headers, rows): genera un .xlsx sencillo (una hoja, todo como texto/número)

/* ------------------------------- ZIP ------------------------------- */

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // Fin del directorio central (firma 0x06054b50), buscando desde el final
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un Excel (.xlsx) válido');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = {};
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = dec.decode(data.subarray(ptr + 46, ptr + 46 + nameLen));
    files[name] = { method, compSize, localOffset };
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return {
    has: (name) => name in files,
    names: () => Object.keys(files),
    async text(name) {
      const f = files[name];
      if (!f) return null;
      const lnameLen = view.getUint16(f.localOffset + 26, true);
      const lextraLen = view.getUint16(f.localOffset + 28, true);
      const start = f.localOffset + 30 + lnameLen + lextraLen;
      const raw = data.subarray(start, start + f.compSize);
      const bytes = f.method === 0 ? raw : await inflateRaw(raw);
      return dec.decode(bytes);
    },
  };
}

/* ------------------------------- XLSX ------------------------------- */

const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml');
const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));

function colIndex(ref) {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function readXlsx(buffer) {
  const zip = await unzip(buffer);

  // Primera hoja según workbook.xml (+ sus relaciones)
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await zip.text('xl/workbook.xml');
  const rels = await zip.text('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const firstSheet = byTag(parseXml(wb), 'sheet')[0];
    const rid = firstSheet?.getAttribute('r:id') || firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = byTag(parseXml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    if (rel) {
      const target = rel.getAttribute('Target').replace(/^\//, '');
      sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
    }
  }
  if (!zip.has(sheetPath)) sheetPath = zip.names().find((n) => /^xl\/worksheets\/.*\.xml$/.test(n));
  if (!sheetPath) throw new Error('El Excel no tiene ninguna hoja');

  const sstText = await zip.text('xl/sharedStrings.xml');
  const shared = sstText
    ? byTag(parseXml(sstText), 'si').map((si) => byTag(si, 't').map((t) => t.textContent).join(''))
    : [];

  const sheet = parseXml(await zip.text(sheetPath));
  const grid = [];
  for (const row of byTag(sheet, 'row')) {
    const values = [];
    for (const c of byTag(row, 'c')) {
      const type = c.getAttribute('t');
      const ref = c.getAttribute('r');
      const v = byTag(c, 'v')[0]?.textContent;
      let value;
      if (type === 's') value = shared[Number(v)];
      else if (type === 'inlineStr') value = byTag(c, 't').map((t) => t.textContent).join('');
      else if (type === 'b') value = v === '1';
      else if (type === 'str' || type === 'e') value = v ?? '';
      else if (v !== undefined) value = Number(v);
      if (value === undefined) continue;
      values[ref ? colIndex(ref) : values.length] = value;
    }
    grid.push(values);
  }
  return grid;
}

/* -------------------------------- CSV -------------------------------- */

function readCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const grid = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(cell); grid.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); grid.push(row); }
  return grid;
}

/** Lee un .xlsx o .csv y devuelve { headers, rows: [{ cabecera: valor }] } (sin filas vacías). */
export async function readSpreadsheet(file) {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const grid = isCsv ? readCsv(await file.text()) : await readXlsx(await file.arrayBuffer());
  const headerIdx = grid.findIndex((r) => r && r.some((v) => String(v ?? '').trim() !== ''));
  if (headerIdx < 0) throw new Error('El archivo está vacío');
  const headers = Array.from(grid[headerIdx], (h) => String(h ?? '').trim());
  const rows = [];
  for (const r of grid.slice(headerIdx + 1)) {
    if (!r || !r.some((v) => String(v ?? '').trim() !== '')) continue;
    const obj = {};
    headers.forEach((h, i) => {
      if (h && r[i] !== undefined && r[i] !== null && String(r[i]).trim() !== '') obj[h] = r[i];
    });
    rows.push(obj);
  }
  return { headers: headers.filter(Boolean), rows };
}

/* ---------------------------- Escribir XLSX ---------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const colName = (i) => {
  let s = '';
  let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

/**
 * Crea un .xlsx con una hoja. rows = [[valor, ...]]. Los números se guardan como número,
 * el resto como texto (así los códigos de barras no se convierten en 8,41E+12).
 * widths = anchos de columna opcionales.
 */
export function writeXlsx({ sheetName = 'Productos', headers, rows, widths = [] }) {
  const cell = (v, r, c, style = 0) => {
    const ref = `${colName(c)}${r}`;
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  };
  const sheetRows = [
    `<row r="1">${headers.map((h, c) => cell(h, 1, c, 1)).join('')}</row>`,
    ...rows.map((r, i) => `<row r="${i + 2}">${r.map((v, c) => cell(v, i + 2, c)).join('')}</row>`),
  ].join('');
  const cols = headers.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths[i] || Math.max(12, String(h).length + 4)}" customWidth="1"/>`).join('');

  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`],
  ];
  return zipStore(files);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
