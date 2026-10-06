import CardArt from './CardArt';
import Icon, { Coin } from './Icon';
import { useCart } from '../context/CartContext';
import { formatCoins, formatEur } from '../utils/format';

export default function ProductCard({ product, onAdd, preview = false }) {
  const { isFav, toggleFav } = useCart();
  const soldOut = product.stock === 0;
  const tags = product.tags || [];
  const fav = !preview && isFav(product._id);

  return (
    <article className={`product-card${soldOut ? ' sold-out' : ''}`}>
      <div className="product-media">
        <CardArt product={product} />
        <div className="product-flags">
          {tags.includes('nuevo') && <span className="flag flag-new">Nuevo</span>}
          {tags.includes('oferta') && <span className="flag flag-sale">Oferta</span>}
          {soldOut && <span className="flag flag-out">Agotado</span>}
        </div>
        {!preview && (
          <button
            className={`fav-btn${fav ? ' on' : ''}`}
            onClick={() => toggleFav(product)}
            aria-label={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            aria-pressed={fav}
          >
            <Icon name="heart" size={16} />
          </button>
        )}
      </div>

      <div className="product-body">
        <h3>{product.name || 'Nombre del producto'}</h3>
        {product.description && <p className="product-desc">{product.description}</p>}
        <div className="product-price">
          <strong>{formatEur(product.priceEurCents)}</strong>
          <span className="sep" />
          <span className="cc">{formatCoins(product.priceCoins)} <Coin size={12} /></span>
        </div>
        {product.stock > 0 && product.stock <= 5 && <span className="low-stock">¡Solo quedan {product.stock}!</span>}
      </div>

      <button className="btn btn-dark btn-block" disabled={soldOut} onClick={() => onAdd && onAdd(product)}>
        <Icon name="cart" size={16} /> {soldOut ? 'Sin existencias' : 'Añadir al carrito'}
      </button>
    </article>
  );
}
