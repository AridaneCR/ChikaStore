import { useEffect } from 'react';
import Icon from './components/Icon';
import Navbar from './components/Navbar';
import { Spinner, Toasts } from './components/ui';
import { useAuth } from './context/AuthContext';
import Admin from './pages/admin/Admin';
import Cart from './pages/Cart';
import { ForgotPassword, ResetPassword, SocialCallback } from './pages/AuthPages';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Scan from './pages/Scan';
import Shop, { AboutCoins, Catalog, Categories, Favorites } from './pages/Shop';
import { navigate, useRoute } from './router';

const ROUTES = {
  '/': Shop,
  '/productos': Catalog,
  '/categorias': Categories,
  '/favoritos': Favorites,
  '/escanear': Scan,
  '/chikacoins': AboutCoins,
  '/carrito': Cart,
  '/pedidos': Orders,
  '/perfil': Profile,
};

// Pantallas de acceso que funcionan con o sin sesión (enlaces de correo, vuelta de Discord)
const AUTH_PAGES = {
  '/recuperar': ForgotPassword,
  '/restablecer': ResetPassword,
  '/social': SocialCallback,
};

export default function App() {
  const { user, loading } = useAuth();
  const route = useRoute();
  const { path } = route;

  // Ya identificado: fuera de las pantallas de acceso
  useEffect(() => {
    if (user && (path === '/login' || path === '/registro')) navigate('/');
  }, [user, path]);

  if (loading) return <Spinner />;

  const AuthPage = AUTH_PAGES[path];
  if (AuthPage && !(user && path === '/recuperar')) {
    return (
      <>
        <AuthPage query={route.query} />
        <Toasts />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Login mode={path === '/registro' ? 'register' : 'login'} query={route.query} />
        <Toasts />
      </>
    );
  }

  if (path.startsWith('/admin') && user.role === 'admin') {
    return (
      <>
        <Admin path={path} />
        <Toasts />
      </>
    );
  }

  const Page = ROUTES[path] || Shop;
  return (
    <>
      <Navbar route={route} />
      <main><Page query={route.query} /></main>
      {path !== '/escanear' && path !== '/carrito' && (
        <a href="#/escanear" className="scan-fab" aria-label="Escanear código de barras">
          <Icon name="barcode" size={24} />
        </a>
      )}
      <footer className="site-footer">
        <span>© ChikakuShop · Reserva online, paga y recoge en la tienda</span>
        <span>1 € = 100 CHIKACOINS</span>
      </footer>
      <Toasts />
    </>
  );
}
