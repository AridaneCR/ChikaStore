import { useEffect, useRef, useState } from 'react';
import Icon, { Coin, LogoMark } from './Icon';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { href, navigate } from '../router';
import { formatCoins, formatEur, initials } from '../utils/format';

export function Brand({ sub = 'Cartas · Juegos · Snacks · Y más', dark = false }) {
  return (
    <a href="#/" className={`brand${dark ? ' brand-dark' : ''}`} aria-label="CHIKASTORE, ir al inicio">
      <LogoMark size={dark ? 34 : 44} />
      <span className="brand-text">
        <span className="brand-name">CHIKA<span>STORE</span></span>
        {sub && <span className="brand-sub">{sub}</span>}
      </span>
    </a>
  );
}

export default function Navbar({ route }) {
  const { user, logout } = useAuth();
  const { totals, favs } = useCart();
  const [q, setQ] = useState(route.query.q || '');
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => setQ(route.query.q || ''), [route.query.q]);

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const search = (e) => {
    e.preventDefault();
    navigate(href('/productos', { q: q.trim() }).slice(1));
  };

  const isActive = (path, tag) => route.path === path && (route.query.tag || '') === (tag || '');

  return (
    <header className="header">
      <div className="header-inner">
        <Brand />

        <form className="search-box" onSubmit={search} role="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos…" aria-label="Buscar productos" />
        </form>

        <nav className="main-nav" aria-label="Principal">
          <a href="#/productos" className={isActive('/productos') ? 'active' : ''}>Productos</a>
          <a href="#/categorias" className={route.path === '/categorias' ? 'active' : ''}>Categorías</a>
          <a href="#/productos?tag=nuevo" className={isActive('/productos', 'nuevo') ? 'active' : ''}>Novedades</a>
          <a href="#/productos?tag=oferta" className={`nav-sale${isActive('/productos', 'oferta') ? ' active' : ''}`}>Ofertas</a>
        </nav>

        <div className="header-actions">
          <a href="#/escanear" className={`icon-btn${route.path === '/escanear' ? ' on' : ''}`} aria-label="Escanear código de barras" title="Escanear código de barras">
            <Icon name="barcode" size={20} />
          </a>
          <a href="#/favoritos" className={`icon-btn${route.path === '/favoritos' ? ' on' : ''}`} aria-label={`Favoritos (${favs.length})`}>
            <Icon name="heart" size={20} />
          </a>
          <a href="#/carrito" className={`icon-btn${route.path === '/carrito' ? ' on' : ''}`} aria-label={`Carrito (${totals.count})`}>
            <Icon name="cart" size={20} />
            {totals.count > 0 && <span className="count-badge">{totals.count}</span>}
          </a>

          <div className="user-menu" ref={menuRef}>
            <button className="user-chip" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
              <span className="avatar">{initials(user.fullName)}</span>
              <span className="user-chip-text">
                <span className="user-name">{user.fullName}</span>
                <span className="user-balances">
                  <span className="bal-cc"><Coin size={10} /> {formatCoins(user.balanceCoins)}</span>
                  <span className="bal-eur"><Icon name="wallet" size={12} /> {formatEur(user.balanceEurCents)}</span>
                </span>
              </span>
              <Icon name="chevronDown" size={16} className="chev" />
            </button>
            {open && (
              <div className="dropdown" role="menu" onClick={() => setOpen(false)}>
                <a href="#/perfil" role="menuitem"><Icon name="user" size={16} /> Mi perfil</a>
                <a href="#/pedidos" role="menuitem"><Icon name="receipt" size={16} /> Mis pedidos</a>
                {user.role === 'admin' && <a href="#/admin" role="menuitem"><Icon name="chart" size={16} /> Administración</a>}
                <button role="menuitem" onClick={logout}><Icon name="logout" size={16} /> Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
