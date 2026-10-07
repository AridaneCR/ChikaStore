const Product = require('../models/Product');
const { normalizeBarcode, isValidBarcode, barcodeVariants } = require('../utils/barcode');
const { HttpError } = require('../utils/money');

// Importación masiva de productos desde Excel/CSV.
// El navegador lee el archivo y envía las filas tal cual ({ "Nombre": "...", "Precio €": "4,99", ... }).
// Aquí se reconocen las columnas, se valida cada fila y se crea o actualiza el producto:
//   - si la fila trae código de barras y ya existe un producto con ese código → se actualiza
//   - si no, si existe un producto con el mismo nombre → se actualiza
//   - si no → se crea
// Con dryRun = true no se guarda nada: solo se devuelve lo que pasaría (vista previa).

const MAX_ROWS = 2000;

const strip = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[*()]/g, ' ').replace(/\s+/g, ' ').trim();

// Nombres de columna aceptados (sin tildes, en minúsculas)
const COLUMNS = {
  name: ['nombre', 'producto', 'name'],
  description: ['descripcion', 'descripcion corta', 'description'],
  category: ['categoria', 'category'],
  priceEur: ['precio €', 'precio eur', 'precio euros', 'precio en euros', 'precio', 'euros', '€', 'price'],
  priceCoins: ['precio cc', 'precio chikacoins', 'precio en chikacoins', 'chikacoins', 'cc'],
  stock: ['stock', 'existencias', 'unidades'],
  barcode: ['codigo de barras', 'codigo', 'ean', 'barcode'],
  tags: ['etiquetas', 'tags'],
  imageUrl: ['url imagen', 'imagen', 'url de la imagen', 'foto', 'image'],
  active: ['visible', 'activo', 'visible en la tienda'],
};

function mapHeaders(keys) {
  const map = {};
  for (const key of keys) {
    const k = strip(key);
    for (const [field, names] of Object.entries(COLUMNS)) {
      if (!map[field] && names.includes(k)) map[field] = key;
    }
  }
  return map;
}

const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

