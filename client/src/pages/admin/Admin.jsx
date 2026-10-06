import Icon from '../../components/Icon';
import { Brand } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import AdminProducts from './AdminProducts';
import AdminUsers from './AdminUsers';
import Dashboard from './Dashboard';

const TABS = [
  ['/admin', 'Resumen y pedidos', 'chart', Dashboard],
  ['/admin/productos', 'Productos', 'box', AdminProducts],
  ['/admin/usuarios', 'Usuarios', 'users', AdminUsers],
];

export default function Admin({ path }) {
  const { logout } = useAuth();
  const tab = TABS.find(([p]) => p === path) || TABS[0];
  const Page = tab[3];

  return (
    <div className="admin">
      <aside className="sidebar">
        <Brand dark sub="Administración" />
        <nav aria-label="Administración">
          {TABS.map(([p, label, icon]) => (
            <a key={p} href={`#${p}`} className={p === tab[0] ? 'active' : ''}>
              <Icon name={icon} size={18} /> {label}
            </a>
          ))}
          <a href="#/"><Icon name="store" size={18} /> Ver tienda</a>
        </nav>
        <button className="sidebar-logout" onClick={logout}><Icon name="logout" size={18} /> Cerrar sesión</button>
      </aside>
      <main className="admin-main">
        <Page />
      </main>
    </div>
  );
}
