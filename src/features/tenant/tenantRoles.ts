import type { AuthUser, Tenant } from '../../types/domain';

export type TenantAccessLevel = 'platform' | 'tenant_admin' | 'instructor' | 'assistant' | 'student' | 'none';

const platformAdminRoles = new Set(['superadmin']);
const tenantAdminRoles = new Set(['owner', 'company_admin']);
const teachingRoles = new Set(['instructor']);
const tenantRolePriority = ['owner', 'company_admin', 'instructor', 'assistant', 'student'];

function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toLowerCase();
}

function explicitPermission(tenant: Tenant | null | undefined, key: keyof NonNullable<Tenant['permissions']>) {
  const value = tenant?.permissions?.[key];
  return typeof value === 'boolean' ? value : null;
}

function hasAnyExplicitPermission(tenant: Tenant | null | undefined, keys: Array<keyof NonNullable<Tenant['permissions']>>) {
  return keys.some((key) => tenant?.permissions?.[key] === true);
}

export function getEffectiveTenantRole(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const tenantRole = normalizeRole(tenant?.role);
  if (tenantRole) return tenantRole;
  const tenantRoles = (tenant?.roles ?? []).map(normalizeRole).filter(Boolean);
  const primaryTenantRole = tenantRolePriority.find((role) => tenantRoles.includes(role));
  if (primaryTenantRole) return primaryTenantRole;
  const userRole = normalizeRole(user?.role);
  return userRole === 'admin' || userRole === 'superadmin' ? '' : userRole;
}

export function isPlatformAdmin(user: AuthUser | null | undefined) {
  return platformAdminRoles.has(normalizeRole(user?.role));
}

export function isTenantAdmin(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  if (hasAnyExplicitPermission(tenant, ['canManageTenant', 'canManageOwners', 'canManageMembers', 'canManageSettings'])) return true;
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
  if (tenant?.availability?.enabled === false || tenant?.permissions?.canEnterWorkspace === false) return 'none';
  const role = getEffectiveTenantRole(user, tenant);
  if (tenantAdminRoles.has(role)) return 'tenant_admin';
  if (role === 'instructor') return 'instructor';
  if (role === 'assistant') return 'assistant';
  if (hasAnyExplicitPermission(tenant, [
    'canTeachAssignedSessions',
    'canViewAssignedCourses',
    'canViewAssignedGroups',
    'canManageAssignedAttendance',
    'canManageAssignedHomework',
    'canManageAssignedActivities',
    'canManageAssignedMaterials',
    'canManageAssignedLiveMeetings',
    'canApproveAssignedCertificates',
  ])) return 'instructor';
  if (role === 'student') return 'student';
  if (hasAnyExplicitPermission(tenant, [
    'canManageTenant',
    'canManageOwners',
    'canManageMembers',
    'canManageCourses',
    'canManageCertificates',
    'canViewReports',
    'canManageBranding',
    'canManageSettings',
  ])) return 'tenant_admin';
  return 'none';
}

export function canEnterTenantWorkspace(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return getTenantAccessLevel(user, tenant) !== 'none';
}

export function canManageTenantOwners(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageOwners');
  if (permission !== null) return permission;
  return getEffectiveTenantRole(user, tenant) === 'owner';
}

export function canManageTenantMembers(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageMembers');
  if (permission !== null) return permission;
  return isTenantAdmin(user, tenant);
}

export function canManageTenantProfile(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const tenantPermission = explicitPermission(tenant, 'canManageTenant');
  if (tenantPermission !== null) return tenantPermission;
  const settingsPermission = explicitPermission(tenant, 'canManageSettings');
  if (settingsPermission !== null) return settingsPermission;
  return isTenantAdmin(user, tenant);
}

export function canManageTenantBranding(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageBranding');
  if (permission !== null) return permission;
  return canManageTenantProfile(user, tenant);
}

export function canManageTenantSettings(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageSettings');
  if (permission !== null) return permission;
  return isTenantAdmin(user, tenant);
}

export function canManageTenantCourses(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageCourses');
  if (permission !== null) return permission;
  return isTenantAdmin(user, tenant);
}

export function canApproveTenantCourses(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canApproveCourses');
  if (permission !== null) return permission;
  return canManageTenantCourses(user, tenant);
}

export function canViewTenantReports(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canViewReports');
  if (permission !== null) return permission;
  return isTenantAdmin(user, tenant);
}

export function canOperateTenantLearning(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return canTeachAssignedSessions(user, tenant) || canCoordinateTenantLearning(user, tenant);
}

export function canManageTenantCertificates(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageCertificates');
  if (permission !== null) return permission;
  const role = getEffectiveTenantRole(user, tenant);
  return tenantAdminRoles.has(role);
}

export function canViewAssignedLearning(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const coursePermission = explicitPermission(tenant, 'canViewAssignedCourses');
  const groupPermission = explicitPermission(tenant, 'canViewAssignedGroups');
  if (coursePermission !== null || groupPermission !== null) return coursePermission === true || groupPermission === true;
  return teachingRoles.has(getEffectiveTenantRole(user, tenant));
}

export function canTeachAssignedSessions(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canTeachAssignedSessions');
  if (permission !== null) return permission;
  return teachingRoles.has(getEffectiveTenantRole(user, tenant));
}

export function canManageAssignedAttendance(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageAssignedAttendance');
  if (permission !== null) return permission;
  return canTeachAssignedSessions(user, tenant);
}

export function canManageAssignedHomework(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageAssignedHomework');
  if (permission !== null) return permission;
  return canTeachAssignedSessions(user, tenant);
}

export function canManageAssignedActivities(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageAssignedActivities');
  if (permission !== null) return permission;
  return canTeachAssignedSessions(user, tenant);
}

export function canManageAssignedMaterials(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageAssignedMaterials');
  if (permission !== null) return permission;
  return canTeachAssignedSessions(user, tenant);
}

export function canManageAssignedLiveMeetings(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canManageAssignedLiveMeetings');
  if (permission !== null) return permission;
  return canTeachAssignedSessions(user, tenant);
}

export function canCoordinateTenantLearning(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canCoordinateGroups');
  if (permission !== null) return permission;
  return canManageTenantCourses(user, tenant);
}

export function canEnrollTenantStudents(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canEnrollStudents');
  if (permission !== null) return permission;
  return canCoordinateTenantLearning(user, tenant);
}

export function canApproveAssignedCertificates(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  if (isPlatformAdmin(user)) return false;
  const permission = explicitPermission(tenant, 'canApproveAssignedCertificates');
  if (permission !== null) return permission;
  return getEffectiveTenantRole(user, tenant) === 'instructor';
}
