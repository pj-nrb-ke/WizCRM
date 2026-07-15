import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Entitlements, FeatureKey } from '@wizcrm/shared';
import { api, clearStoredToken, getStoredToken, setStoredToken, TOKEN_KEY, type AuthUser } from './api';

type Permissions = Record<FeatureKey, boolean>;

type AuthState = {
  user: AuthUser | null;
  entitlements: Entitlements | null;
  permissions: Permissions | null;
  can: (key: FeatureKey) => boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setEntitlements(null);
      setPermissions(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ user: AuthUser; entitlements: Entitlements; permissions: Permissions }>(
        '/auth/me',
      );
      setUser(res.user);
      setEntitlements(res.entitlements);
      setPermissions(res.permissions);
    } catch {
      clearStoredToken();
      setUser(null);
      setEntitlements(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // Keep every open tab in sync with auth state changed elsewhere — logging
  // out (or in, or as someone else) in one tab must not leave other tabs
  // acting on a session that's no longer valid. The `storage` event only
  // fires in *other* tabs than the one that made the change, which is
  // exactly the tabs that need to react.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== TOKEN_KEY) return;
      void loadMe();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{
      token: string;
      user: AuthUser;
      entitlements: Entitlements;
      permissions: Permissions;
    }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setStoredToken(data.token);
    setUser(data.user);
    setEntitlements(data.entitlements);
    setPermissions(data.permissions);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setEntitlements(null);
    setPermissions(null);
  }, []);

  const can = useCallback((key: FeatureKey) => permissions?.[key] ?? true, [permissions]);

  const value = useMemo(
    () => ({ user, entitlements, permissions, can, loading, login, logout }),
    [user, entitlements, permissions, can, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
