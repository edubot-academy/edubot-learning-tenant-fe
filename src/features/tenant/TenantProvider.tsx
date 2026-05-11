/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { listMyTenants, tenantStore } from '../../services/api';
import type { Tenant } from '../../types/domain';
import { useAuth } from '../auth/AuthProvider';

type TenantContextValue = {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  loading: boolean;
  error: string | null;
  setActiveTenantId: (tenantId: number) => void;
  reloadTenants: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<number | null>(tenantStore.get());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloadSequence = useRef(0);

  const reloadTenants = useCallback(async () => {
    const sequence = reloadSequence.current + 1;
    reloadSequence.current = sequence;
    if (!user) {
      setTenants([]);
      setActiveTenantIdState(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyTenants();
      if (reloadSequence.current !== sequence) return;
      setTenants(rows);
      const saved = tenantStore.get();
      const nextTenantId = rows.some((tenant) => tenant.id === saved) ? saved : rows[0]?.id ?? null;
      if (nextTenantId) {
        tenantStore.set(nextTenantId);
        setActiveTenantIdState(nextTenantId);
      } else {
        tenantStore.clear();
        setActiveTenantIdState(null);
      }
    } catch (reason) {
      if (reloadSequence.current !== sequence) return;
      setTenants([]);
      setActiveTenantIdState(null);
      setError(reason instanceof Error ? reason.message : 'Could not load tenant access');
      throw reason;
    } finally {
      if (reloadSequence.current === sequence) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reloadTenants().catch(() => undefined);
  }, [reloadTenants]);

  const value = useMemo<TenantContextValue>(() => ({
    tenants,
    activeTenant: tenants.find((tenant) => tenant.id === activeTenantId) ?? null,
    loading,
    error,
    setActiveTenantId: (tenantId) => {
      tenantStore.set(tenantId);
      setActiveTenantIdState(tenantId);
    },
    reloadTenants,
  }), [activeTenantId, error, loading, reloadTenants, tenants]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used inside TenantProvider');
  return value;
}
