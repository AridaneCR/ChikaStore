import { useEffect } from 'react';
import Navbar from './components/Navbar';
import { Spinner, Toasts } from './components/ui';
import { useAuth } from './context/AuthContext';
import Admin from './pages/admin/Admin';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Shop, { AboutCoins, Catalog, Categories, Favorites } from './pages/Shop';
import { navigate, useRoute } from './router';

const ROUTES = {
  '/': Shop,
  '/productos': Catalog,
  '/categorias': Categories,
  '/favoritos': Favorites,
  '/chikacoins': AboutCoins,
  '/carrito': Cart,
  '/pedidos': Orders,
  '/perfil': Profile,
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

  if (!user) {
    return (
      <>
        <Login mode={path === '/registro' ? 'register' : 'login'} />
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
      <footer className="site-footer">
        <span>© CHIKASTORE · Reserva online, paga y recoge en la tienda</span>
        <span>1 € = 100 CHIKACOINS</span>
      </footer>
      <Toasts />
    </>
  );
}
