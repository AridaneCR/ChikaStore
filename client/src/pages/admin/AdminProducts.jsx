import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../../api';
import Icon from '../../components/Icon';
import ProductCard from '../../components/ProductCard';
import { Spinner, toast } from '../../components/ui';
import { CATEGORIES, centsToEuros, eurosToCents, formatCoins, formatEur, TAGS } from '../../utils/format';

const EMPTY = { name: '', description: '', category: 'Sobres', tags: [], imageUrl: '', priceEur: '', priceCoins: '', stock: '', active: true };

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  tags: p.tags || [],
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
        <label className="search-box small">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" />
        </label>
      </div>

      {!list ? <Spinner /> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="num">€</th><th className="num">CC</th><th className="num">Stock</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p._id} className={p.active ? '' : 'row-off'}>
                    <td><strong>{p.name}</strong>{!p.active && <span className="badge badge-muted"> Oculto</span>}</td>
                    <td className="muted">{p.category}</td>
                    <td className="num"><strong>{formatEur(p.priceEurCents)}</strong></td>
                    <td className="num cc"><strong>{formatCoins(p.priceCoins)}</strong></td>
                    <td className="num">{p.stock ?? '∞'}</td>
                    <td className="num"><button className="btn btn-light btn-sm" onClick={() => startEdit(p)}>Editar</button></td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={6} className="muted center">No hay productos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
