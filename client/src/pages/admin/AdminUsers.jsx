import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api';
import Icon, { Coin } from '../../components/Icon';
import { CodePill, Empty, Spinner, StatusBadge, toast } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { eurosToCents, formatCoins, formatDate, formatEur, formatPrice, initials, orderNo } from '../../utils/format';

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    api(`/admin/users${qs({ q })}`)
      .then((l) => {
        setList(l);
        setSelected((s) => s || l[0]?.id || null);
      })
      .catch((e) => toast(e.message, 'bad'));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="muted">Edita datos y saldos. La contraseña solo la puede cambiar cada usuario.</p>
        </div>
      </div>

      <div className="users-layout">
        <aside className="card user-list">
          <label className="search-box small">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, DNI o correo" aria-label="Buscar usuario" />
          </label>
          {!list ? <Spinner /> : list.length === 0 ? <p className="muted pad">Sin resultados.</p> : (
            <ul>
              {list.map((u) => (
                <li key={u.id}>
                  <button className={`user-row${selected === u.id ? ' on' : ''}`} onClick={() => setSelected(u.id)}>
                    <span className={`avatar${selected === u.id ? '' : ' avatar-light'}`}>{initials(u.fullName)}</span>
                    <span className="user-row-text">
                      <strong>{u.fullName}</strong>
                      <small>{u.email}</small>
                    </span>
                    <span className="cc small-strong">{formatCoins(u.balanceCoins)} CC</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {selected ? <UserEditor key={selected} id={selected} onSaved={load} /> : <div className="card"><Empty icon="users" title="Elige un usuario" /></div>}
      </div>
    </>
  );
}

function UserEditor({ id, onSaved }) {
  const { user: me, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [f, setF] = useState(null);
  const [topup, setTopup] = useState({ currency: 'EUR', amount: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/admin/users/${id}`).then((d) => {
      setData(d);
      setF({ fullName: d.user.fullName, dni: d.user.dni, email: d.user.email, role: d.user.role, active: d.user.active });
    }).catch((e) => toast(e.message, 'bad'));
  }, [id]);

  useEffect(load, [load]);

  if (!data || !f) return <div className="card"><Spinner /></div>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const after = async (msg) => {
    toast(msg);
    load();
    onSaved();
    if (String(id) === String(me.id)) await refresh();
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: f });
      await after('Usuario actualizado');
    } catch (err) { toast(err.message, 'bad'); } finally { setBusy(false); }
  };

  const doTopup = async (e) => {
    e.preventDefault();
    const amount = topup.currency === 'EUR' ? eurosToCents(topup.amount) : Math.round(Number(topup.amount));
    if (!amount) {
      toast('Cantidad no válida', 'bad');
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/users/${id}/topup`, { method: 'POST', body: { currency: topup.currency, amount, note: topup.note } });
      setTopup({ ...topup, amount: '', note: '' });
      await after(amount > 0 ? 'Saldo recargado' : 'Saldo descontado');
    } catch (err) { toast(err.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <div className="user-detail">
      <form className="card form" onSubmit={save}>
        <label>Nombre completo<input required value={f.fullName} onChange={set('fullName')} /></label>
        <div className="form-2">
          <label>DNI<input required value={f.dni} onChange={set('dni')} /></label>
          <label>Correo electrónico<input required type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <div className="form-2">
          <label>Rol
            <select value={f.role} onChange={set('role')}>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="check check-inline"><input type="checkbox" checked={f.active} onChange={set('active')} /> Cuenta activa</label>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>Guardar cambios</button>
        </div>
      </form>

      <form className="card form" onSubmit={doTopup}>
        <div className="balance-row">
          <div><span className="stat-label">CHIKACOINS</span><strong className="stat-value tone-cc"><Coin size={18} /> {formatCoins(data.user.balanceCoins)}</strong></div>
          <div><span className="stat-label">Saldo en euros</span><strong className="stat-value">{formatEur(data.user.balanceEurCents)}</strong></div>
        </div>
        <div className="form-3">
          <label>Moneda
            <select value={topup.currency} onChange={(e) => setTopup({ ...topup, currency: e.target.value })}>
              <option value="EUR">Euros</option>
              <option value="COINS">CHIKACOINS</option>
            </select>
          </label>
          <label>Cantidad
            <input required inputMode="decimal" value={topup.amount} onChange={(e) => setTopup({ ...topup, amount: e.target.value })} placeholder={topup.currency === 'EUR' ? '20,00 (o -5,00 para restar)' : '500 (o -100 para restar)'} />
          </label>
          <label>Nota<input value={topup.note} onChange={(e) => setTopup({ ...topup, note: e.target.value })} placeholder="Pago en efectivo…" /></label>
        </div>
        <div className="form-actions">
          <button className="btn btn-dark" disabled={busy}>Aplicar al saldo</button>
        </div>
      </form>

      <div className="card table-card">
        <h3 className="pad">Últimos pedidos</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Pedido</th><th>Código</th><th>Fecha</th><th className="num">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o._id}>
                  <td><strong>{orderNo(o.orderNumber)}</strong></td>
                  <td><CodePill code={o.code} /></td>
                  <td className="muted">{formatDate(o.createdAt)}</td>
                  <td className="num"><strong>{formatPrice(o.total, o.currency)}</strong></td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
              {data.orders.length === 0 && <tr><td colSpan={5} className="muted center">Sin pedidos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
