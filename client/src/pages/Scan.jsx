import { useState } from 'react';
import { api } from '../api';
import CardArt from '../components/CardArt';
import Icon, { Coin } from '../components/Icon';
import Scanner from '../components/Scanner';
import { toast } from '../components/ui';
import { useCart } from '../context/CartContext';
import { formatCoins, formatEur } from '../utils/format';

// Escanear en la tienda: cada código leído busca el producto y lo mete en el carrito.
export default function Scan() {
  const { add, setQty, lines, totals } = useCart();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null); // { product } | { notFound: code }
  const [manual, setManual] = useState('');
  const [history, setHistory] = useState([]); // productos escaneados en esta visita

  const lookup = async (code) => {
    setBusy(true);
    try {
      const product = await api(`/products/barcode/${encodeURIComponent(code)}`);
      if (product.stock === 0) {
        setLast({ product, soldOut: true });
        toast(`${product.name} está agotado`, 'bad');
        return;
      }
      add(product);
      setLast({ product });
      setHistory((h) => [product, ...h.filter((p) => p._id !== product._id)].slice(0, 20));
      toast(`${product.name} añadido al carrito`);
    } catch (e) {
      setLast({ notFound: code, message: e.status === 404 ? null : e.message });
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } finally {
      setBusy(false);
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    setManual('');
    lookup(code);
  };

  const qtyOf = (id) => lines.find((l) => l.product._id === id)?.quantity || 0;

  return (
    <div className="page page-narrow scan-page">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>Escanear</nav>
      <div className="page-head">
        <h1 className="page-title">Escanear productos</h1>
        <a href="#/carrito" className="btn btn-dark">
          <Icon name="cart" size={16} /> Carrito {totals.count > 0 && `(${totals.count})`}
        </a>
      </div>
      <p className="muted scan-help">Apunta la cámara al código de barras del producto. Se añade solo al carrito y puedes seguir escaneando.</p>

      <Scanner onDetect={lookup} paused={busy} />

      {last && (
        <div className={`card scan-result${last.notFound ? ' scan-miss' : ''}`} role="status" aria-live="polite">
          {last.notFound ? (
            <>
              <span className="scan-result-icon bad"><Icon name="close" size={20} /></span>
              <div>
                <strong>Código no encontrado</strong>
                <p className="muted">{last.message || `El código ${last.notFound} no corresponde a ningún producto de la tienda.`}</p>
              </div>
            </>
          ) : (
            <>
              <div className="scan-thumb"><CardArt product={last.product} size={24} /></div>
              <div className="scan-info">
                <strong>{last.product.name}</strong>
                <small>
                  {formatEur(last.product.priceEurCents)} · {formatCoins(last.product.priceCoins)} <Coin size={10} />
                  {last.soldOut && <span className="badge badge-bad"> Agotado</span>}
                </small>
              </div>
              {!last.soldOut && (
                <div className="stepper">
                  <button onClick={() => setQty(last.product._id, qtyOf(last.product._id) - 1)} aria-label="Quitar uno">−</button>
                  <span>{qtyOf(last.product._id)}</span>
                  <button onClick={() => setQty(last.product._id, qtyOf(last.product._id) + 1)} aria-label="Añadir uno">+</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <form className="scan-manual" onSubmit={submitManual}>
        <label className="search-box">
          <Icon name="keyboard" size={18} />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="¿No lo lee? Escribe el número del código"
            aria-label="Escribir código de barras"
          />
        </label>
        <button className="btn btn-light" disabled={busy || !manual.trim()}>Buscar</button>
      </form>

      {history.length > 1 && (
        <section className="section">
          <h2 className="section-title">Escaneado ahora</h2>
          <ul className="line-list card pad">
            {history.map((p) => (
              <li key={p._id}><span>{qtyOf(p._id)}× {p.name}</span><span className="muted">{formatEur(p.priceEurCents)}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
