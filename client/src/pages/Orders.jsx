import { useEffect, useState } from 'react';
import { api } from '../api';
import Icon, { Coin } from '../components/Icon';
import { CodePill, Empty, Modal, Spinner, Stat, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { formatCoins, formatDate, formatEur, formatPrice, orderNo, PAID_WITH } from '../utils/format';

const FILTERS = [
  ['todos', 'Todos', () => true],
  ['pendientes', 'Pendientes', (o) => o.status === 'sin_pagar'],
  ['pagados', 'Pagados', (o) => o.status === 'pagado'],
  ['recogidos', 'Recogidos', (o) => o.status === 'entregado'],
];

const count = (o) => o.items.reduce((s, i) => s + i.quantity, 0);

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('todos');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders/mine').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><div className="alert">{error}</div></div>;
  if (!orders) return <div className="page"><Spinner /></div>;

  const pending = orders.filter((o) => o.status === 'sin_pagar').length;
  const list = orders.filter(FILTERS.find((f) => f[0] === filter)[2]);

  return (
    <div className="page page-mid">
      <h1 className="page-title">Mis pedidos</h1>

      <div className="stat-row">
        <Stat label="Saldo CHIKACOINS" value={<><Coin size={20} /> {formatCoins(user.balanceCoins)}</>} tone="cc" />
        <Stat label="Saldo en euros" value={formatEur(user.balanceEurCents)} />
        <Stat label="Pendientes de pago" value={`${pending} ${pending === 1 ? 'pedido' : 'pedidos'}`} tone="warn" />
      </div>

      <div className="pills">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`pill${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty icon="receipt" title="No hay pedidos aquí">Cuando hagas un pedido aparecerá en esta lista.</Empty>
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table table-click">
              <thead>
                <tr><th>Nº pedido</th><th>Código</th><th>Fecha</th><th>Artículos</th><th>Pago</th><th className="num">Total</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o._id} onClick={() => setSelected(o)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(o)}>
                    <td><strong>{orderNo(o.orderNumber)}</strong></td>
                    <td><CodePill code={o.code} /></td>
                    <td className="muted">{formatDate(o.createdAt)}</td>
                    <td className="muted">{count(o)} {count(o) === 1 ? 'artículo' : 'artículos'}</td>
                    <td>{o.currency === 'COINS' ? 'CHIKACOINS' : 'Euros'}</td>
                    <td className="num"><strong>{formatPrice(o.total, o.currency)}</strong></td>
                    <td><StatusBadge status={o.status} user /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <Modal title={`Pedido ${orderNo(selected.orderNumber)}`} subtitle={formatDate(selected.createdAt)} onClose={() => setSelected(null)}>
          <div className="order-done compact">
            <CodePill code={selected.code} />
            <StatusBadge status={selected.status} user />
          </div>
          <ul className="line-list">
            {selected.items.map((i) => (
              <li key={i.product}><span>{i.quantity}× {i.name}</span><strong>{formatPrice(i.unitPrice * i.quantity, selected.currency)}</strong></li>
            ))}
          </ul>
          <div className="summary-total"><span>Total</span><strong>{formatPrice(selected.total, selected.currency)}</strong></div>
          <p className="muted">
            {selected.paidWith ? `Pagado con: ${PAID_WITH[selected.paidWith]}.` : 'Pendiente: págalo en la tienda al recogerlo.'}
            {selected.coinsEarned > 0 && <> Ganaste <strong className="cc">+{formatCoins(selected.coinsEarned)} CC</strong>.</>}
          </p>
          {selected.status !== 'entregado' && selected.status !== 'cancelado' && (
            <div className="notice notice-warn"><Icon name="store" size={18} /> Enseña el código <strong>{selected.code}</strong> en la tienda para recogerlo.</div>
          )}
        </Modal>
      )}
    </div>
  );
}
