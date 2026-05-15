import type { AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCurrentLocale } from '../i18n/locale';
import { api, createIndividualCourseGroup, searchUsers, tenantStore, tokenStore } from './api';

describe('api browser stores', () => {
  const defaultAdapter = api.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearCurrentLocale();
    document.cookie = 'edubot_csrf_token=; Max-Age=0; path=/';
  });

  afterEach(() => {
    api.defaults.adapter = defaultAdapter;
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
    localStorage.setItem('edubot_locale', 'ru');

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
    expect(response.config.headers?.['Accept-Language']).toBe('ru');
  });

  it('adds the CSRF token cookie to unsafe requests', async () => {
    document.cookie = 'edubot_csrf_token=csrf-123; path=/';

    const response = await api.post('/courses', { title: 'Math' }, {
      adapter: async (config) => ({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    });

    expect(response.config.headers?.['X-CSRF-Token']).toBe('csrf-123');
  });

  it('does not add the CSRF token cookie to safe requests', async () => {
    document.cookie = 'edubot_csrf_token=csrf-123; path=/';

    const response = await api.get('/courses', {
      adapter: async (config) => ({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    });

    expect(response.config.headers?.['X-CSRF-Token']).toBeUndefined();
  });

  it('searches users with both supported query names and accepts users response shape', async () => {
    let seenParams: unknown;
    api.defaults.adapter = async (config) => {
      seenParams = config.params;
      return {
        data: { users: [{ id: 12, email: 'aida@example.test', fullName: 'Aida Student' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    const results = await searchUsers({ search: ' Aida ', role: 'student', limit: 12 });

    expect(seenParams).toMatchObject({ search: 'Aida', q: 'Aida', role: 'student', limit: 12 });
    expect(results).toEqual([{ id: 12, email: 'aida@example.test', fullName: 'Aida Student' }]);
  });

  it('refreshes profile and retries once after a CSRF rejection', async () => {
    document.cookie = 'edubot_csrf_token=csrf-123; path=/';
    const seenRequests: string[] = [];

    const adapter: AxiosAdapter = async (config) => {
      const url = config.url ?? '';
      seenRequests.push(url);

      if (url === '/courses' && seenRequests.filter((item) => item === '/courses').length === 1) {
        return Promise.reject({
          config,
          response: {
            data: { message: 'CSRF token missing or invalid' },
            status: 403,
            statusText: 'Forbidden',
            headers: {},
            config,
          },
        });
      }

      return {
        data: url === '/auth/profile' ? { id: 1, email: 'admin@example.com' } : { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    api.defaults.adapter = adapter;

    const response = await api.post('/courses', { title: 'Math' });

    expect(response.data).toEqual({ ok: true });
    expect(seenRequests).toEqual(['/courses', '/auth/profile', '/courses']);
  });

  it('does not loop when the retried request is rejected for CSRF again', async () => {
    document.cookie = 'edubot_csrf_token=csrf-123; path=/';
    const seenRequests: string[] = [];

    const adapter: AxiosAdapter = async (config) => {
      const url = config.url ?? '';
      seenRequests.push(url);

      if (url === '/auth/profile') {
        return {
          data: { id: 1, email: 'admin@example.com' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      }

      return Promise.reject({
        config,
        response: {
          data: { message: 'CSRF token missing or invalid' },
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config,
        },
      });
    };
    api.defaults.adapter = adapter;

    await expect(api.post('/courses', { title: 'Math' })).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(seenRequests).toEqual(['/courses', '/auth/profile', '/courses']);
  });

  it('posts only supported fields for individual course group creation', async () => {
    let requestBody: Record<string, unknown> | null = null;
    api.defaults.adapter = async (config) => {
      requestBody = JSON.parse(String(config.data || '{}')) as Record<string, unknown>;
      return {
        data: { group: { id: 301, deliveryMode: 'individual' }, enrollment: { id: 701 }, firstSession: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await createIndividualCourseGroup({
      courseId: 101,
      studentId: 201,
      name: 'Aida individual',
      startDate: '2026-05-18',
      scheduleBlocks: [{ day: 'mon', startTime: '10:00', endTime: '11:00' }],
      createFirstSession: true,
    });

    expect(requestBody).toMatchObject({
      courseId: 101,
      studentId: 201,
      name: 'Aida individual',
      startDate: '2026-05-18',
      createFirstSession: true,
    });
    expect(requestBody).not.toHaveProperty('code');
    expect(requestBody).not.toHaveProperty('status');
    expect(requestBody).not.toHaveProperty('scheduleNote');
  });
});
