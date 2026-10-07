import { useEffect, useState } from 'react';
import { api, qs } from '../api';
import Icon, { CATEGORY_ICONS, Coin, LogoMark } from '../components/Icon';
import ProductCard from '../components/ProductCard';
import { Empty, Spinner, toast } from '../components/ui';
import { useCart } from '../context/CartContext';
import { CATEGORIES } from '../utils/format';

const SLIDES = [
  { tag: 'Reserva online · Recoge en tienda', sub: 'Tu tienda de cartas, juegos y mucho más' },
  { tag: 'Gana CHIKACOINS', sub: '100 CHIKACOINS por cada euro que gastes' },
  { tag: 'Paga con monedas', sub: 'Con CHIKACOINS tu pedido queda pagado al momento' },
];
const HERO_CATS = [['Fundas', 'funda'], ['Sobres', 'sobre'], ['Bebidas', 'bebida'], ['Snacks', 'snack'], ['Accesorios TCG', 'box', 'Accesorios'], ['Juegos de mesa', 'juego', 'Juegos']];

export function useAddToCart() {
  const { add } = useCart();
  return (p) => {
    add(p);
    toast(`${p.name} añadido al carrito`);
  };
}

function useProducts(params) {
  const [data, setData] = useState(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    let alive = true;
    api(`/products${qs(params)}`).then((d) => alive && setData(d)).catch(() => alive && setData({ items: [] }));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

export function CategoryGrid() {
  return (
    <div className="cat-grid">
      {CATEGORIES.map((c) => (
        <a key={c} href={`#/productos?category=${encodeURIComponent(c)}`} className="cat-tile">
          <Icon name={CATEGORY_ICONS[c]} size={40} stroke={1.6} />
          <span>{c}</span>
        </a>
      ))}
    </div>
  );
}

function Section({ icon, title, link, params }) {
  const onAdd = useAddToCart();
  const data = useProducts({ ...params, limit: 6 });
  if (data && data.items.length === 0) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2><Icon name={icon} size={20} className={icon === 'flame' ? 'red' : ''} /> {title}</h2>
        <a href={link} className="see-all">Ver todos <Icon name="arrowRight" size={14} /></a>
      </div>
      {!data ? <Spinner /> : (
        <div className="product-grid">
          {data.items.map((p) => <ProductCard key={p._id} product={p} onAdd={onAdd} />)}
        </div>
      )}
    </section>
  );
}

export default function Shop() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">{SLIDES[slide].tag}</span>
          <h1 className="display hero-title">CHIKAKU<span>SHOP</span></h1>
          <p className="hero-sub">{SLIDES[slide].sub}</p>
          <div className="hero-cats">
            {HERO_CATS.map(([cat, icon, label]) => (
              <a key={cat} href={`#/productos?category=${encodeURIComponent(cat)}`}>
                <Icon name={icon} size={24} stroke={1.6} />
                <span>{label || cat}</span>
              </a>
            ))}
          </div>
          <div className="hero-actions">
            <a href="#/productos" className="btn btn-primary btn-lg">Ver productos <Icon name="arrowRight" size={16} /></a>
            <a href="#/chikacoins" className="btn btn-outline-light btn-lg">¿Qué son las CHIKACOINS?</a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <svg className="hero-sigil" viewBox="0 0 400 400">
            <circle cx="200" cy="200" r="190" /><circle cx="200" cy="200" r="150" />
            <path d="M200 10 365 105v190L200 390 35 295V105Z" /><path d="M200 50 330 290H70Z" />
          </svg>
          <div className="tcg tcg-back tcg-l" />
          <div className="tcg tcg-back tcg-r" />
          <div className="tcg tcg-front">
            <div className="tcg-frame">
              <LogoMark size={96} />
              <span>CHIKAKU</span>
            </div>
          </div>
          <span className="hero-coin"><Coin size={64} label /></span>
        </div>
        <div className="hero-dots">
          {SLIDES.map((s, i) => (
            <button key={s.tag} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} aria-label={`Diapositiva ${i + 1}`} />
          ))}
        </div>
      </section>

      <section className="perks">
        <div className="card perk-card"><span className="perk-icon"><Icon name="store" /></span><div><strong>Reserva y recoge</strong><p>Haz tu pedido online y pásate por la tienda.</p></div></div>
        <div className="card perk-card"><span className="perk-icon"><Icon name="target" /></span><div><strong>1 € = 100 CHIKACOINS</strong><p>Cada compra en euros suma monedas a tu saldo.</p></div></div>
        <div className="card perk-card"><span className="perk-icon"><Icon name="zap" /></span><div><strong>Paga con monedas</strong><p>Con CHIKACOINS tu pedido queda pagado al momento.</p></div></div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Explora por categoría</h2></div>
        <CategoryGrid />
      </section>

      <Section icon="flame" title="Productos destacados" link="#/productos?tag=destacado" params={{ tag: 'destacado' }} />
      <Section icon="star" title="Novedades" link="#/productos?tag=nuevo" params={{ tag: 'nuevo', sort: 'new' }} />
      <Section icon="tag" title="Ofertas" link="#/productos?tag=oferta" params={{ tag: 'oferta' }} />
    </div>
  );
}

