import { useState } from 'react';
import { api } from '../api';
import CardArt from '../components/CardArt';
import Icon, { Coin } from '../components/Icon';
import { CodePill, Empty, Modal, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { navigate } from '../router';
import { formatCoins, formatEur, formatPrice, orderNo } from '../utils/format';

export default function Cart() {
  const { lines, setQty, clear, totals } = useCart();
  const { user, refresh } = useAuth();
  const [currency, setCurrency] = useState('COINS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  if (!lines.length && !done) {
    return (
      <div className="page">
        <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>Carrito</nav>
        <Empty icon="cart" title="Tu carrito está vacío"><a href="#/productos">Ver productos</a></Empty>
      </div>
    );
  }

  const coins = currency === 'COINS';
  const total = coins ? totals.coins : totals.eurCents;
  const balance = coins ? user.balanceCoins : user.balanceEurCents;
  const enough = balance >= total;
  const willBePaid = enough; // COINS sin saldo no deja comprar; EUR sin saldo queda pendiente
  const fmt = (v) => formatPrice(v, currency);

  const checkout = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: { currency, items: lines.map((l) => ({ productId: l.product._id, quantity: l.quantity })) },
      });
      clear();
      await refresh();
      setDone(order);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-mid">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>Carrito</nav>
      <h1 className="page-title">Tu carrito <small>({totals.count} {totals.count === 1 ? 'artículo' : 'artículos'})</small></h1>

      <div className="cart-layout">
        <div className="cart-lines">
          {lines.map(({ product, quantity }) => (
            <div key={product._id} className="card cart-line">
              <div className="cart-thumb"><CardArt product={product} size={26} /></div>
              <div className="cart-info">
                <strong>{product.name}</strong>
                <small>{formatEur(product.priceEurCents)} · {formatCoins(product.priceCoins)} CC / ud.</small>
              </div>
              <div className="stepper">
                <button onClick={() => setQty(product._id, quantity - 1)} aria-label="Quitar uno">−</button>
                <span>{quantity}</span>
                <button onClick={() => setQty(product._id, quantity + 1)} aria-label="Añadir uno">+</button>
              </div>
              <strong className="cart-line-total">{fmt((coins ? product.priceCoins : product.priceEurCents) * quantity)}</strong>
              <button className="icon-btn ghost" onClick={() => setQty(product._id, 0)} aria-label={`Eliminar ${product.name}`}><Icon name="trash" size={18} /></button>
            </div>
          ))}
          <div className="notice notice-warn"><Icon name="store" size={18} /> Los pedidos se recogen en la tienda física. Te daremos un código para recogerlo.</div>
        </div>

        <aside className="card checkout">
          <h2>¿Cómo quieres pagar?</h2>

          <label className={`pay-option${coins ? ' selected' : ''}`}>
            <input type="radio" name="cur" checked={coins} onChange={() => setCurrency('COINS')} />
            <span className="pay-head"><Coin size={16} /> CHIKACOINS</span>
            <span className="pay-total cc">{formatCoins(totals.coins)}</span>
            <small>
              {user.balanceCoins >= totals.coins
                ? <>Se descuenta de tu saldo. El pedido queda <strong className="green">pagado</strong> al instante.</>
                : <>No te llega el saldo: te faltan <strong>{formatCoins(totals.coins - user.balanceCoins)} CC</strong>.</>}
            </small>
          </label>

          <label className={`pay-option${!coins ? ' selected' : ''}`}>
            <input type="radio" name="cur" checked={!coins} onChange={() => setCurrency('EUR')} />
            <span className="pay-head"><Icon name="wallet" size={16} className="blue" /> EUROS</span>
            <span className="pay-total">{formatEur(totals.eurCents)}</span>
            <small>
              {user.balanceEurCents >= totals.eurCents ? 'Se descuenta de tu saldo en €' : 'Pagas al recoger en tienda'} y ganas{' '}
              <strong className="cc">+{formatCoins(totals.eurCents)} CC</strong>.
            </small>
          </label>

          <dl className="summary">
            <div><dt>Subtotal</dt><dd>{fmt(total)}</dd></div>
            <div><dt>Estado del pedido</dt><dd><StatusBadge status={willBePaid ? 'pagado' : 'sin_pagar'} user /></dd></div>
            <div><dt>Saldo tras la compra</dt><dd>{enough ? fmt(balance - total) : fmt(balance)}</dd></div>
          </dl>
          <div className="summary-total"><span>Total</span><strong>{fmt(total)}</strong></div>

          {error && <div className="alert">{error}</div>}

          <button className="btn btn-primary btn-lg btn-block" disabled={busy || (coins && !enough)} onClick={checkout}>
            {busy ? 'Procesando…' : coins ? 'Pagar con CHIKACOINS' : enough ? 'Pagar con saldo en €' : 'Reservar y pagar en tienda'}
          </button>
        </aside>
      </div>

      {done && (
        <Modal title="¡Pedido realizado!" onClose={() => navigate('/pedidos')}>
          <div className="order-done">
            <span className="done-icon"><Icon name="check" size={28} stroke={2.4} /></span>
            <p className="muted">Pedido {orderNo(done.orderNumber)}</p>
            <div className="order-code-big"><CodePill code={done.code} /></div>
            <p>
              {done.status === 'pagado'
                ? 'Está pagado. Enseña este código en la tienda para recogerlo.'
                : 'Está pendiente de pago. Ve a la tienda con este código para pagarlo y recogerlo.'}
            </p>
            {done.coinsEarned > 0 && <p className="earned"><Coin size={14} /> +{formatCoins(done.coinsEarned)} CHIKACOINS ganadas</p>}
            <button className="btn btn-primary btn-block" onClick={() => navigate('/pedidos')}>Ver mis pedidos</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
