import { useEffect, useState } from 'react';
import Icon from './Icon';
import { STATUS } from '../utils/format';

export function StatusBadge({ status, user = false }) {
  const s = STATUS[status] || { label: status, userLabel: status, tone: 'muted' };
  return <span className={`badge badge-${s.tone}`}>{user ? s.userLabel : s.label}</span>;
}

export function CodePill({ code }) {
  return <span className="code-pill">{code}</span>;
}

/* ---------- Avisos (toasts) ---------- */
let pushToast = () => {};
export const toast = (msg, tone = 'ok') => pushToast({ msg, tone, id: Math.random() });

export function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    pushToast = (t) => {
      setList((l) => [...l, t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3500);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <Icon name={t.tone === 'bad' ? 'close' : 'check'} size={16} /> {t.msg}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" aria-label="Cargando"><span /></div>;
}

export function Empty({ icon = 'box', title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value${tone ? ` tone-${tone}` : ''}`}>{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
