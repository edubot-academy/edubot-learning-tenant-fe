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
    expect(getVisibleNavItems(user('student'), tenant('student')).map((item) => item.to)).toEqual([
      '/student/today',
      '/student/todo',
      '/student/courses',
      '/student/materials',
      '/student/progress',
      '/student/help',
    ]);
  });

  it('keeps instructor navigation focused on teaching work', () => {
    const routes = getVisibleNavItems(user('instructor'), tenant('instructor')).map((item) => item.to);

    expect(routes).toEqual(['/', '/sessions', '/attendance', '/homework', '/groups', '/certificates', '/settings']);
    expect(routes).toContain('/sessions');
    expect(routes).toContain('/certificates');
    expect(routes).not.toContain('/members');
    expect(routes).not.toContain('/courses');
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

  it('keeps plain assistants off the instructor teaching navigation surface', () => {
    const routes = getVisibleNavItems(user('assistant'), tenant('assistant')).map((item) => item.to);

    expect(routes).toEqual(['/', '/operations', '/groups', '/sessions', '/support', '/settings']);
    expect(routes).not.toContain('/reports');
    expect(routes).not.toContain('/attendance');
    expect(routes).not.toContain('/homework');
  });

  it('shows optional assistant reports without teaching tools', () => {
    const routes = getVisibleNavItems(user('assistant'), tenant('assistant', {}, {
      canViewOperationalReports: true,
    })).map((item) => item.to);

    expect(routes).toContain('/reports');
    expect(routes).toContain('/support');
    expect(routes).not.toContain('/attendance');
    expect(routes).not.toContain('/homework');
  });

  it('uses admin navigation for teaching roles with management permissions', () => {
    const routes = getVisibleNavItems(user('instructor'), tenant('instructor', {}, {
      canManageMembers: true,
    })).map((item) => item.to);

    expect(routes).toContain('/members');
    expect(routes).toContain('/operations');
    expect(routes).not.toContain('/sessions');
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
      canManageCourses: true,
    })).map((item) => item.to);

    expect(routes).toContain('/members');
    expect(routes).toContain('/operations');
    expect(routes).toContain('/courses');
    expect(routes).toContain('/certificates');
  });

  it('hides support when support context exists without operational learning access', () => {
    const routes = getVisibleNavItems(user('assistant'), tenant('assistant', {}, {
      canSupportOperations: false,
      canViewStudentSupportContext: true,
      canViewOperationalCourses: false,
      canViewOperationalGroups: false,
      canViewOperationalSessions: false,
    })).map((item) => item.to);

    expect(routes).not.toContain('/support');
    expect(routes).not.toContain('/groups');
    expect(routes).not.toContain('/sessions');
  });

  it('keeps assistant operations focused on coordination read surfaces', () => {
    const routes = getVisibleOperationalNavItems(user('assistant'), tenant('assistant')).map((item) => item.to);

    expect(routes).toEqual(['/groups', '/sessions']);
    expect(routes).not.toContain('/courses');
    expect(routes).not.toContain('/attendance');
    expect(routes).not.toContain('/homework');
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

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/sessions', '/attendance', '/homework', '/']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/settings');
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/groups');
  });

  it('prioritizes support work on assistant mobile navigation', () => {
    const visible = getVisibleNavItems(user('assistant'), tenant('assistant'));
    const groups = getMobileNavGroups(visible, false, user('assistant'), tenant('assistant'));

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/', '/support', '/groups', '/sessions']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/operations');
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/settings');
  });

  it('keeps student mobile navigation focused on daily learner actions', () => {
    const visible = getVisibleNavItems(user('student'), tenant('student'));
    const groups = getMobileNavGroups(visible, true, user('student'), tenant('student'));

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/student/today', '/student/todo', '/student/courses', '/student/materials']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toEqual(['/student/progress', '/student/help']);
  });

  it('counts enabled staff tools from current feature flags', () => {
    expect(countEnabledStaffTools(tenant('company_admin', { 'attendance.enabled': false }))).toBe(2);
    expect(countEnabledStaffTools(tenant('company_admin', { attendance: false }))).toBe(2);
  });
});
