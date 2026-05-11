import type { AuthUser, Tenant } from '../../types/domain';

export type TenantAccessLevel = 'platform' | 'tenant_admin' | 'instructor' | 'assistant' | 'student' | 'none';

const platformAdminRoles = new Set(['superadmin']);
const tenantAdminRoles = new Set(['owner', 'company_admin', 'admin']);
const teachingRoles = new Set(['instructor', 'assistant']);

function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toLowerCase();
}

export function getEffectiveTenantRole(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return normalizeRole(tenant?.role || user?.role);
}

export function isPlatformAdmin(user: AuthUser | null | undefined) {
  return platformAdminRoles.has(normalizeRole(user?.role));
}

export function isTenantAdmin(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const role = getEffectiveTenantRole(user, tenant);
  return tenantAdminRoles.has(role);
}

export function isTenantStaff(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const role = getEffectiveTenantRole(user, tenant);
  return tenantAdminRoles.has(role) || teachingRoles.has(role);
}

export function isTenantStudent(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return getEffectiveTenantRole(user, tenant) === 'student';
}

export function getTenantAccessLevel(user: AuthUser | null | undefined, tenant: Tenant | null | undefined): TenantAccessLevel {
  if (isPlatformAdmin(user)) return 'none';
  const role = getEffectiveTenantRole(user, tenant);
  if (tenantAdminRoles.has(role)) return 'tenant_admin';
  if (role === 'instructor') return 'instructor';
  if (role === 'assistant') return 'assistant';
  if (role === 'student') return 'student';
  return 'none';
}

export function canManageTenantMembers(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return isTenantAdmin(user, tenant);
}

export function canManageTenantProfile(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return isTenantAdmin(user, tenant);
}

export function canOperateTenantLearning(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return isTenantStaff(user, tenant);
}

export function canManageTenantCertificates(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const role = getEffectiveTenantRole(user, tenant);
  return tenantAdminRoles.has(role) || role === 'instructor';
}
