import { useEffect, useState } from 'react';
import CardArt from './CardArt';
import QuickEditProduct from './QuickEditProduct';
import { useAuth } from '../context/AuthContext';
import Icon, { Coin } from './Icon';
import { useCart } from '../context/CartContext';
import { acceptsCoins, formatCoins, formatEur } from '../utils/format';

export default function ProductCard({ product: initial, onAdd, preview = false }) {
  const { isFav, toggleFav } = useCart();
  const { user } = useAuth() || {};
  const canEdit = !preview && user?.role === 'admin';
  // Tras editar desde la tienda se muestra al momento la versión guardada
  const [product, setProduct] = useState(initial);
  const [editing, setEditing] = useState(false);
  useEffect(() => setProduct(initial), [initial]);
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
          {product.active === false && <span className="flag flag-out">Oculto</span>}
        </div>
        {canEdit && (
          <button className="edit-btn" onClick={() => setEditing(true)} aria-label={`Editar ${product.name}`} title="Editar producto">
            <Icon name="pencil" size={15} />
          </button>
        )}
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
          {acceptsCoins(product) ? (
            <>
              <span className="sep" />
              <span className="cc">{formatCoins(product.priceCoins)} <Coin size={12} /></span>
            </>
          ) : <span className="only-eur">Solo €</span>}
        </div>
        {product.stock > 0 && product.stock <= 5 && <span className="low-stock">¡Solo quedan {product.stock}!</span>}
      </div>

      <button className="btn btn-dark btn-block" disabled={soldOut} onClick={() => onAdd && onAdd(product)}>
        <Icon name="cart" size={16} /> {soldOut ? 'Sin existencias' : 'Añadir al carrito'}
      </button>
      {editing && (
        <QuickEditProduct
          product={product}
          onClose={() => setEditing(false)}
          onSaved={(p) => { setProduct(p); setEditing(false); }}
        />
      )}
    </article>
  );
}
