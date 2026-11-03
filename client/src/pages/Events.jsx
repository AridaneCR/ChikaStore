import { useEffect, useState } from 'react';
import { api } from '../api';
import Icon, { Coin } from '../components/Icon';
import QuickEditProduct from '../components/QuickEditProduct';
import { CodePill, Empty, Spinner, toast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { navigate } from '../router';
import { acceptsCoins, formatCoins, formatEur } from '../utils/format';

const dayNum = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric' });
const monthShort = (d) => new Date(d).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
const longDate = (d) => {
  const s = new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const time = (d) => new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export function useEvents(past = false) {
  const [list, setList] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api(`/events${past ? '?past=1' : ''}`).then((l) => alive && setList(l)).catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [past, tick]);
  return [list, () => setTick((t) => t + 1)];
}

export function EventCard({ ev, onChanged, compact = false }) {
  const { add, lines } = useCart();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const inCart = lines.some((l) => l.product._id === ev._id);
  const soldOut = ev.stock === 0;
  const start = ev.event?.startsAt;
  const end = ev.event?.endsAt;
  const isPast = new Date(end || start) < new Date();

  const buy = () => {
    if (!inCart) add(ev, 1);
    toast('Entrada añadida al carrito');
    navigate('/carrito');
  };

  return (
    <article className={`card event-card${compact ? ' compact' : ''}${ev.owned ? ' owned' : ''}`}>
      <div className="event-media">
        {ev.imageUrl ? <img src={ev.imageUrl} alt="" loading="lazy" /> : <div className="event-media-empty"><Icon name="calendar" size={40} stroke={1.4} /></div>}
        {start && (
          <span className="event-date" aria-hidden="true"><strong>{dayNum(start)}</strong><small>{monthShort(start)}</small></span>
        )}
        {user?.role === 'admin' && (
          <button className="edit-btn edit-btn-right" onClick={() => setEditing(true)} aria-label={`Editar ${ev.name}`} title="Editar evento"><Icon name="pencil" size={15} /></button>
        )}
      </div>
      <div className="event-body">
        <h3>{ev.name}</h3>
        <ul className="event-meta">
          {start && <li><Icon name="calendar" size={15} /> {longDate(start)} · {time(start)}{end ? `–${time(end)}` : ''}</li>}
          {ev.event?.location && <li><Icon name="pin" size={15} /> {ev.event.location}</li>}
          {ev.stock !== null && ev.stock !== undefined && !ev.owned && !isPast && (
            <li className={ev.stock <= 5 ? 'red' : ''}><Icon name="ticket" size={15} /> {soldOut ? 'Entradas agotadas' : `Quedan ${ev.stock} ${ev.stock === 1 ? 'entrada' : 'entradas'}`}</li>
          )}
        </ul>
        {ev.description && <p className="event-desc">{ev.description}</p>}
        {!compact && ev.event?.details && (
          <>
            <button type="button" className="link-btn" onClick={() => setOpen(!open)}>{open ? 'Ocultar detalles' : 'Ver detalles'}</button>
            {open && <p className="event-details">{ev.event.details}</p>}
          </>
        )}
      </div>
      <div className="event-foot">
        <div className="product-price">
          <strong>{ev.priceEurCents ? formatEur(ev.priceEurCents) : 'Gratis'}</strong>
          {acceptsCoins(ev) && ev.priceCoins > 0 && (<><span className="sep" /><span className="cc">{formatCoins(ev.priceCoins)} <Coin size={12} /></span></>)}
        </div>
        {ev.owned ? (
          <span className="ticket-owned"><Icon name="check" size={16} /> Ya tienes tu entrada{ev.myOrder?.code && <> · <CodePill code={ev.myOrder.code} /></>}</span>
        ) : isPast ? (
          <span className="muted">Evento terminado</span>
        ) : (
          <button className="btn btn-primary" disabled={soldOut} onClick={buy}>
            <Icon name="ticket" size={16} /> {soldOut ? 'Agotadas' : inCart ? 'En el carrito' : 'Comprar entrada'}
          </button>
        )}
      </div>
      {editing && <QuickEditProduct product={ev} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged?.(); }} />}
    </article>
  );
}

export default function Events() {
  const [past, setPast] = useState(false);
  const [list, reload] = useEvents(past);
  const mine = (list || []).filter((e) => e.owned);

  return (
    <div className="page">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>Eventos</nav>
      <div className="page-head">
        <h1 className="page-title">Eventos {list && <small>({list.length})</small>}</h1>
        <div className="seg" role="tablist" aria-label="Eventos">
          <button role="tab" aria-selected={!past} className={!past ? 'on' : ''} onClick={() => setPast(false)}>Próximos</button>
          <button role="tab" aria-selected={past} className={past ? 'on' : ''} onClick={() => setPast(true)}>Pasados</button>
        </div>
      </div>
      {!past && mine.length > 0 && (
        <div className="notice"><Icon name="ticket" size={18} className="red" /> Tienes entrada para {mine.length === 1 ? 'un evento' : `${mine.length} eventos`}. Enseña el código del pedido en la tienda.</div>
      )}
      {!list ? <Spinner /> : list.length === 0 ? (
        <Empty icon="calendar" title={past ? 'Todavía no hay eventos pasados' : 'No hay eventos programados'}>Vuelve pronto: aquí aparecerán los torneos y quedadas.</Empty>
      ) : (
        <div className="event-grid">{list.map((ev) => <EventCard key={ev._id} ev={ev} onChanged={reload} />)}</div>
      )}
    </div>
  );
}
