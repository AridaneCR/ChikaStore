import { useEffect, useState } from 'react';
import { api } from '../api';
import { Coin } from '../components/Icon';
import { Stat } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { formatCoins, formatDate, formatEur, initials } from '../utils/format';

const TYPES = { recarga: 'Recarga', compra: 'Compra', recompensa: 'Recompensa', devolucion: 'Devolución', ajuste: 'Ajuste' };

export default function Profile() {
  const { user } = useAuth();
  const [moves, setMoves] = useState([]);

  useEffect(() => {
    api('/orders/mine/movements').then(setMoves).catch(() => {});
  }, []);

  return (
    <div className="page page-mid">
      <h1 className="page-title">Mi perfil</h1>

      <div className="card profile-head">
        <span className="avatar avatar-lg">{initials(user.fullName)}</span>
        <div>
          <h2>{user.fullName}</h2>
          <p className="muted">{user.email} · DNI {user.dni} · Cliente desde {formatDate(user.createdAt)}</p>
        </div>
      </div>

      <div className="stat-row two">
        <Stat label="Saldo CHIKACOINS" value={<><Coin size={20} /> {formatCoins(user.balanceCoins)}</>} tone="cc" sub="Ganas 100 CC por cada euro pagado" />
        <Stat label="Saldo en euros" value={formatEur(user.balanceEurCents)} sub="Recárgalo en la tienda física" />
      </div>

      <h2 className="section-title">Últimos movimientos</h2>
      <div className="card table-card">
        {moves.length === 0 ? <p className="muted pad">Sin movimientos todavía.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th className="num">Cantidad</th><th>Nota</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m._id}>
                    <td className="muted">{formatDate(m.createdAt)}</td>
                    <td>{TYPES[m.type]}</td>
                    <td className={`num ${m.amount < 0 ? 'neg' : 'pos'}`}>
                      {m.amount > 0 ? '+' : ''}{m.currency === 'EUR' ? formatEur(m.amount) : `${formatCoins(m.amount)} CC`}
                    </td>
                    <td className="muted">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