/** "4,99" · "4.99" · "1.234,50" · 4.99 → céntimos */
function parseEuros(v) {
  if (typeof v === 'number') return Math.round(v * 100);
  let s = String(v).replace(/[€\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** "1.490" · "1490" · 1490 → entero */
function parseInteger(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[\s.]/g, '').replace(',', '.');
  return Number(s);
}

function parseBool(v) {
  if (isEmpty(v)) return true;
  if (typeof v === 'boolean') return v;
  const s = strip(v);
  if (['si', 's', 'yes', 'y', 'true', '1', 'x'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  return null;
}

function barcodeText(v) {
  if (isEmpty(v)) return undefined;
  // Excel puede guardar el EAN como número: 8410076472861 o 8.410076472861E12
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(0);
  const s = String(v).trim();
  if (/^\d+(\.\d+)?e\+\d+$/i.test(s)) return Number(s).toFixed(0);
  return normalizeBarcode(s);
}

const CATEGORY_BY_KEY = Object.fromEntries(Product.CATEGORIES.map((c) => [strip(c), c]));

/** Convierte una fila del Excel en datos de producto. Devuelve { data, errors, warnings }. */
function parseRow(raw, map) {
  const get = (field) => (map[field] ? raw[map[field]] : undefined);
  const errors = [];
  const warnings = [];
  const data = {};

  const name = String(get('name') ?? '').trim();
  if (!name) errors.push('Falta el nombre');
  else if (name.length > 120) errors.push('El nombre tiene más de 120 caracteres');
  data.name = name;

  if (!isEmpty(get('description'))) data.description = String(get('description')).trim().slice(0, 300);

  const cat = get('category');
  if (!isEmpty(cat)) {
    const found = CATEGORY_BY_KEY[strip(cat)];
    if (found) data.category = found;
    else {
      data.category = 'Otros';
      warnings.push(`Categoría "${cat}" desconocida: se usa "Otros"`);
    }
  }

  const eur = get('priceEur');
  if (isEmpty(eur)) errors.push('Falta el precio en euros');
  else {
    const cents = parseEuros(eur);
    if (!Number.isInteger(cents) || cents < 0) errors.push(`Precio en euros no válido: "${eur}"`);
    else data.priceEurCents = cents;
  }

  const cc = get('priceCoins');
  if (isEmpty(cc)) {
    if (data.priceEurCents !== undefined) data.priceCoins = data.priceEurCents; // 1 € = 100 CC
  } else {
    const n = parseInteger(cc);
    if (!Number.isInteger(n) || n < 0) errors.push(`Precio en CHIKACOINS no válido: "${cc}"`);
    else data.priceCoins = n;
  }

  const stock = get('stock');
  if (isEmpty(stock)) data.stock = null;
  else {
    const n = parseInteger(stock);
    if (!Number.isInteger(n) || n < 0) errors.push(`Stock no válido: "${stock}"`);
    else data.stock = n;
  }

  const code = barcodeText(get('barcode'));
  if (code) {
    if (!isValidBarcode(code)) errors.push(`Código de barras no válido: "${code}"`);
    else data.barcode = code;
  }

  const tags = get('tags');
  if (!isEmpty(tags)) {
    const list = String(tags).split(/[,;/]/).map(strip).filter(Boolean);
    const bad = list.filter((t) => !Product.TAGS.includes(t));
    if (bad.length) warnings.push(`Etiquetas ignoradas: ${bad.join(', ')}`);
    data.tags = [...new Set(list.filter((t) => Product.TAGS.includes(t)))];
  }

  const img = get('imageUrl');
  if (!isEmpty(img)) {
    const url = String(img).trim();
    if (/^https?:\/\//i.test(url)) data.imageUrl = url;
    else warnings.push('La URL de la imagen no empieza por http(s): se ignora');
  }

  const visible = parseBool(get('active'));
  if (visible === null) errors.push(`Visible debe ser "sí" o "no", no "${get('active')}"`);
  else data.active = visible;

  return { data, errors, warnings };
}

async function importProducts(rows, { dryRun = true } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, 'El archivo no tiene filas');
  if (rows.length > MAX_ROWS) throw new HttpError(400, `Máximo ${MAX_ROWS} filas por importación`);

  const map = mapHeaders(Object.keys(Object.assign({}, ...rows)));
  if (!map.name || !map.priceEur) {
    throw new HttpError(400, 'No encuentro las columnas "Nombre" y "Precio €". Usa la plantilla de importación.');
  }

  // Productos existentes para emparejar por código y por nombre
  const existing = await Product.find({}, { name: 1, barcode: 1 }).lean();
  const byBarcode = new Map();
  const byName = new Map();
  for (const p of existing) {
    if (p.barcode) byBarcode.set(p.barcode, p);
    byName.set(strip(p.name), p);
  }

  const seenCodes = new Map(); // código → nº de fila (duplicados dentro del archivo)
  const seenNames = new Map();
  const results = [];

  rows.forEach((raw, i) => {
    const rowNumber = i + 2; // fila 1 = cabeceras
    const { data, errors, warnings } = parseRow(raw, map);

    if (/^ejemplo\b/i.test(data.name)) {
      results.push({ row: rowNumber, name: data.name, action: 'skip', warnings: ['Fila de ejemplo: se ignora'], errors: [] });
      return;
    }

    let match = null;
    if (data.barcode) {
      match = barcodeVariants(data.barcode).map((c) => byBarcode.get(c)).find(Boolean) || null;
      if (seenCodes.has(data.barcode)) errors.push(`Código repetido en el archivo (fila ${seenCodes.get(data.barcode)})`);
      seenCodes.set(data.barcode, rowNumber);
    }
    if (!match && data.name) match = byName.get(strip(data.name)) || null;

    if (data.name) {
      const key = strip(data.name);
      if (seenNames.has(key) && !data.barcode) errors.push(`Nombre repetido en el archivo (fila ${seenNames.get(key)})`);
      seenNames.set(key, rowNumber);
    }

    // El código no puede pertenecer a OTRO producto distinto del que se actualiza
    if (data.barcode && !errors.length) {
      const owner = barcodeVariants(data.barcode).map((c) => byBarcode.get(c)).find(Boolean);
      if (owner && match && String(owner._id) !== String(match._id)) {
        errors.push(`El código ${data.barcode} ya es de "${owner.name}"`);
      }
    }

    results.push({
      row: rowNumber,
      name: data.name,
      action: errors.length ? 'error' : match ? 'update' : 'create',
      productId: match ? String(match._id) : undefined,
      data,
      errors,
      warnings,
    });
  });

  const summary = {
    create: results.filter((r) => r.action === 'create').length,
    update: results.filter((r) => r.action === 'update').length,
    error: results.filter((r) => r.action === 'error').length,
    skip: results.filter((r) => r.action === 'skip').length,
  };

  if (!dryRun) {
    for (const r of results) {
      if (r.action !== 'create' && r.action !== 'update') continue;
      try {
        if (r.action === 'create') {
          // eslint-disable-next-line no-await-in-loop
          const created = await Product.create(r.data);
          r.productId = String(created._id);
        } else {
          // eslint-disable-next-line no-await-in-loop
          await Product.findByIdAndUpdate(r.productId, r.data, { runValidators: true });
        }
      } catch (err) {
        r.action = 'error';
        r.errors.push(err.code === 11000 ? 'Código de barras repetido' : err.message);
      }
    }
    summary.create = results.filter((r) => r.action === 'create').length;
    summary.update = results.filter((r) => r.action === 'update').length;
    summary.error = results.filter((r) => r.action === 'error').length;
  }

  // La vista previa no necesita devolver los datos completos de cada fila
  return {
    dryRun,
    columns: map,
    summary,
    results: results.map(({ data, ...r }) => ({
      ...r,
      priceEurCents: data?.priceEurCents,
      priceCoins: data?.priceCoins,
      category: data?.category,
      barcode: data?.barcode,
    })),
  };
}

module.exports = { importProducts, mapHeaders, parseRow };
