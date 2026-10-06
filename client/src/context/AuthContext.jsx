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

  const login = async (identifier, password) => {
    const { token, user: u } = await api('/auth/login', { method: 'POST', body: { identifier, password } });
    setToken(token);
    setUser(u);
    return u;
  };

  const register = async (data) => {
    const { token, user: u } = await api('/auth/register', { method: 'POST', body: data });
    setToken(token);
    setUser(u);
    return u;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    window.location.hash = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
