import { describe, expect, it } from 'vitest';
import type { AuthUser, Tenant } from '../../types/domain';
import {
  canApproveAssignedCertificates,
  canCoordinateTenantLearning,
  canEnrollTenantStudents,
  canManageTenantBranding,
  canManageTenantCourses,
  canManageTenantMembers,
  canManageTenantOwners,
  canManageTenantSettings,
  canOperateTenantLearning,
  canTeachAssignedSessions,
  canViewTenantReports,
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

const tenantWithRoles = (roles: string[]): Tenant => ({
  id: 10,
  name: 'Tenant',
  roles,
});

const tenantWithPermissions = (permissions: Tenant['permissions'], role: string | null = 'student'): Tenant => ({
  id: 10,
  name: 'Tenant',
  role,
  permissions,
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

  it('uses tenant roles array when workspace role is not a scalar', () => {
    expect(getEffectiveTenantRole(user('admin'), tenantWithRoles(['owner']))).toBe('owner');
    expect(getTenantAccessLevel(user('admin'), tenantWithRoles(['owner']))).toBe('tenant_admin');
    expect(canManageTenantMembers(user('admin'), tenantWithRoles(['owner']))).toBe(true);
  });

  it('chooses the highest tenant role from multiple workspace roles', () => {
    expect(getEffectiveTenantRole(user('admin'), tenantWithRoles(['student', 'instructor', 'owner']))).toBe('owner');
  });

  it('allows tenant admin and instructors to operate learning workflows with separate coordination rights', () => {
    expect(canManageTenantMembers(user('student'), tenant('company_admin'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('instructor'))).toBe(true);
    expect(canOperateTenantLearning(user('student'), tenant('assistant'))).toBe(false);
    expect(canOperateTenantLearning(user('student'), tenant('student'))).toBe(false);
    expect(canTeachAssignedSessions(user('student'), tenant('instructor'))).toBe(true);
    expect(canTeachAssignedSessions(user('student'), tenant('assistant'))).toBe(false);
    expect(canCoordinateTenantLearning(user('student'), tenant('instructor'))).toBe(false);
    expect(canEnrollTenantStudents(user('student'), tenant('instructor'))).toBe(false);
    expect(canCoordinateTenantLearning(user('student'), tenant('company_admin'))).toBe(true);
  });

  it('prefers explicit tenant permissions over broad tenant admin role fallback', () => {
    const restrictedAdmin = tenantWithPermissions({
      canManageMembers: false,
      canManageCourses: true,
      canManageBranding: false,
      canManageSettings: true,
      canViewReports: true,
    }, 'company_admin');

    expect(canManageTenantMembers(user('company_admin'), restrictedAdmin)).toBe(false);
    expect(canManageTenantCourses(user('company_admin'), restrictedAdmin)).toBe(true);
    expect(canManageTenantBranding(user('company_admin'), restrictedAdmin)).toBe(false);
    expect(canManageTenantSettings(user('company_admin'), restrictedAdmin)).toBe(true);
    expect(canViewTenantReports(user('company_admin'), restrictedAdmin)).toBe(true);
  });

  it('allows permission-granted managers without owner or company_admin roles', () => {
    const courseManager = tenantWithPermissions({
      canManageCourses: true,
      canManageMembers: false,
    }, 'assistant');

    expect(canManageTenantCourses(user('assistant'), courseManager)).toBe(true);
    expect(canOperateTenantLearning(user('assistant'), courseManager)).toBe(true);
    expect(canCoordinateTenantLearning(user('assistant'), courseManager)).toBe(true);
    expect(canManageTenantMembers(user('assistant'), courseManager)).toBe(false);
  });

  it('supports explicit instructor capability grants and denials', () => {
    expect(canTeachAssignedSessions(user('student'), tenantWithPermissions({ canTeachAssignedSessions: true }, null))).toBe(true);
    expect(getTenantAccessLevel(user('student'), tenantWithPermissions({ canTeachAssignedSessions: true }, null))).toBe('instructor');
    expect(canTeachAssignedSessions(user('instructor'), tenantWithPermissions({ canTeachAssignedSessions: false }, 'instructor'))).toBe(false);
    expect(canCoordinateTenantLearning(user('instructor'), tenantWithPermissions({ canCoordinateGroups: true }, 'instructor'))).toBe(true);
    expect(canEnrollTenantStudents(user('instructor'), tenantWithPermissions({ canEnrollStudents: true }, 'instructor'))).toBe(true);
    expect(canApproveAssignedCertificates(user('instructor'), tenant('instructor'))).toBe(true);
  });

  it('allows workspace access from explicit management permissions even without a scalar role', () => {
    expect(getTenantAccessLevel(user('admin'), tenantWithPermissions({ canManageCourses: true }, null))).toBe('tenant_admin');
  });

  it('keeps owner management owner-only unless explicit permission is present', () => {
    expect(canManageTenantOwners(user('owner'), tenant('owner'))).toBe(true);
    expect(canManageTenantOwners(user('company_admin'), tenant('company_admin'))).toBe(false);
    expect(canManageTenantOwners(user('company_admin'), tenantWithPermissions({ canManageOwners: true }, 'company_admin'))).toBe(true);
  });
});
