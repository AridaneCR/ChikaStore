import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const refresh = useCallback(async () => {
    if (!getToken()) return setLoading(false);
    try {
      const { user: u } = await api('/auth/me');
      setUser(u);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
    return undefined;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Todas las formas de entrar acaban aquí: guarda la sesión que devuelve el servidor
  const session = async (path, body) => {
    const { token, user: u } = await api(path, { method: 'POST', body });
    setToken(token);
    setUser(u);
    return u;
  };

  const login = (identifier, password) => session('/auth/login', { identifier, password });
  const register = (data) => session('/auth/register', data);
  const loginWithGoogle = (credential) => session('/auth/google', { credential });
  const exchangeSocialCode = (code) => session('/auth/social/exchange', { code });
  const resetPassword = (token, password) => session('/auth/reset', { token, password });

  const logout = () => {
    setToken(null);
    setUser(null);
    window.location.hash = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, exchangeSocialCode, resetPassword, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
