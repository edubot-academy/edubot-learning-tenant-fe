import { describe, expect, it } from 'vitest';
import type { Tenant, TenantOverview } from '../../types/domain';
import { getAdminSetupChecklist } from './adminSetupChecklist';

const overview = (overrides: Partial<TenantOverview> = {}): TenantOverview => ({
  tenant: { id: 1, name: 'Tenant' },
  role: 'owner',
  permissions: {
    canManageMembers: true,
    canViewActivity: true,
    canManageCertificates: true,
    canCreateCourses: true,
  },
  stats: {
    courses: 1,
    activeGroups: 1,
    students: 1,
    instructors: 1,
    upcomingSessions: 1,
  },
  courses: [],
  sessions: {
    upcoming: [],
    today: 0,
    unmarkedAttendance: 0,
    cancelled: 0,
  },
  homework: {
    summary: {},
    queue: [],
  },
  certificates: {
    pending: 0,
    issued: 0,
    rejected: 0,
    revoked: 0,
    configuredCourses: 1,
    coursesWithoutConfig: 0,
    eligibleWaiting: 0,
  },
  setup: {
    progress: 100,
    items: [],
  },
  features: [],
  activity: [],
  ...overrides,
});

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 1,
  name: 'Tenant',
  email: 'admin@example.com',
  timezone: 'Asia/Bishkek',
  logoUrl: 'https://example.com/logo.png',
  settings: { supportEmail: 'support@example.com' },
  ...overrides,
});

describe('admin setup checklist', () => {
  it('marks core setup items complete when existing overview and tenant data is present', () => {
    const items = getAdminSetupChecklist(overview(), tenant(), {
      canManageCertificates: true,
      certificatesEnabled: true,
    });

    expect(items.every((item) => item.complete)).toBe(true);
  });

  it('marks missing operational setup items incomplete', () => {
    const items = getAdminSetupChecklist(overview({
      stats: {
        courses: 0,
        activeGroups: 0,
        students: 0,
        instructors: 0,
        upcomingSessions: 0,
      },
      certificates: {
        pending: 0,
        issued: 0,
        rejected: 0,
        revoked: 0,
        configuredCourses: 0,
        coursesWithoutConfig: 1,
        eligibleWaiting: 0,
      },
    }), tenant({ email: '', contactEmail: '', timezone: '', locale: '', logoUrl: '', branding: {}, settings: {} }), {
      canManageCertificates: true,
      certificatesEnabled: true,
    });

    expect(items.filter((item) => !item.complete).map((item) => item.key)).toEqual([
      'profile',
      'branding',
      'instructors',
      'course',
      'group',
      'sessions',
      'students',
      'certificates',
      'policies',
    ]);
  });
});
