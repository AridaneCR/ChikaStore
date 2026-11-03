import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import Icon from '../../components/Icon';
import { CodePill, Modal, Spinner, StatusBadge, toast } from '../../components/ui';
import { centsToEuros, eurosToCents, formatCoins, formatEur, formatEventDate, formatPrice, orderNo } from '../../utils/format';
import { shrinkImage } from '../../utils/image';

// Eventos con entrada: cada evento es un producto de tipo «entrada». Se compra desde la
// sección Eventos de la tienda, una sola por persona, y se paga como cualquier pedido.

const EMPTY = {
  name: '', description: '', details: '', location: '', startsAt: '', endsAt: '',
  imageUrl: '', priceEur: '', coinsEnabled: true, priceCoins: '', stock: '', active: true,
};

// <input type="datetime-local"> trabaja en hora local sin zona
const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const toForm = (e) => ({
  ...EMPTY,
  name: e.name,
  description: e.description || '',
  details: e.event?.details || '',
  location: e.event?.location || '',
  startsAt: toLocalInput(e.event?.startsAt),
  endsAt: toLocalInput(e.event?.endsAt),
  imageUrl: e.imageUrl || '',
  priceEur: centsToEuros(e.priceEurCents),
  coinsEnabled: e.coinsEnabled !== false,
  priceCoins: e.coinsEnabled === false && !e.priceCoins ? '' : String(e.priceCoins ?? ''),
  stock: e.stock ?? '',
  active: e.active !== false,
});

