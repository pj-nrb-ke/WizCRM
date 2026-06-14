import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Entitlements } from '@wizcrm/shared';
import { api, clearStoredToken, getStoredToken, setStoredToken, type AuthUser } from './api';

type AuthState = {
  user: AuthUser | null;
  entitlements: Entitlements | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setEntitlements(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ user: AuthUser; entitlements: Entitlements }>('/auth/me');
      setUser(res.user);
      setEntitlements(res.entitlements);
    } catch {
      clearStoredToken();
      setUser(null);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: AuthUser; entitlements: Entitlements }>(
      '/auth/login',
      {
        method: 'POST',
        body: { email, password },
        auth: false,
      },
    );
    setStoredToken(data.token);
    setUser(data.user);
    setEntitlements(data.entitlements);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setEntitlements(null);
  }, []);

  const value = useMemo(
    () => ({ user, entitlements, loading, login, logout }),
    [user, entitlements, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
