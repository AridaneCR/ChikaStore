import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../../api';
import Icon from '../../components/Icon';
import Barcode from '../../components/Barcode';
import ProductCard from '../../components/ProductCard';
import Scanner from '../../components/Scanner';
import ImportProducts, { exportProducts } from './ImportProducts';
import { Modal, Spinner, toast } from '../../components/ui';
import { barcodeSvg, isValidBarcode } from '../../utils/barcode';
import { CATEGORIES, centsToEuros, eurosToCents, formatCoins, formatEur, TAGS } from '../../utils/format';

const EMPTY = { name: '', description: '', category: 'Sobres', tags: [], imageUrl: '', barcode: '', priceEur: '', priceCoins: '', stock: '', active: true };

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Abre una ventana con etiquetas (nombre, precios y código de barras) lista para imprimir. */
function printLabels(products) {
  const withCode = products.filter((p) => p.barcode);
  if (!withCode.length) {
    toast('Ningún producto tiene código de barras', 'bad');
    return;
  }
  const win = window.open('', '_blank');
  if (!win) {
    toast('El navegador ha bloqueado la ventana de impresión', 'bad');
    return;
  }
  const labels = withCode.map((p) => `
    <div class="label">
      <div class="name">${esc(p.name)}</div>
      <div class="price">${esc(formatEur(p.priceEurCents))} · ${esc(formatCoins(p.priceCoins))} CC</div>
      ${barcodeSvg(p.barcode, { height: 50 }) || `<div class="raw">${esc(p.barcode)}</div>`}
    </div>`).join('');
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas CHIKASTORE</title>
    <style>
      body{font-family:Arial,sans-serif;margin:10mm}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
      .label{border:1px dashed #bbb;padding:3mm;text-align:center;break-inside:avoid}
      .name{font-weight:700;font-size:11pt;margin-bottom:1mm}
      .price{font-size:9pt;margin-bottom:2mm}
      svg{max-width:100%;height:auto}
      .raw{font-family:monospace;font-size:12pt;padding:4mm 0}
      @media print{.label{border-color:#ddd}}
    </style></head><body><div class="grid">${labels}</div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  tags: p.tags || [],
  barcode: p.barcode || '',
  priceEur: centsToEuros(p.priceEurCents),
  priceCoins: String(p.priceCoins),
  stock: p.stock ?? '',
});

export default function AdminProducts() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null = nuevo, producto = edición
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const formRef = useRef(null);

  const load = useCallback(() => {
    api(`/admin/products${qs({ q })}`).then(setList).catch((e) => toast(e.message, 'bad'));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggleTag = (t) => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] });

  const startEdit = (p) => {
    setEditing(p);
    setF(toForm(p));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = () => {
    setEditing(null);
    setF(EMPTY);
    setShowUrl(false);
  };

  const preview = {
    ...f,
    priceEurCents: eurosToCents(f.priceEur || 0) || 0,
    priceCoins: Number(f.priceCoins) || 0,
    stock: f.stock === '' ? null : Number(f.stock),
  };

  const generateBarcode = async () => {
    try {
      const { barcode } = await api('/admin/products/barcode/generate', { method: 'POST' });
      setF((prev) => ({ ...prev, barcode }));
    } catch (err) {
      toast(err.message, 'bad');
    }
  };

  const fillBarcodes = async () => {
    if (!window.confirm('¿Dar un código de barras interno a todos los productos que no tienen?')) return;
    try {
      const { filled } = await api('/admin/products/barcode/fill', { method: 'POST' });
      toast(filled ? `${filled} productos con código nuevo` : 'Todos los productos ya tenían código');
      load();
    } catch (err) {
      toast(err.message, 'bad');
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      const { url } = await api('/admin/upload', { method: 'POST', form });
      setF((prev) => ({ ...prev, imageUrl: url }));
      toast('Foto subida');
    } catch (err) {
      toast(err.message, 'bad');
      setShowUrl(true);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      name: f.name,
      description: f.description,
      category: f.category,
      tags: f.tags,
      imageUrl: f.imageUrl,
      barcode: f.barcode.trim(),
      priceEurCents: eurosToCents(f.priceEur),
      priceCoins: Number(String(f.priceCoins).replace(/\./g, '')),
      stock: f.stock === '' ? null : Number(f.stock),
      active: f.active,
    };
    try {
      if (editing) await api(`/admin/products/${editing._id}`, { method: 'PATCH', body });
      else await api('/admin/products', { method: 'POST', body });
      toast(editing ? 'Producto actualizado' : 'Producto creado');
      reset();
      load();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="admin-head" ref={formRef}>
        <div>
          <h1 className="page-title">{editing ? 'Editar producto' : 'Nuevo producto'}</h1>
          <p className="muted">Define los dos precios: en euros y en CHIKACOINS.</p>
        </div>
      </div>

      <div className="product-editor">
        <form className="card form" onSubmit={save}>
          <label>Nombre<input required value={f.name} onChange={set('name')} placeholder="Set de dados metálicos" /></label>
          <div className="form-2">
            <label>Categoría
              <select value={f.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Stock<input type="number" min="0" step="1" value={f.stock} onChange={set('stock')} placeholder="Vacío = ilimitado" /></label>
          </div>
          <div className="form-2">
            <label>Precio en euros<input required inputMode="decimal" value={f.priceEur} onChange={set('priceEur')} placeholder="14,90" /></label>
            <label className="label-cc">Precio en CHIKACOINS
              <span className="input-with-btn">
                <input className="input-cc" required inputMode="numeric" value={f.priceCoins} onChange={set('priceCoins')} placeholder="1490" />
                <button type="button" className="btn btn-light btn-sm" onClick={() => setF({ ...f, priceCoins: String(eurosToCents(f.priceEur || 0) || '') })} title="Euros × 100">€ × 100</button>
              </span>
            </label>
          </div>
          <label>Descripción corta<input value={f.description} onChange={set('description')} maxLength={300} placeholder="7 dados" /></label>

          <div className="barcode-field">
            <label>Código de barras
              <span className="input-with-btn">
                <input value={f.barcode} onChange={set('barcode')} inputMode="numeric" placeholder="EAN del fabricante o pulsa Generar" className="mono" />
                <button type="button" className="btn btn-light btn-sm" onClick={() => setScanning(true)} title="Leer con la cámara"><Icon name="camera" size={16} /> Escanear</button>
                <button type="button" className="btn btn-light btn-sm" onClick={generateBarcode} title="Crear un código interno">Generar</button>
              </span>
            </label>
            {f.barcode && !isValidBarcode(f.barcode) && <small className="field-error">Este código no es válido (revisa los números).</small>}
            {f.barcode && isValidBarcode(f.barcode) && <Barcode value={f.barcode} height={40} className="barcode-preview" />}
          </div>

          <fieldset className="checks">
            <legend>Etiquetas</legend>
            {Object.entries(TAGS).map(([k, v]) => (
              <label key={k} className="check"><input type="checkbox" checked={f.tags.includes(k)} onChange={() => toggleTag(k)} /> {v}</label>
            ))}
            <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Visible en la tienda</label>
          </fieldset>

          <label className="dropzone">
            <input type="file" accept="image/*" onChange={upload} />
            {f.imageUrl ? (
              <span className="dz-filled"><img src={f.imageUrl} alt="" /> Cambiar foto</span>
            ) : (
              <span><Icon name="upload" size={18} /> Subir foto del producto</span>
            )}
          </label>
          {showUrl ? (
            <label>URL de la imagen<input value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://…" /></label>
          ) : (
            <button type="button" className="link-btn" onClick={() => setShowUrl(true)}>o pega la URL de una imagen</button>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-light" onClick={reset}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button>
          </div>
        </form>

        <div className="editor-preview">
          <span className="eyebrow">Vista previa</span>
          <ProductCard product={preview} preview />
        </div>
      </div>

      <div className="section-head">
        <h2>Productos {list && <small className="muted">({list.length})</small>}</h2>
        <div className="head-tools">
          <button className="btn btn-dark btn-sm" onClick={() => setImporting(true)}><Icon name="upload" size={16} /> Importar Excel</button>
          <button className="btn btn-light btn-sm" onClick={() => list && exportProducts(list)}>Exportar Excel</button>
          <button className="btn btn-light btn-sm" onClick={fillBarcodes}><Icon name="barcode" size={16} /> Generar códigos que faltan</button>
          <button className="btn btn-light btn-sm" onClick={() => list && printLabels(list.filter((p) => p.active))}><Icon name="printer" size={16} /> Imprimir etiquetas</button>
          <label className="search-box small">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" aria-label="Buscar producto" />
          </label>
        </div>
      </div>

      {!list ? <Spinner /> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Producto</th><th>Categoría</th><th>Código</th><th className="num">€</th><th className="num">CC</th><th className="num">Stock</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p._id} className={p.active ? '' : 'row-off'}>
                    <td><strong>{p.name}</strong>{!p.active && <span className="badge badge-muted"> Oculto</span>}</td>
                    <td className="muted">{p.category}</td>
                    <td className="mono muted">{p.barcode || '—'}</td>
                    <td className="num"><strong>{formatEur(p.priceEurCents)}</strong></td>
                    <td className="num cc"><strong>{formatCoins(p.priceCoins)}</strong></td>
                    <td className="num">{p.stock ?? '∞'}</td>
                    <td className="num">
                      <div className="row-actions end">
                        {p.barcode && <button className="btn btn-light btn-sm" onClick={() => printLabels([p])} title="Imprimir etiqueta"><Icon name="printer" size={14} /></button>}
                        <button className="btn btn-light btn-sm" onClick={() => startEdit(p)}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={7} className="muted center">No hay productos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importing && <ImportProducts onClose={() => setImporting(false)} onDone={load} />}

      {scanning && (
        <Modal title="Escanear código de barras" subtitle="Apunta la cámara al código del producto." onClose={() => setScanning(false)}>
          <Scanner
            onDetect={(code) => {
              setF((prev) => ({ ...prev, barcode: code }));
              setScanning(false);
              toast(`Código leído: ${code}`);
            }}
          />
        </Modal>
      )}
    </>
  );
}