const isPast = (e) => new Date(e.event?.endsAt || e.event?.startsAt) < new Date();
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function printAttendees(ev, list) {
  const win = window.open('', '_blank');
  if (!win) { toast('El navegador ha bloqueado la ventana', 'bad'); return; }
  const rows = list.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.user?.fullName)}${a.user?.adminAlias ? ` <i>(${esc(a.user.adminAlias)})</i>` : ''}</td><td>${esc(a.user?.email)}</td><td>${esc(a.order?.code || '')}</td><td>${a.order?.status === 'sin_pagar' ? 'Sin pagar' : 'Pagado'}</td><td class="box"></td></tr>`).join('');
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Asistentes – ${esc(ev.name)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:10pt;margin:16mm}h1{font-size:15pt;margin:0}p{color:#555;margin:4px 0 14px}
  table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f3f3f3;font-size:8pt;text-transform:uppercase}
  .box{width:18mm}td.box:after{content:'';display:inline-block;width:12px;height:12px;border:1px solid #999}</style></head><body>
  <h1>${esc(ev.name)}</h1><p>${esc(formatEventDate(ev.event?.startsAt))}${ev.event?.location ? ` · ${esc(ev.event.location)}` : ''} · ${list.length} asistentes</p>
  <table><thead><tr><th>#</th><th>Nombre</th><th>Correo</th><th>Pedido</th><th>Pago</th><th>Llegó</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}

function Attendees({ ev, onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    api(`/admin/events/${ev._id}/attendees`).then(setList).catch((e) => { toast(e.message, 'bad'); setList([]); });
  }, [ev._id]);
  return (
    <Modal wide title={`Asistentes · ${ev.name}`} subtitle={`${formatEventDate(ev.event?.startsAt)}${ev.event?.location ? ` · ${ev.event.location}` : ''}`} onClose={onClose}>
      {!list ? <Spinner /> : list.length === 0 ? <p className="muted">Todavía nadie ha comprado entrada.</p> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Cliente</th><th>Pedido</th><th>Comprada</th><th className="num">Importe</th><th>Estado</th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.user?.fullName || '—'}</strong>{a.user?.adminAlias && <em className="alias"> · {a.user.adminAlias}</em>}<small className="sub">{a.user?.email}</small></td>
                    <td>{a.order ? <>{orderNo(a.order.orderNumber)} <CodePill code={a.order.code} /></> : '—'}</td>
                    <td className="muted nowrap">{new Date(a.at).toLocaleDateString('es-ES')}</td>
                    <td className="num">{a.order ? formatPrice(a.order.total, a.order.currency) : '—'}</td>
                    <td>{a.order && <StatusBadge status={a.order.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-dark" onClick={() => printAttendees(ev, list)}><Icon name="printer" size={16} /> Imprimir lista</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function AdminEvents({ query = {} }) {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [attendees, setAttendees] = useState(null);
  const formRef = useRef(null);
  const editedFromLink = useRef(false);

  const load = useCallback(() => {
    api('/admin/events').then(setList).catch((e) => toast(e.message, 'bad'));
  }, []);
  useEffect(load, [load]);

  const startEdit = (ev) => {
    setEditing(ev);
    setF(toForm(ev));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = () => { setEditing(null); setF(EMPTY); };

  useEffect(() => {
    if (!query.edit || editedFromLink.current || !list) return;
    editedFromLink.current = true;
    const ev = list.find((x) => x._id === query.edit);
    if (ev) startEdit(ev);
  }, [list, query.edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

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
    const priceEurCents = f.priceEur === '' ? 0 : eurosToCents(f.priceEur);
    if (!Number.isInteger(priceEurCents) || priceEurCents < 0) { toast('Precio en euros no válido', 'bad'); return; }
    setBusy(true);
    const body = {
      name: f.name,
      description: f.description,
      details: f.details,
      location: f.location,
      startsAt: fromLocalInput(f.startsAt),
      endsAt: fromLocalInput(f.endsAt),
      imageUrl: f.imageUrl,
      priceEurCents,
      coinsEnabled: f.coinsEnabled,
      priceCoins: Number(String(f.priceCoins).replace(/\./g, '')) || 0,
      stock: f.stock === '' ? null : Number(f.stock),
      active: f.active,
    };
    try {
      if (editing) await api(`/admin/events/${editing._id}`, { method: 'PATCH', body });
      else await api('/admin/events', { method: 'POST', body });
      toast(editing ? 'Evento actualizado' : 'Evento creado');
      reset();
      load();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const shown = (list || []).filter((ev) => showPast || !isPast(ev));
  const pastCount = (list || []).filter(isPast).length;

  return (
    <>
      <div className="admin-head" ref={formRef}>
        <div>
          <h1 className="page-title">{editing ? 'Editar evento' : 'Nuevo evento'}</h1>
          <p className="muted">Cada evento tiene su entrada. Cada cliente solo puede comprar una.</p>
        </div>
        {editing && <button className="btn btn-light" onClick={reset}>+ Nuevo evento</button>}
      </div>

      <form className="card form event-editor" onSubmit={save}>
        <div className="event-editor-top">
          <label className={`quick-photo event-photo${uploading ? ' busy' : ''}`} title="Foto o cartel del evento">
            <input type="file" accept="image/*" onChange={upload} disabled={uploading} />
            {f.imageUrl ? <img src={f.imageUrl} alt="" /> : <Icon name="upload" size={24} />}
            <span>{uploading ? 'Subiendo…' : f.imageUrl ? 'Cambiar cartel' : 'Subir cartel'}</span>
          </label>
          <div className="quick-edit-main">
            <label>Nombre del evento<input required value={f.name} onChange={set('name')} placeholder="Torneo de Commander" /></label>
            <div className="form-2">
              <label>Empieza<input required type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></label>
              <label>Termina (opcional)<input type="datetime-local" value={f.endsAt} min={f.startsAt || undefined} onChange={set('endsAt')} /></label>
            </div>
            <label>Lugar<input value={f.location} onChange={set('location')} maxLength={160} placeholder="Tienda Chikaku" /></label>
          </div>
        </div>
        <label>Descripción corta<input value={f.description} onChange={set('description')} maxLength={300} placeholder="Formato, nivel, premios…" /></label>
        <label>Detalles <small className="muted">(horario, normas, qué traer…)</small><textarea rows={4} value={f.details} onChange={set('details')} maxLength={4000} /></label>

        <div className="form-3">
          <label>Precio de la entrada (€)<input inputMode="decimal" value={f.priceEur} onChange={set('priceEur')} placeholder="0 = gratis" /></label>
          <label className={f.coinsEnabled ? 'label-cc' : ''}>
            <span className="label-row">Precio en CHIKACOINS <input type="checkbox" role="switch" className="switch switch-sm" checked={f.coinsEnabled} onChange={set('coinsEnabled')} aria-label="Se puede pagar con CHIKACOINS" /></span>
            {f.coinsEnabled
              ? <input className="input-cc" required inputMode="numeric" value={f.priceCoins} onChange={set('priceCoins')} placeholder="Ej. 500" />
              : <span className="coins-off">Solo €</span>}
          </label>
          <label>Plazas disponibles<input type="number" min="0" step="1" value={f.stock} onChange={set('stock')} placeholder="Sin límite" /></label>
        </div>
        {editing && <p className="muted small">Vendidas: <strong>{editing.sold}</strong>. Las plazas bajan solas con cada entrada vendida y vuelven si se cancela el pedido.</p>}
        <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Visible en la tienda</label>

        <div className="form-actions">
          {editing && <button type="button" className="btn btn-light" onClick={reset}>Cancelar</button>}
          <button className="btn btn-primary" disabled={busy || uploading}>{busy ? 'Guardando…' : editing ? 'Guardar evento' : 'Crear evento'}</button>
        </div>
      </form>

      <div className="admin-head" style={{ marginTop: 28 }}>
        <h2 className="section-title">Eventos {list && <small className="muted">({shown.length})</small>}</h2>
        {pastCount > 0 && <label className="check-inline-sm"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Mostrar pasados ({pastCount})</label>}
      </div>
      {!list ? <Spinner /> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Evento</th><th className="num">Precio</th><th className="num">Vendidas</th><th className="num">Quedan</th><th /></tr></thead>
              <tbody>
                {shown.map((ev) => (
                  <tr key={ev._id} className={ev.active && !isPast(ev) ? '' : 'row-off'}>
                    <td className="nowrap">{formatEventDate(ev.event?.startsAt)}</td>
                    <td>
                      <strong>{ev.name}</strong>
                      {!ev.active && <span className="badge badge-muted"> Oculto</span>}
                      {isPast(ev) && <span className="badge badge-muted"> Pasado</span>}
                      {ev.event?.location && <small className="sub">{ev.event.location}</small>}
                    </td>
                    <td className="num nowrap">{ev.priceEurCents ? formatEur(ev.priceEurCents) : 'Gratis'}{ev.coinsEnabled !== false && ev.priceCoins > 0 && <small className="sub cc">{formatCoins(ev.priceCoins)} CC</small>}</td>
                    <td className="num"><strong>{ev.sold}</strong></td>
                    <td className="num">{ev.stock ?? '∞'}</td>
                    <td className="num">
                      <div className="row-actions end">
                        <button className="btn btn-light btn-sm" onClick={() => setAttendees(ev)}><Icon name="users" size={14} /> Asistentes</button>
                        <button className="btn btn-light btn-sm" onClick={() => startEdit(ev)}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="muted center">No hay eventos{showPast ? '' : ' próximos'}. Crea el primero arriba.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {attendees && <Attendees ev={attendees} onClose={() => setAttendees(null)} />}
    </>
  );
}
