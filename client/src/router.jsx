import { useEffect, useState } from 'react';

// Router mínimo basado en el hash (#/ruta?param=valor). Funciona en cualquier hosting
// estático (Render, Netlify, GitHub Pages) sin configurar redirecciones.
function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(search)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const navigate = (to) => {
  window.location.hash = to;
};

export const href = (path, query = {}) => {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')).toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
};
