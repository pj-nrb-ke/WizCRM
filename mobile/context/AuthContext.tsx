import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, login as apiLogin, type User } from '../lib/api';
import type { Entitlements } from '../lib/entitlements';

const SESSION_TIMEOUT_MS = 8_000;

type AuthState = {
  user: User | null;
  entitlements: Entitlements | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const res = await api<{ user: User; entitlements: Entitlements }>('/auth/me', {
          timeoutMs: SESSION_TIMEOUT_MS,
        });
        if (!cancelled) {
          setUser(res.user);
          setEntitlements(res.entitlements);
        }
      } catch {
        await clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const res = await api<{ user: User; entitlements: Entitlements }>('/auth/me');
    setUser(res.user);
    setEntitlements(res.entitlements);
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    setEntitlements(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, entitlements, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
