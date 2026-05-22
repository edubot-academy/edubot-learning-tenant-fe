import type { Tenant, WorkspaceListResponse } from '../types/domain';
import { api, dedupeRead } from './http';

function tenantFromWorkspace(item: WorkspaceListResponse['items'][number]): Tenant | null {
  if (item.type !== 'tenant' || !item.companyId) return null;
  return {
    id: item.companyId,
    name: item.name,
    role: item.role,
    roles: item.roles,
    membershipStatus: item.membershipStatus,
    status: item.status ?? item.availability?.status ?? undefined,
    plan: item.plan,
    billingStatus: item.billingStatus,
    featureFlags: item.featureFlags ?? undefined,
    timezone: item.timezone,
    locale: item.locale,
    availability: item.availability,
    permissions: item.permissions,
    branding: item.branding,
    logoUrl: item.logoUrl,
    host: item.host,
    crmLink: item.crmLink,
    crmTenantId: item.crmLink?.crmTenantId ?? undefined,
    crmTenantSlug: item.crmLink?.crmTenantSlug ?? undefined,
    crmPrimaryDomain: item.crmLink?.crmPrimaryDomain ?? undefined,
  };
}

export async function listMyTenants() {
  return dedupeRead('tenants:mine', async () => {
    const { data } = await api.get<{ items?: Tenant[] } | Tenant[]>('/companies/mine', {
      params: { limit: 100 },
    });
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function listTenantWorkspaces() {
  return dedupeRead('tenants:workspaces', async () => {
    const { data } = await api.get<WorkspaceListResponse>('/companies/workspaces', {
      skipTenantHeader: true,
    });
    return {
      ...data,
      tenantItems: (data.items ?? []).filter((item) => item.type === 'tenant'),
      tenants: (data.items ?? [])
        .map(tenantFromWorkspace)
        .filter((tenant): tenant is Tenant => Boolean(tenant)),
    };
  });
}

export async function switchTenantWorkspace(tenantId: number) {
  const { data } = await api.post<{ active: WorkspaceListResponse['items'][number] }>('/companies/workspaces/switch', {
    type: 'tenant',
    companyId: tenantId,
  }, {
    skipTenantHeader: true,
  });
  const tenant = tenantFromWorkspace(data.active);
  if (!tenant) throw new Error('Workspace switch response did not include a tenant workspace');
  return tenant;
}

export async function resolveTenantByHost(host: string) {
  return dedupeRead(`tenants:resolve:${host}`, async () => {
    const { data } = await api.get<Tenant & { resolvedHost?: string }>('/tenant-context/resolve', {
      params: { host },
      skipTenantHeader: true,
    });
    return data;
  });
}
