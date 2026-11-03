import { useState } from 'react';
import { api } from '../api';
import Icon from './Icon';
import { Modal, toast } from './ui';
import { CATEGORIES, centsToEuros, eurosToCents, TAGS } from '../utils/format';
import { shrinkImage } from '../utils/image';

// Edición rápida de un producto desde la propia tienda (solo admin).
// Lo menos habitual (códigos de barras…) sigue en Panel → Productos.
export default function QuickEditProduct({ product, onClose, onSaved }) {
  const isTicket = product.kind === 'entrada';
  const [f, setF] = useState({
    name: product.name || '',
    description: product.description || '',
    category: product.category || 'Otros',
    tags: product.tags || [],
    imageUrl: product.imageUrl || '',
    priceEur: centsToEuros(product.priceEurCents),
    coinsEnabled: product.coinsEnabled !== false,
    priceCoins: product.coinsEnabled === false && !product.priceCoins ? '' : String(product.priceCoins ?? ''),
    stock: product.stock ?? '',
    active: product.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggleTag = (t) => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] });

  const upload = async (e) => {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', await shrinkImage(original));
      const { url } = await api('/admin/upload', { method: 'POST', form });
      setF((prev) => ({ ...prev, imageUrl: url }));
      toast('Foto subida');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const priceEurCents = eurosToCents(f.priceEur);
    if (!Number.isInteger(priceEurCents) || priceEurCents < 0) {
      toast('Precio en euros no válido', 'bad');
      return;
    }
    setBusy(true);
    const body = {
      name: f.name,
      description: f.description,
      imageUrl: f.imageUrl,
      priceEurCents,
      coinsEnabled: f.coinsEnabled,
      priceCoins: Number(String(f.priceCoins).replace(/\./g, '')) || 0,
      stock: f.stock === '' ? null : Number(f.stock),
      active: f.active,
      ...(isTicket ? {} : { category: f.category, tags: f.tags }),
    };
    try {
      const path = isTicket ? `/admin/events/${product._id}` : `/admin/products/${product._id}`;
      const updated = await api(path, { method: 'PATCH', body });
      toast('Guardado');
      onSaved({ ...product, ...updated });
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const fullEditHref = isTicket ? `#/admin/eventos?edit=${product._id}` : `#/admin/productos?edit=${product._id}`;

  return (
    <Modal title={isTicket ? 'Editar evento' : 'Editar producto'} subtitle="Los cambios se ven en la tienda al momento." onClose={onClose}>
      <form className="form quick-edit" onSubmit={save}>
        <div className="quick-edit-top">
          <label className={`quick-photo${uploading ? ' busy' : ''}`} title="Cambiar foto">
            <input type="file" accept="image/*" onChange={upload} disabled={uploading} />
            {f.imageUrl ? <img src={f.imageUrl} alt="" /> : <Icon name="upload" size={22} />}
            <span>{uploading ? 'Subiendo…' : 'Cambiar foto'}</span>
          </label>
          <div className="quick-edit-main">
            <label>Nombre<input required value={f.name} onChange={set('name')} /></label>
            <label>Descripción corta<input value={f.description} onChange={set('description')} maxLength={300} /></label>
          </div>
        </div>

        <div className="form-3">
          <label>Precio €<input required inputMode="decimal" value={f.priceEur} onChange={set('priceEur')} /></label>
          <label className={f.coinsEnabled ? 'label-cc' : ''}>
            <span className="label-row">Precio CC <input type="checkbox" role="switch" className="switch switch-sm" checked={f.coinsEnabled} onChange={set('coinsEnabled')} aria-label="Se vende con CHIKACOINS" /></span>
            {f.coinsEnabled
              ? <input className="input-cc" required inputMode="numeric" value={f.priceCoins} onChange={set('priceCoins')} placeholder="Ej. 500" />
              : <span className="coins-off">Solo €</span>}
          </label>
          <label>{isTicket ? 'Plazas' : 'Stock'}<input type="number" min="0" step="1" value={f.stock} onChange={set('stock')} placeholder="Sin límite" /></label>
        </div>

        {!isTicket && (
          <div className="form-2">
            <label>Categoría
              <select value={f.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <fieldset className="checks">
              <legend>Etiquetas</legend>
              {Object.entries(TAGS).map(([k, v]) => (
                <label key={k} className="check"><input type="checkbox" checked={f.tags.includes(k)} onChange={() => toggleTag(k)} /> {v}</label>
              ))}
            </fieldset>
          </div>
        )}

        <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Visible en la tienda</label>

        <div className="form-actions spread">
          <a href={fullEditHref} className="link-btn">Edición completa{isTicket ? '' : ' (códigos de barras…)'}</a>
          <span className="row-actions">
            <button type="button" className="btn btn-light" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy || uploading}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </span>
        </div>
      </form>
    </Modal>
  );
}
