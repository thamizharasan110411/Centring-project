import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'erp_admin_token';
const ADMIN_KEY = 'erp_admin_user';

function readStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [admin, setAdmin] = useState(readStoredAdmin);
  const [ready, setReady] = useState(false);

  // Validate the stored token once on load so stale sessions are cleared.
  useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const res = await client.get('/auth/me');
        if (!cancelled) setAdmin((prev) => prev || res.data);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADMIN_KEY);
          setToken(null);
          setAdmin(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    validate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await client.post('/auth/login', { username, password });
    const { token: newToken, admin: newAdmin } = res.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(newAdmin));
    setToken(newToken);
    setAdmin(newAdmin);
    return newAdmin;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setToken(null);
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, admin, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}