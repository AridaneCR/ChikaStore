import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api';
import Icon from '../../components/Icon';
import { CodePill, Modal, Spinner, StatusBadge, toast } from '../../components/ui';
import { formatDateTime, formatPrice, orderNo, PAID_WITH, STATUS } from '../../utils/format';

const NEXT = {
  sin_pagar: [['pagado', 'Marcar pagado'], ['cancelado', 'Cancelar pedido']],
  pagado: [['entregado', 'Marcar recogido'], ['sin_pagar', 'Desmarcar pago'], ['cancelado', 'Cancelar y devolver']],
  entregado: [['pagado', 'Volver a pagado']],
  cancelado: [],
};

export default function AdminOrders({ onChange }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    api(`/admin/orders${qs({ q, status, page, limit: 20 })}`).then(setData).catch((e) => toast(e.message, 'bad'));
  }, [q, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const refresh = (o) => {
    if (o) setSelected(o);
    load();
    if (onChange) onChange();
  };

  const markPaid = async (o) => {
    try {
      await api(`/admin/orders/${o._id}`, { method: 'PATCH', body: { status: 'pagado' } });
      toast(`Pedido ${o.code} marcado como pagado`);
      refresh();
    } catch (e) {
      toast(e.message, 'bad');
    }
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2>Pedidos</h2>
        <div className="head-tools">
          <select className="select-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="search-box small">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nº pedido, código o DNI" aria-label="Buscar pedidos" />
          </label>
        </div>
      </div>

      {!data ? <Spinner /> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Pedido</th><th>Código</th><th>Cliente</th><th className="num">Total</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o._id}>
                    <td><strong>{orderNo(o.orderNumber)}</strong><small className="sub">{formatDateTime(o.createdAt)}</small></td>
                    <td><CodePill code={o.code} /></td>
                    <td>{o.user?.fullName}<small className="sub">{o.user?.dni}</small></td>
                    <td className="num"><strong>{formatPrice(o.total, o.currency)}</strong></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      <div className="row-actions">
                        {o.status === 'sin_pagar' && <button className="btn btn-primary btn-sm" onClick={() => markPaid(o)}>Marcar pagado</button>}
                        <button className="btn btn-light btn-sm" onClick={() => setSelected(o)}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={6} className="muted center">No hay pedidos.</td></tr>}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="pager">
              <button className="btn btn-light btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>{data.page} / {data.pages} · {data.total} pedidos</span>
              <button className="btn btn-light btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </div>
      )}

      {selected && <OrderEditor order={selected} onClose={() => setSelected(null)} onSaved={refresh} />}
    </section>
  );
}

function OrderEditor({ order, onClose, onSaved }) {
  const [qty, setQty] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const editable = order.status === 'sin_pagar';

  useEffect(() => {
    setQty(Object.fromEntries(order.items.map((i) => [i.product, i.quantity])));
    setNote(order.adminNote || '');
  }, [order]);

  const patch = async (body, msg) => {
    setBusy(true);
    try {
      const o = await api(`/admin/orders/${order._id}`, { method: 'PATCH', body });
      toast(msg);
      onSaved(o);
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const changed = order.items.some((i) => qty[i.product] !== undefined && Number(qty[i.product]) !== i.quantity);
  const total = order.items.reduce((s, i) => s + i.unitPrice * (Number(qty[i.product] ?? i.quantity) || 0), 0);

  return (
    <Modal title={`Pedido ${orderNo(order.orderNumber)}`} subtitle={formatDateTime(order.createdAt)} onClose={onClose} wide>
      <div className="meta-grid">
        <div><small>Código</small><CodePill code={order.code} /></div>
        <div><small>Cliente</small><strong>{order.user?.fullName}</strong><small>{order.user?.dni} · {order.user?.email}</small></div>
        <div><small>Estado</small><StatusBadge status={order.status} /></div>
        <div><small>Pago</small><strong>{order.paidWith ? PAID_WITH[order.paidWith] : '—'}</strong><small>{order.paidAt ? formatDateTime(order.paidAt) : ''}</small></div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Producto</th><th className="num">Precio</th><th className="num">Cant.</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.product}>
                <td>{i.name}</td>
                <td className="num">{formatPrice(i.unitPrice, order.currency)}</td>
                <td className="num">
                  {editable ? (
                    <input className="qty-input" type="number" min="0" max="99" value={qty[i.product] ?? i.quantity} onChange={(e) => setQty({ ...qty, [i.product]: e.target.value })} aria-label={`Cantidad de ${i.name}`} />
                  ) : i.quantity}
                </td>
                <td className="num">{formatPrice(i.unitPrice * (Number(qty[i.product] ?? i.quantity) || 0), order.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>Total</td><td className="num"><strong>{formatPrice(total, order.currency)}</strong></td></tr></tfoot>
        </table>
      </div>
      {editable && <p className="hint">Pon una cantidad a 0 para quitar el producto. Solo se pueden editar los pedidos sin pagar.</p>}
      {changed && (
        <button className="btn btn-dark" disabled={busy} onClick={() => patch({ items: Object.entries(qty).map(([productId, q]) => ({ productId, quantity: Number(q) })) }, 'Productos actualizados')}>
          Guardar cantidades
        </button>
      )}

      <label className="field">Nota interna
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Solo la ve el admin" />
      </label>
      {note !== (order.adminNote || '') && (
        <button className="btn btn-light btn-sm" disabled={busy} onClick={() => patch({ adminNote: note }, 'Nota guardada')}>Guardar nota</button>
      )}

      <div className="modal-actions">
        {NEXT[order.status].map(([s, label]) => (
          <button
            key={s}
            className={`btn ${s === 'cancelado' ? 'btn-danger-outline' : s === 'pagado' ? 'btn-primary' : 'btn-dark'}`}
            disabled={busy || changed}
            onClick={() => {
              if (s === 'cancelado' && !window.confirm('¿Cancelar este pedido? Se devolverá el stock y, si estaba pagado, el importe al saldo del cliente.')) return;
              patch({ status: s }, `Pedido: ${STATUS[s].label}`);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
