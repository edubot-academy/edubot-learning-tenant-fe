import { beforeEach, describe, expect, it } from 'vitest';
import { api, tenantStore, tokenStore } from './api';

describe('api browser stores', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores auth tokens in session storage and clears old local tokens', () => {
    localStorage.setItem('edubot_tenant_token', 'old-token');

    tokenStore.set('new-token');

    expect(sessionStorage.getItem('edubot_tenant_token')).toBe('new-token');
    expect(localStorage.getItem('edubot_tenant_token')).toBeNull();
    expect(tokenStore.get()).toBe('new-token');
  });

  it('clears auth tokens from both storage locations', () => {
    localStorage.setItem('edubot_tenant_token', 'old-token');
    sessionStorage.setItem('edubot_tenant_token', 'new-token');

    tokenStore.clear();

    expect(tokenStore.get()).toBeNull();
    expect(localStorage.getItem('edubot_tenant_token')).toBeNull();
    expect(sessionStorage.getItem('edubot_tenant_token')).toBeNull();
  });

  it('ignores invalid tenant ids', () => {
    localStorage.setItem('edubot_active_tenant_id', '-1');
    expect(tenantStore.get()).toBeNull();

    tenantStore.set(42);
    expect(tenantStore.get()).toBe(42);
  });

  it('can skip the active tenant header for tenant resolution requests', async () => {
    tenantStore.set(42);

    const response = await api.get('/tenant-context/resolve', {
      params: { host: 'tenant.example.com' },
      skipTenantHeader: true,
      adapter: async (config) => ({
        data: { id: 1, name: 'Tenant' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    });

    expect(response.config.headers?.['X-Company-Id']).toBeUndefined();
  });
});