/* ----------------------------- Catálogo ----------------------------- */

const TAG_TITLES = { nuevo: 'Novedades', oferta: 'Ofertas', destacado: 'Productos destacados' };

export function Catalog({ query }) {
  const onAdd = useAddToCart();
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const params = { q: query.q, category: query.category, tag: query.tag, sort, page, limit: 24 };
  const data = useProducts(params);

  useEffect(() => setPage(1), [query.q, query.category, query.tag]);

  const title = query.q ? `Resultados para “${query.q}”` : query.category || TAG_TITLES[query.tag] || 'Todos los productos';
  const chip = (cat) => `#/productos${cat ? `?category=${encodeURIComponent(cat)}` : ''}`;

  return (
    <div className="page">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>{title}</nav>
      <div className="page-head">
        <h1 className="page-title">{title} {data && <small>({data.total} productos)</small>}</h1>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar" className="select-sm">
          <option value="name">Ordenar: nombre</option>
          <option value="new">Más nuevos</option>
          <option value="eur_asc">Precio: menor a mayor</option>
          <option value="eur_desc">Precio: mayor a menor</option>
        </select>
      </div>

      <div className="pills">
        <a href={chip('')} className={`pill${!query.category ? ' on' : ''}`}>Todas</a>
        {CATEGORIES.map((c) => (
          <a key={c} href={chip(c)} className={`pill${query.category === c ? ' on' : ''}`}>{c}</a>
        ))}
      </div>

      {!data ? <Spinner /> : data.items.length === 0 ? (
        <Empty icon="search" title="No hay productos">Prueba con otra búsqueda o categoría.</Empty>
      ) : (
        <>
          <div className="product-grid">
            {data.items.map((p) => <ProductCard key={p._id} product={p} onAdd={onAdd} />)}
          </div>
          {data.pages > 1 && (
            <div className="pager">
              <button className="btn btn-light" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Página {data.page} de {data.pages}</span>
              <button className="btn btn-light" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Categories() {
  return (
    <div className="page">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>Categorías</nav>
      <h1 className="page-title">Categorías</h1>
      <CategoryGrid />
    </div>
  );
}

export function Favorites() {
  const { favs } = useCart();
  const onAdd = useAddToCart();
  return (
    <div className="page">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>Favoritos</nav>
      <h1 className="page-title">Favoritos {favs.length > 0 && <small>({favs.length})</small>}</h1>
      {favs.length === 0 ? (
        <Empty icon="heart" title="Aún no tienes favoritos">Pulsa el corazón de un producto para guardarlo aquí.</Empty>
      ) : (
        <div className="product-grid">{favs.map((p) => <ProductCard key={p._id} product={p} onAdd={onAdd} />)}</div>
      )}
    </div>
  );
}

export function AboutCoins() {
  return (
    <div className="page page-narrow">
      <nav className="crumbs"><a href="#/">Tienda</a><span>/</span>CHIKACOINS</nav>
      <h1 className="page-title">¿Qué son las CHIKACOINS?</h1>
      <div className="card prose">
        <p><strong>Las CHIKACOINS (CC) son la moneda de ChikakuShop.</strong> Cada producto tiene un precio en euros y otro en CHIKACOINS.</p>
        <ul>
          <li><strong>Cómo se ganan:</strong> por cada euro que pagas en un pedido recibes 100 CC. Se suman cuando el pedido queda pagado.</li>
          <li><strong>Cómo se gastan:</strong> en el carrito elige pagar con CHIKACOINS. Se descuentan de tu saldo y el pedido queda pagado al momento.</li>
          <li><strong>Pagar en euros:</strong> si tienes saldo en € se descuenta de ahí. Si no, el pedido queda pendiente y lo pagas al recogerlo en la tienda.</li>
        </ul>
        <p>Cada pedido tiene un código (por ejemplo <span className="code-pill">2026-4821</span>). Enséñalo en la tienda para recogerlo.</p>
        <a href="#/productos" className="btn btn-primary">Ver productos <Icon name="arrowRight" size={16} /></a>
      </div>
    </div>
  );
}
