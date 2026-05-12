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
  it('keeps superadmin out of tenant workspace access', () => {
    expect(isPlatformAdmin(user('superadmin'))).toBe(true);
    expect(getTenantAccessLevel(user('superadmin'), tenant('student'))).toBe('none');
    expect(canManageTenantMembers(user('superadmin'), tenant('student'))).toBe(false);
  });

  it('keeps admin out of tenant workspace access without tenant membership', () => {
    expect(isPlatformAdmin(user('admin'))).toBe(false);
    expect(getEffectiveTenantRole(user('admin'), tenant(null))).toBe('');
    expect(getTenantAccessLevel(user('admin'), tenant(null))).toBe('none');
    expect(canManageTenantMembers(user('admin'), tenant(null))).toBe(false);
  });

  it('uses tenant membership role instead of platform role', () => {
    expect(getEffectiveTenantRole(user('admin'), tenant('student'))).toBe('student');
    expect(getTenantAccessLevel(user('admin'), tenant('student'))).toBe('student');
  });

  it('allows tenant admin and teaching roles to operate learning workflows', () => {
    expect(canManageTenantMembers(user('student'), tenant('company_admin'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('instructor'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('assistant'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('student'))).toBe(false);
  });
});
