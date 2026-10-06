// Iconos de línea (estilo Lucide) dibujados a mano para no añadir dependencias.
const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  heart: <path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 7.5 6.5Z" />,
  cart: <><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2.5 3.5h2.6l2.4 11.4a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.5-1.2l1.6-6.8H6" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  store: <><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12v8h14v-8" /><path d="M10 20v-5h4v5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /></>,
  zap: <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z" />,
  trash: <><path d="M4 6.5h16" /><path d="M9 6.5V4h6v2.5" /><path d="M6.5 6.5 7.5 20h9l1-13.5" /><path d="M10 10.5v6M14 10.5v6" /></>,
  upload: <><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
  chart: <><path d="M3.5 3.5v17h17" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  box: <><path d="m12 2.8 8.5 4.6v9.2L12 21.2l-8.5-4.6V7.4Z" /><path d="m3.5 7.4 8.5 4.6 8.5-4.6M12 12v9.2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6.5 6.5 0 0 1 3 6" /></>,
  flame: <path d="M12 21.5c-3.9 0-6.5-2.6-6.5-6.1 0-3.9 3.6-5.8 4.4-10.9 2.3 1.4 3.4 3.4 3.5 5.6 1-.6 1.6-1.6 1.8-2.9 2 1.7 3.3 4.4 3.3 7.4 0 4.1-2.8 6.9-6.5 6.9Z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  tag: <><path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0Z" /><circle cx="8" cy="8" r="1.3" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 9.5h18" /></>,
  logout: <><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" /><path d="m10 16 4-4-4-4M14 12H4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  // Categorías
  sobre: <path d="M7 3h10l-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2H7l1-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2Z" />,
  funda: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9.5 3v18" /></>,
  accesorio: <><rect x="4" y="7" width="12" height="14" rx="1" /><path d="M8 7V3.5h12V17h-4" /></>,
  bebida: <><path d="M8.5 3h7M9 3v3.5L8 9v12h8V9l-1-2.5V3" /><path d="M8 13h8" /></>,
  snack: <><path d="M6 3h12l-1 3 1 15H6l1-15Z" /><path d="M7 6h10M9.5 13h5" /></>,
  juego: <><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M8 7V4h8v3M12 10.5v6M9 13.5h6" /></>,
  dado: <><path d="m12 2.8 8.5 4.6v9.2L12 21.2l-8.5-4.6V7.4Z" /><path d="m12 7.5 4.5 8h-9Z" /></>,
  merch: <path d="M8.5 3 3.5 6l2 4 2-1V21h9V9l2 1 2-4-5-3a3.5 3.5 0 0 1-7 0Z" />,
  otros: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.3-2.5 3.8M12 17.2v.1" /></>,
};

export const CATEGORY_ICONS = {
  Sobres: 'sobre',
  Fundas: 'funda',
  'Accesorios TCG': 'accesorio',
  Bebidas: 'bebida',
  Snacks: 'snack',
  'Juegos de mesa': 'juego',
  Dados: 'dado',
  Merchandising: 'merch',
  Otros: 'otros',
};

export default function Icon({ name, size = 20, stroke = 1.8, className = '', ...rest }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name] || PATHS.otros}
    </svg>
  );
}

/* Logo: d20 dentro de un círculo rojo */
export function LogoMark({ size = 40 }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 2.8 8.5 4.6v9.2L12 21.2l-8.5-4.6V7.4Z" />
        <path d="m12 7.5 4.5 8h-9Z" />
      </svg>
    </span>
  );
}

/* Moneda CHIKACOIN */
export function Coin({ size = 14, label = false }) {
  return (
    <span className={`coin${label ? ' coin-label' : ''}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {label ? 'CC' : null}
    </span>
  );
}
