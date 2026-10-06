const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('es-ES', { useGrouping: true });

// es-ES no agrupa los números de 4 cifras (1500); forzamos el punto de miles como en el diseño
export const formatCoins = (coins) => {
  const n = Math.round(coins || 0);
  return Math.abs(n) >= 1000 && Math.abs(n) < 10000
    ? `${n < 0 ? '-' : ''}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    : num.format(n);
};
export const formatEur = (cents) => {
  const s = eur.format((cents || 0) / 100);
  return s.replace(/^(-?)(\d)(\d{3}),/, '$1$2.$3,');
};
export const formatPrice = (amount, currency) =>
  currency === 'COINS' ? `${formatCoins(amount)} CC` : formatEur(amount);

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·') : '—';

export const orderNo = (n) => `#${String(n).padStart(6, '0')}`;
export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const eurosToCents = (v) => Math.round(Number(String(v).replace(/[€\s]/g, '').replace(',', '.')) * 100);
export const centsToEuros = (c) => ((c || 0) / 100).toFixed(2).replace('.', ',');

export const CATEGORIES = ['Sobres', 'Fundas', 'Accesorios TCG', 'Bebidas', 'Snacks', 'Juegos de mesa', 'Dados', 'Merchandising', 'Otros'];
export const TAGS = { nuevo: 'Nuevo', destacado: 'Destacado', oferta: 'Oferta' };

export const STATUS = {
  sin_pagar: { label: 'Sin pagar', userLabel: 'Pendiente de pago', tone: 'warn' },
  pagado: { label: 'Pagado', userLabel: 'Pagado', tone: 'ok' },
  entregado: { label: 'Recogido', userLabel: 'Recogido', tone: 'muted' },
  cancelado: { label: 'Cancelado', userLabel: 'Cancelado', tone: 'bad' },
};

export const PAID_WITH = { coins: 'CHIKACOINS', saldo_eur: 'Saldo en €', tienda: 'En tienda' };
