import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Spinner, Stat } from '../../components/ui';
import { formatCoins, formatEur } from '../../utils/format';
import AdminOrders from './AdminOrders';
import BarChart from './BarChart';

const PERIODS = { day: 'Diario', month: 'Mensual', year: 'Anual' };

function scopeLabel(period, today) {
  const d = new Date(`${today}T12:00:00`);
  if (period === 'day') return `hoy, ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
  if (period === 'month') return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return `año ${today.slice(0, 4)}`;
}

export default function Dashboard() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api(`/admin/overview?period=${period}`).then(setData).catch((e) => setError(e.message));
  }, [period, tick]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="muted">Gasto de los clientes y pedidos · {data ? scopeLabel(period, data.today) : '…'}</p>
        </div>
        <div className="seg" role="tablist" aria-label="Periodo">
          {Object.entries(PERIODS).map(([k, v]) => (
            <button key={k} role="tab" aria-selected={period === k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{v}</button>
          ))}
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {!data ? <Spinner /> : (
        <>
          <div className="stat-row four">
            <Stat label="Ingresos en €" value={formatEur(data.revenueEurCents)} sub="Cobrado (tienda y saldo)" />
            <Stat label="CHIKACOINS canjeadas" value={formatCoins(data.coinsRedeemed)} sub="Pedidos pagados con CC" tone="cc" />
            <Stat label="Pedidos" value={formatCoins(data.orders.total)} sub={`${data.orders.eur} en €, ${data.orders.coins} en CC`} />
            <Stat label="Pendientes de cobro" value={data.pending.orders} sub={`${formatEur(data.pending.eurCents)} por cobrar`} tone="warn" />
          </div>

          <section className="card chart-card">
            <div className="chart-head">
              <h2>Euros gastados por los clientes</h2>
              <span className="muted small">{period === 'day' ? 'Últimos 14 días' : period === 'month' ? 'Por semanas' : 'Por meses'}</span>
            </div>
            <BarChart
              data={data.series.map((s) => ({ label: s.label, value: s.eurCents }))}
              format={formatEur}
              short={(v) => formatCoins(Math.round(v / 100))}
            />
          </section>
        </>
      )}

      <AdminOrders onChange={() => setTick((t) => t + 1)} />
    </>
  );
}
