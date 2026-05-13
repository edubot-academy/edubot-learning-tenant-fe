import { describe, expect, it } from 'vitest';
import type { AuthUser, Tenant } from '../types/domain';
import { countEnabledStaffTools, getMobileNavGroups, getVisibleNavItems } from './appNavigation';

const user = (role: string): AuthUser => ({
  id: 1,
  email: 'user@example.com',
  role,
});

const tenant = (role: string, featureFlags: Tenant['featureFlags'] = {}): Tenant => ({
  id: 10,
  name: 'Tenant',
  role,
  featureFlags,
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
  });

  it('splits mobile navigation into primary and more items for staff', () => {
    const visible = getVisibleNavItems(user('company_admin'), tenant('company_admin'));
    const groups = getMobileNavGroups(visible, false, user('company_admin'), tenant('company_admin'));

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/', '/courses', '/members', '/settings']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/sessions');
  });

  it('prioritizes daily teaching work on instructor mobile navigation', () => {
    const visible = getVisibleNavItems(user('instructor'), tenant('instructor'));
    const groups = getMobileNavGroups(visible, false, user('instructor'), tenant('instructor'));

    expect(groups.primaryMobileNavItems.map((item) => item.to)).toEqual(['/sessions', '/attendance', '/homework', '/courses']);
    expect(groups.secondaryMobileNavItems.map((item) => item.to)).toContain('/settings');
  });

  it('counts enabled staff tools from current feature flags', () => {
    expect(countEnabledStaffTools(tenant('company_admin', { 'attendance.enabled': false }))).toBe(2);
  });
});
