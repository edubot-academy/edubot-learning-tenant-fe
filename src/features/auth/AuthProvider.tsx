/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  completeAccountSetup,
  getCurrentUser,
  login,
  logout,
  tenantStore,
  tokenStore,
} from '../../services/api';
import type { AuthUser } from '../../types/domain';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  completeSetup: (token: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((currentUser) => {
        if (mounted) setUser(currentUser);
      })
      .catch(() => {
        tokenStore.clear();
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn: async (email, password) => {
      const currentUser = await login(email, password);
      setUser(currentUser);
    },
    completeSetup: async (token, newPassword) => {
      const currentUser = await completeAccountSetup({ token, newPassword });
      setUser(currentUser);
    },
    signOut: async () => {
      try {
        await logout();
      } catch {
        // Local session cleanup must still happen if the backend cookie is already gone.
      }
      tokenStore.clear();
      tenantStore.clear();
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
