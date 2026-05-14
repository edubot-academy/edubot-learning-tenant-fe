import { describe, expect, it } from 'vitest';
import type { AuthUser, Tenant } from '../types/domain';
import { countEnabledStaffTools, getMobileNavGroups, getVisibleNavItems, getVisibleOperationalNavItems } from './appNavigation';

const user = (role: string): AuthUser => ({
  id: 1,
  email: 'user@example.com',
  role,
});

const tenant = (role: string, featureFlags: Tenant['featureFlags'] = {}, permissions?: Tenant['permissions']): Tenant => ({
  id: 10,
  name: 'Tenant',
  role,
  featureFlags,
  permissions,
});

describe('app navigation visibility', () => {
  it('keeps learners in the learner navigation surface', () => {
    expect(getVisibleNavItems(user('student'), tenant('student')).map((item) => item.to)).toEqual(['/student', '/settings']);
  });

  it('hides member management from non-admin staff', () => {
    const routes = getVisibleNavItems(user('instructor'), tenant('instructor')).map((item) => item.to);

    expect(routes).toContain('/sessions');
    expect(routes).toContain('/certificates');
    expect(routes).not.toContain('/members');
  });

  it('hides feature-flagged tools when disabled', () => {
    const routes = getVisibleNavItems(user('company_admin'), tenant('company_admin', {
      'attendance.enabled': false,
      'homework.enabled': false,
      'certificates.enabled': false,
    })).map((item) => item.to);

    expect(routes).not.toContain('/attendance');
    expect(routes).not.toContain('/homework');
    expect(routes).not.toContain('/certificates');
    expect(routes).toContain('/members');
    expect(routes).toContain('/operations');
  });

  it('uses tenant permissions for admin navigation visibility', () => {
    const routes = getVisibleNavItems(user('company_admin'), tenant('company_admin', {}, {
      canManageMembers: false,
      canManageCertificates: false,
      canViewReports: false,
    })).map((item) => item.to);

    expect(routes).not.toContain('/members');
    expect(routes).not.toContain('/certificates');
    expect(routes).not.toContain('/reports');
    expect(routes).not.toContain('/courses');
    expect(routes).toContain('/operations');
  });

  it('shows reports when report permission is granted', () => {
    const routes = getVisibleNavItems(user('assistant'), tenant('assistant', {}, {
      canViewReports: true,
    })).map((item) => item.to);

    expect(routes).toContain('/reports');
    expect(routes).toContain('/settings');
  });

  it('does not show settings for report-only permission users', () => {
    const routes = getVisibleNavItems(user('admin'), tenant('', {}, {
      canViewReports: true,
    })).map((item) => item.to);

    expect(routes).toContain('/reports');
    expect(routes).not.toContain('/settings');
  });

  it('shows permission-granted tools for non-admin tenant roles', () => {
    const routes = getVisibleNavItems(user('assistant'), tenant('assistant', {}, {
      canManageMembers: true,
      canManageCertificates: true,
    })).map((item) => item.to);

    expect(routes).toContain('/members');
    expect(routes).toContain('/operations');
    expect(routes).not.toContain('/certificates');
  });

  it('splits mobile navigation into admin primary items for tenant admins', () => {
    const visible = getVisibleNavItems(user('company_admin'), tenant('company_admin'));
    const groups = getMobileNavGroups(visible, false, user('company_admin'), tenant('company_admin'));

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/', '/operations', '/members', '/settings']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toEqual(['/reports']);
  });

  it('keeps operational tools available inside the operations hub', () => {
    const routes = getVisibleOperationalNavItems(user('company_admin'), tenant('company_admin', {
      'attendance.enabled': false,
    })).map((item) => item.to);

    expect(routes).toContain('/courses');
    expect(routes).toContain('/groups');
    expect(routes).toContain('/sessions');
    expect(routes).not.toContain('/attendance');
  });

  it('prioritizes daily teaching work on instructor mobile navigation', () => {
    const visible = getVisibleNavItems(user('instructor'), tenant('instructor'));
    const groups = getMobileNavGroups(visible, false, user('instructor'), tenant('instructor'));

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/sessions', '/attendance', '/homework', '/courses']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/settings');
  });

  it('counts enabled staff tools from current feature flags', () => {
    expect(countEnabledStaffTools(tenant('company_admin', { 'attendance.enabled': false }))).toBe(2);
    expect(countEnabledStaffTools(tenant('company_admin', { attendance: false }))).toBe(2);
  });
});
