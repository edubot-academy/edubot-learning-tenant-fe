import { describe, expect, it } from 'vitest';
import type { AuthUser, Tenant } from '../types/domain';
import { canAccessTenantPermissionSurface, type TenantPermissionSurface } from './routePermissions';

const user = (role: string): AuthUser => ({
  id: 1,
  email: 'user@example.com',
  role,
});

const tenant = (role: string, permissions: Tenant['permissions'] = {}): Tenant => ({
  id: 10,
  name: 'Tenant',
  role,
  permissions,
});

const surfaces: TenantPermissionSurface[] = ['members', 'courses', 'branding', 'settings', 'reports', 'owners'];

describe('tenant route permission surfaces', () => {
  it('keeps platform admins out of all tenant permission surfaces', () => {
    expect(surfaces.map((surface) => canAccessTenantPermissionSurface(surface, user('superadmin'), tenant('owner'))))
      .toEqual([false, false, false, false, false, false]);
  });

  it('applies owner fallback permissions across admin surfaces', () => {
    expect(Object.fromEntries(surfaces.map((surface) => [
      surface,
      canAccessTenantPermissionSurface(surface, user('owner'), tenant('owner')),
    ]))).toEqual({
      members: true,
      courses: true,
      branding: true,
      settings: true,
      reports: true,
      owners: true,
    });
  });

  it('keeps company admin ownership separate from other admin surfaces', () => {
    expect(Object.fromEntries(surfaces.map((surface) => [
      surface,
      canAccessTenantPermissionSurface(surface, user('company_admin'), tenant('company_admin')),
    ]))).toEqual({
      members: true,
      courses: true,
      branding: true,
      settings: true,
      reports: true,
      owners: false,
    });
  });

  it('uses explicit permissions for assistant page-level access', () => {
    const assistantTenant = tenant('assistant', {
      canManageMembers: true,
      canManageCourses: true,
      canManageBranding: true,
      canManageSettings: true,
      canViewReports: true,
      canManageOwners: true,
    });

    expect(Object.fromEntries(surfaces.map((surface) => [
      surface,
      canAccessTenantPermissionSurface(surface, user('assistant'), assistantTenant),
    ]))).toEqual({
      members: true,
      courses: true,
      branding: true,
      settings: true,
      reports: true,
      owners: true,
    });
  });

  it('respects explicit denials over company admin fallback', () => {
    const restrictedAdmin = tenant('company_admin', {
      canManageMembers: false,
      canManageCourses: false,
      canManageBranding: false,
      canManageSettings: false,
      canViewReports: false,
      canManageOwners: false,
    });

    expect(Object.fromEntries(surfaces.map((surface) => [
      surface,
      canAccessTenantPermissionSurface(surface, user('company_admin'), restrictedAdmin),
    ]))).toEqual({
      members: false,
      courses: true,
      branding: false,
      settings: false,
      reports: false,
      owners: false,
    });
  });

  it('keeps report-only users out of settings permission surface', () => {
    const reportOnlyTenant = tenant('', {
      canViewReports: true,
    });

    expect(canAccessTenantPermissionSurface('reports', user('admin'), reportOnlyTenant)).toBe(true);
    expect(canAccessTenantPermissionSurface('settings', user('admin'), reportOnlyTenant)).toBe(false);
  });
});
