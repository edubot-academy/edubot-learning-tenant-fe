import type { AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCurrentLocale } from '../i18n/locale';
import {
  api,
  approveCertificate,
  createIndividualCourseGroup,
  createTenantCourse,
  generateAiCourseDraft,
  generateAiHomeworkDraft,
  generateAiMessageDraft,
  generateAiSessionQuizDraft,
  generateAiWorksheetDraft,
  issueCourseCertificate,
  publishTenantCourse,
  resolveTenantMemberCandidate,
  tenantStore,
  tokenStore,
} from './api';

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

  it('resolves tenant member candidates through the tenant-scoped endpoint', async () => {
    let seenUrl = '';
    let seenParams: unknown;
    api.defaults.adapter = async (config) => {
      seenUrl = config.url ?? '';
      seenParams = config.params;
      return {
        data: {
          found: true,
          user: { id: 12, email: 'aida@example.test', fullName: 'Aida Student' },
          membership: null,
          canAttachExistingUser: true,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    const result = await resolveTenantMemberCandidate(42, { email: ' aida@example.test ' });

    expect(seenUrl).toBe('/companies/42/members/resolve');
    expect(seenParams).toEqual({ email: 'aida@example.test', phoneNumber: undefined });
    expect(result.user?.id).toBe(12);
    expect(result.canAttachExistingUser).toBe(true);
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
            data: { code: 'CSRF_TOKEN_INVALID', message: 'Localized server text' },
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

  it('posts AI LMS Sprint 7 draft requests to the expected endpoints', async () => {
    const seenRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
    api.defaults.adapter = async (config) => {
      seenRequests.push({
        url: config.url ?? '',
        body: JSON.parse(String(config.data || '{}')) as Record<string, unknown>,
      });
      return {
        data: { generationId: 1, status: 'draft', output: { title: 'Draft', description: 'Body' } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await generateAiSessionQuizDraft(77, { language: 'ky', questionCount: 3, includeExplanations: false });
    await generateAiCourseDraft({ language: 'ky', topic: 'Algebra', courseType: 'offline', sectionCount: 4, lessonsPerSection: 4 });
    await generateAiHomeworkDraft(88, { language: 'ky', topic: 'Linear equations', maxScore: 10 });
    await generateAiWorksheetDraft(99, { language: 'ky', topic: 'Practice', includeAnswerKey: true });
    await generateAiMessageDraft(14, { language: 'ky', recipient: 'guardian', purpose: 'progress update', courseId: 7 });

    expect(seenRequests).toEqual([
      {
        url: '/ai-lms/sessions/77/quiz-draft',
        body: { language: 'ky', questionCount: 3, includeExplanations: false },
      },
      {
        url: '/ai-lms/courses/course-draft',
        body: { language: 'ky', topic: 'Algebra', courseType: 'offline', sectionCount: 4, lessonsPerSection: 4 },
      },
      {
        url: '/ai-lms/sessions/88/homework-draft',
        body: { language: 'ky', topic: 'Linear equations', maxScore: 10 },
      },
      {
        url: '/ai-lms/sessions/99/worksheet-draft',
        body: { language: 'ky', topic: 'Practice', includeAnswerKey: true },
      },
      {
        url: '/ai-lms/students/14/message-draft',
        body: { language: 'ky', recipient: 'guardian', purpose: 'progress update', courseId: 7 },
      },
    ]);
  });

  it('posts tenant-scoped private fields for course creation', async () => {
    let requestBody: Record<string, unknown> | null = null;
    api.defaults.adapter = async (config) => {
      requestBody = JSON.parse(String(config.data || '{}')) as Record<string, unknown>;
      return {
        data: { id: 501, title: 'Math' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await createTenantCourse(42, {
      title: 'Math',
      description: 'Algebra basics',
      courseType: 'offline',
      instructorId: 7,
    });

    expect(requestBody).toMatchObject({
      title: 'Math',
      description: 'Algebra basics',
      price: 0,
      isPaid: false,
      visibility: 'PRIVATE',
      companyId: 42,
      courseType: 'offline',
      instructorId: 7,
    });
  });

  it('publishes courses through the dedicated backend endpoint', async () => {
    let requestUrl = '';
    let requestMethod = '';
    api.defaults.adapter = async (config) => {
      requestUrl = config.url ?? '';
      requestMethod = String(config.method ?? '');
      return {
        data: { id: 501, title: 'Math', isPublished: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await publishTenantCourse(501);

    expect(requestUrl).toBe('/courses/501/publish');
    expect(requestMethod).toBe('patch');
  });

  it('posts certificate issue requests with the selected student display name', async () => {
    let requestUrl = '';
    let requestBody: Record<string, unknown> | null = null;
    api.defaults.adapter = async (config) => {
      requestUrl = config.url ?? '';
      requestBody = JSON.parse(String(config.data || '{}')) as Record<string, unknown>;
      return {
        data: { id: 701, publicId: 'CERT-701', studentId: 201, courseId: 101, status: 'issued' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await issueCourseCertificate(101, {
      studentId: 201,
      studentFullName: 'Aida Student',
      issuerDisplayName: 'EduPro Admin',
      issuerTitle: 'Instructor',
      certificateLanguage: 'en',
      pageOrientation: 'landscape',
      note: 'Manual issue',
    });

    expect(requestUrl).toBe('/courses/101/certificates/issue');
    expect(requestBody).toMatchObject({
      studentId: 201,
      studentFullName: 'Aida Student',
      issuerDisplayName: 'EduPro Admin',
      issuerTitle: 'Instructor',
      certificateLanguage: 'en',
      pageOrientation: 'landscape',
      note: 'Manual issue',
    });
  });

  it('posts certificate approval requests with certificate display overrides', async () => {
    let requestUrl = '';
    let requestBody: Record<string, unknown> | null = null;
    api.defaults.adapter = async (config) => {
      requestUrl = config.url ?? '';
      requestBody = JSON.parse(String(config.data || '{}')) as Record<string, unknown>;
      return {
        data: { id: 701, publicId: 'CERT-701', studentId: 201, courseId: 101, status: 'issued' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await approveCertificate(701, {
      studentFullName: 'Aida Student',
      issuerDisplayName: 'EduPro Instructor',
      issuerTitle: 'Teacher',
      certificateLanguage: 'ky',
      pageOrientation: 'portrait',
      reason: 'Approved',
    });

    expect(requestUrl).toBe('/certificates/701/approve');
    expect(requestBody).toMatchObject({
      studentFullName: 'Aida Student',
      issuerDisplayName: 'EduPro Instructor',
      issuerTitle: 'Teacher',
      certificateLanguage: 'ky',
      pageOrientation: 'portrait',
      reason: 'Approved',
    });
  });
});
