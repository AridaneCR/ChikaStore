import Icon, { CATEGORY_ICONS } from './Icon';

// Imagen del producto o, si no tiene, el icono de su categoría sobre fondo gris.
export default function CardArt({ product, size = 44 }) {
  if (product.imageUrl) {
    return <img className="product-img" src={product.imageUrl} alt={product.name} loading="lazy" />;
  }
  return (
    <span className="product-ph" aria-hidden="true">
      <Icon name={CATEGORY_ICONS[product.category] || 'otros'} size={size} stroke={1.3} />
    </span>
  );
}
