/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { listTenantWorkspaces, resolveTenantByHost, switchTenantWorkspace, tenantStore } from '../../services/api';
import type { Tenant } from '../../types/domain';
import { useAuth } from '../auth/AuthProvider';

type TenantContextValue = {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  resolvedTenant: Tenant | null;
  hostnameLocked: boolean;
  loading: boolean;
  resolvingTenant: boolean;
  error: string | null;
  resolutionError: string | null;
  setActiveTenantId: (tenantId: number) => void;
  reloadTenants: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);
const neutralHostnames = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'lms.edubot.it.com',
  'edubot-learning-tenant-fe.vercel.app',
  ...(import.meta.env.VITE_TENANT_NEUTRAL_HOSTS || '')
    .split(',')
    .map((host: string) => host.trim().toLowerCase())
    .filter(Boolean),
]);

function getTenantLookupHost() {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || neutralHostnames.has(hostname)) return null;
  return hostname;
}

function getNeutralTenantQueryOverride() {
  if (typeof window === 'undefined' || getTenantLookupHost()) {
    return { tenantSlug: null, tenantId: null };
  }

  const params = new URLSearchParams(window.location.search);
  const tenantSlug = params.get('tenant')?.trim().toLowerCase() || null;
  const tenantIdValue = Number(params.get('tenantId'));
  const tenantId = Number.isFinite(tenantIdValue) && tenantIdValue > 0 ? tenantIdValue : null;
  return { tenantSlug, tenantId };
}

function getQueryTenantHost(tenantSlug: string | null) {
  if (!tenantSlug) return null;
  const baseDomain = (import.meta.env.VITE_TENANT_QUERY_BASE_DOMAIN || 'lms.edubot.it.com')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
  return `${tenantSlug}.${baseDomain}`;
}

function tenantId(value: Tenant | null | undefined) {
  const id = Number(value?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function findTenantById(rows: Tenant[], id: number | null) {
  if (!id) return null;
  return rows.find((tenant) => tenantId(tenant) === id) ?? null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const lookupHost = useMemo(() => getTenantLookupHost(), []);
  const queryOverride = useMemo(() => getNeutralTenantQueryOverride(), []);
  const resolvedLookupHost = useMemo(
    () => lookupHost || getQueryTenantHost(queryOverride.tenantSlug),
    [lookupHost, queryOverride.tenantSlug],
  );
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<number | null>(queryOverride.tenantId ?? tenantStore.get());
  const [resolvedTenant, setResolvedTenant] = useState<Tenant | null>(null);
  const [hostnameLocked, setHostnameLocked] = useState(Boolean(queryOverride.tenantId));
  const [loading, setLoading] = useState(false);
  const [resolvingTenant, setResolvingTenant] = useState(Boolean(resolvedLookupHost));
  const [error, setError] = useState<string | null>(null);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const reloadSequence = useRef(0);

  useEffect(() => {
    let mounted = true;
    if (!resolvedLookupHost) {
      setResolvedTenant(null);
      setHostnameLocked(Boolean(queryOverride.tenantId));
      setResolutionError(null);
      if (queryOverride.tenantId) {
        tenantStore.set(queryOverride.tenantId);
        setActiveTenantIdState(queryOverride.tenantId);
      }
      return undefined;
    }

    setResolvingTenant(true);
    setResolutionError(null);
    resolveTenantByHost(resolvedLookupHost)
      .then((tenant) => {
        if (!mounted) return;
        setResolvedTenant(tenant);
        setHostnameLocked(true);
        tenantStore.set(tenant.id);
        setActiveTenantIdState(tenant.id);
      })
      .catch(() => {
        if (!mounted) return;
        setResolvedTenant(null);
        setHostnameLocked(true);
        setResolutionError(t('errors.tenantDomainDetail'));
        tenantStore.clear();
        setActiveTenantIdState(null);
      })
      .finally(() => {
        if (mounted) setResolvingTenant(false);
      });

    return () => {
      mounted = false;
    };
  }, [queryOverride.tenantId, resolvedLookupHost, t]);

  const reloadTenants = useCallback(async () => {
    const sequence = reloadSequence.current + 1;
    reloadSequence.current = sequence;
    if (!user) {
      setTenants([]);
      if (!resolvedTenant) setActiveTenantIdState(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const workspaceState = await listTenantWorkspaces();
      const rows = workspaceState.tenants;
      if (reloadSequence.current !== sequence) return;
      setTenants(rows);
      const saved = tenantStore.get();
      const resolvedTenantId = tenantId(resolvedTenant);
      const nextTenantId = resolvedTenantId
        ? findTenantById(rows, resolvedTenantId)?.id ?? null
        : queryOverride.tenantId
          ? findTenantById(rows, queryOverride.tenantId)?.id ?? null
        : findTenantById(rows, saved)?.id ?? rows[0]?.id ?? null;
      if (nextTenantId) {
        tenantStore.set(nextTenantId);
        setActiveTenantIdState(nextTenantId);
        setError(null);
      } else {
        if (!resolvedTenant) tenantStore.clear();
        setActiveTenantIdState(null);
        setError(resolvedTenant || queryOverride.tenantId
          ? t('errors.noAccessToRequestedTenant')
          : null);
      }
    } catch (reason) {
      if (reloadSequence.current !== sequence) return;
      setTenants([]);
      setActiveTenantIdState(null);
      setError(t('errors.tenantAccessLoadDetail'));
      throw reason;
    } finally {
      if (reloadSequence.current === sequence) setLoading(false);
    }
  }, [queryOverride.tenantId, resolvedTenant, t, user]);

  useEffect(() => {
    void reloadTenants().catch(() => undefined);
  }, [reloadTenants]);

  const value = useMemo<TenantContextValue>(() => ({
    tenants,
    activeTenant: findTenantById(tenants, activeTenantId) ?? resolvedTenant,
    resolvedTenant,
    hostnameLocked,
    loading,
    resolvingTenant,
    error,
    resolutionError,
    setActiveTenantId: (nextTenantId) => {
      if (hostnameLocked) return;
      tenantStore.set(nextTenantId);
      setActiveTenantIdState(nextTenantId);
      void switchTenantWorkspace(nextTenantId)
        .then((tenant) => {
          setTenants((current) => current.map((item) => (
            tenantId(item) === tenant.id ? { ...item, ...tenant } : item
          )));
          setError(null);
        })
        .catch(() => {
          setError(t('errors.tenantAccessLoadDetail'));
          void reloadTenants().catch(() => undefined);
        });
    },
    reloadTenants,
  }), [activeTenantId, error, hostnameLocked, loading, reloadTenants, resolvedTenant, resolvingTenant, resolutionError, t, tenants]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used inside TenantProvider');
  return value;
}
