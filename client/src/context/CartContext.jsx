import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_KEY = 'chikastore_cart';
const FAV_KEY = 'chikastore_favs';

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin storage */ }
};

export function CartProvider({ children }) {
  // Carrito: [{ product, quantity }]   Favoritos: [product]
  const [lines, setLines] = useState(() => load(CART_KEY, []));
  const [favs, setFavs] = useState(() => load(FAV_KEY, []));

  useEffect(() => save(CART_KEY, lines), [lines]);
  useEffect(() => save(FAV_KEY, favs), [favs]);

  const add = (product, quantity = 1) =>
    setLines((prev) => {
      const found = prev.find((l) => l.product._id === product._id);
      if (found) {
        return prev.map((l) => (l.product._id === product._id ? { ...l, quantity: Math.min(l.quantity + quantity, 99) } : l));
      }
      return [...prev, { product, quantity }];
    });

  const setQty = (id, quantity) =>
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.product._id !== id)
        : prev.map((l) => (l.product._id === id ? { ...l, quantity: Math.min(quantity, 99) } : l))
    );

  const clear = () => setLines([]);

  const isFav = (id) => favs.some((p) => p._id === id);
  const toggleFav = (product) =>
    setFavs((prev) => (prev.some((p) => p._id === product._id) ? prev.filter((p) => p._id !== product._id) : [...prev, product]));

  const totals = useMemo(
    () => ({
      count: lines.reduce((s, l) => s + l.quantity, 0),
      eurCents: lines.reduce((s, l) => s + l.product.priceEurCents * l.quantity, 0),
      coins: lines.reduce((s, l) => s + l.product.priceCoins * l.quantity, 0),
    }),
    [lines]
  );

  return (
    <CartContext.Provider value={{ lines, add, setQty, clear, totals, favs, isFav, toggleFav }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
