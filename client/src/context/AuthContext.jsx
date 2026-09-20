import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';

/**
 * Session state for the whole app.
 *
 * The session lives in an httpOnly cookie, so the client cannot read it: on
 * boot we simply ask the API who we are. Role and subscription flags held here
 * are used for navigation and affordances only — every one of them is enforced
 * again on the server for each request.
 */
const AuthContext = createContext(null);

/**
 * The API returns database rows in snake_case. Normalising once here means the
 * rest of the client only ever deals with one naming convention.
 */
function normaliseUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? row.firstName ?? '',
    lastName: row.last_name ?? row.lastName ?? '',
    homeClub: row.home_club ?? row.homeClub ?? null,
    handicap: row.handicap ?? null,
    charityId: row.charity_id ?? row.charityId ?? null,
    charityPercent: Number(row.charity_percent ?? row.charityPercent ?? 10),
    status: row.status ?? 'active',
    role: row.role ?? 'subscriber',
    charity: row.charity ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const loadSession = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      const current = normaliseUser(data.user);
      setUser(current);
      setStatus('authenticated');
      return current;
    } catch {
      setUser(null);
      setSubscription(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  const refreshSubscription = useCallback(async () => {
    try {
      const data = await api.get('/subscription');
      setSubscription(data);
      return data;
    } catch {
      setSubscription(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const current = await loadSession();
      if (current) await refreshSubscription();
    })();
  }, [loadSession, refreshSubscription]);

  const login = useCallback(async (credentials) => {
    const data = await api.post('/auth/login', credentials);
    const current = normaliseUser(data.user);
    setUser(current);
    setStatus('authenticated');
    await refreshSubscription();
    return current;
  }, [refreshSubscription]);

  const register = useCallback(async (details) => {
    const data = await api.post('/auth/register', details);
    const current = normaliseUser(data.user);
    setUser(current);
    setStatus('authenticated');
    await refreshSubscription();
    return current;
  }, [refreshSubscription]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setSubscription(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    subscription,
    status,
    loading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isAdmin: user?.role === 'admin',
    isSubscribed: Boolean(subscription?.entitled),
    login,
    register,
    logout,
    refreshUser: loadSession,
    refreshSubscription,
    setUser,
  }), [user, subscription, status, login, register, logout, loadSession, refreshSubscription]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}

export default AuthContext;
