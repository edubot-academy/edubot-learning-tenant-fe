import type { AuthUser, Tenant } from '../types/domain';
import {
  canManageTenantBranding,
  canManageTenantCourses,
  canManageTenantMembers,
  canManageTenantOwners,
  canManageTenantSettings,
  canOperateTenantLearning,
  canViewTenantReports,
  isPlatformAdmin,
} from '../features/tenant/tenantRoles';

export type TenantPermissionSurface =
  | 'members'
  | 'courses'
  | 'branding'
  | 'settings'
  | 'reports'
  | 'owners';

export function canAccessTenantPermissionSurface(
  surface: TenantPermissionSurface,
  user: AuthUser | null | undefined,
  tenant: Tenant | null | undefined,
) {
  if (isPlatformAdmin(user)) return false;
  if (surface === 'members') return canManageTenantMembers(user, tenant);
  if (surface === 'courses') return canOperateTenantLearning(user, tenant) || canManageTenantCourses(user, tenant);
  if (surface === 'branding') return canManageTenantBranding(user, tenant);
  if (surface === 'settings') return canManageTenantSettings(user, tenant);
  if (surface === 'reports') return canViewTenantReports(user, tenant);
  if (surface === 'owners') return canManageTenantOwners(user, tenant);
  return false;
}
