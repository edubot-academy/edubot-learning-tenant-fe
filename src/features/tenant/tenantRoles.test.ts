import { describe, expect, it } from 'vitest';
import type { AuthUser, Tenant } from '../../types/domain';
import {
  canManageTenantMembers,
  canOperateTenantLearning,
  getEffectiveTenantRole,
  getTenantAccessLevel,
  isPlatformAdmin,
} from './tenantRoles';

const user = (role: string): AuthUser => ({
  id: 1,
  email: 'user@example.com',
  role,
});

const tenant = (role: string | null): Tenant => ({
  id: 10,
  name: 'Tenant',
  role,
});

describe('tenant role access', () => {
  it('treats superadmin as platform-wide access', () => {
    expect(isPlatformAdmin(user('superadmin'))).toBe(true);
    expect(getTenantAccessLevel(user('superadmin'), tenant('student'))).toBe('platform');
    expect(canManageTenantMembers(user('superadmin'), tenant('student'))).toBe(true);
  });

  it('keeps admin scoped to tenant access instead of platform access', () => {
    expect(isPlatformAdmin(user('admin'))).toBe(false);
    expect(getEffectiveTenantRole(user('admin'), tenant('student'))).toBe('student');
    expect(getTenantAccessLevel(user('admin'), tenant('student'))).toBe('student');
    expect(canManageTenantMembers(user('admin'), tenant('student'))).toBe(false);
  });

  it('allows tenant admin and teaching roles to operate learning workflows', () => {
    expect(canManageTenantMembers(user('student'), tenant('company_admin'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('instructor'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('assistant'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('student'))).toBe(false);
  });
});
