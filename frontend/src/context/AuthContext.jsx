import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTheme } from './ThemeContext.jsx';

const AuthContext = createContext(null);

function setAxiosToken(token) {
  if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axios.defaults.headers.common.Authorization;
}

export function AuthProvider({ children }) {
  const { setTheme } = useTheme();
  const [token, setToken] = useState(() => localStorage.getItem('auth_token') || '');
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAxiosToken(token);
  }, [token]);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await axios.get('/api/auth/me');
        setUser(res.data.user);
        localStorage.setItem('auth_user', JSON.stringify(res.data.user));
        // Apply DB default theme if user has no local override
        if (!localStorage.getItem('theme')) {
          try {
            const sRes = await axios.get('/api/settings');
            if (sRes.data?.themeDefault) setTheme(sRes.data.themeDefault);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        // invalid token
        setToken('');
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setAxiosToken('');
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function login(email, password) {
    const res = await axios.post('/api/auth/login', { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('auth_token', res.data.token);
    localStorage.setItem('auth_user', JSON.stringify(res.data.user));
        // Apply DB default theme if user has no local override
        if (!localStorage.getItem('theme')) {
          try {
            const sRes = await axios.get('/api/settings');
            if (sRes.data?.themeDefault) setTheme(sRes.data.themeDefault);
          } catch {
            // ignore
          }
        }
    setAxiosToken(res.data.token);
    if (!localStorage.getItem('theme')) {
      try {
        const sRes = await axios.get('/api/settings');
        if (sRes.data?.themeDefault) setTheme(sRes.data.themeDefault);
      } catch {
        // ignore
      }
    }
    return res.data.user;
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAxiosToken('');
  }

  const value = useMemo(
    () => ({ token, user, role: user?.role || 'viewer', isAdmin: user?.role === 'admin', login, logout, loading }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
