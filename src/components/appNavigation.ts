import { FiAward, FiBarChart2, FiBookOpen, FiCalendar, FiCheckSquare, FiClipboard, FiGrid, FiHelpCircle, FiHome, FiLifeBuoy, FiPlayCircle, FiSettings, FiUsers } from 'react-icons/fi';
import type { AuthUser, Tenant } from '../types/domain';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import {
  canManageTenantCertificates,
  canManageTenantCourses,
  canManageTenantMembers,
  canManageTenantProfile,
  canManageTenantSettings,
  canApproveAssignedCertificates,
  canCoordinateTenantLearning,
  canManageAssignedAttendance,
  canManageAssignedHomework,
  canOperateTenantLearning,
  canSupportTenantOperations,
  canTeachAssignedSessions,
  canViewAssignedLearning,
  canViewOperationalLearning,
  canViewOperationalReports,
  canViewStudentSupportContext,
  canViewTenantReports,
  getEffectiveTenantRole,
  isTenantStudent,
} from '../features/tenant/tenantRoles';

export type NavItem = { to: string; labelKey: string; icon: typeof FiHome; feature?: TenantFeatureKey };

export const staffNavItems = [
  { to: '/', labelKey: 'navigation.overview', icon: FiHome },
  { to: '/courses', labelKey: 'navigation.courses', icon: FiBookOpen },
  { to: '/groups', labelKey: 'navigation.groups', icon: FiUsers },
  { to: '/sessions', labelKey: 'navigation.sessions', icon: FiCalendar },
  { to: '/attendance', labelKey: 'navigation.attendance', icon: FiCheckSquare, feature: 'attendance.enabled' },
  { to: '/homework', labelKey: 'navigation.homework', icon: FiClipboard, feature: 'homework.enabled' },
  { to: '/certificates', labelKey: 'navigation.certificates', icon: FiAward, feature: 'certificates.enabled' },
  { to: '/members', labelKey: 'navigation.members', icon: FiUsers },
  { to: '/settings', labelKey: 'navigation.settings', icon: FiSettings },
] satisfies NavItem[];

export const instructorNavItems = [
  { to: '/', labelKey: 'navigation.overview', icon: FiHome },
  { to: '/sessions', labelKey: 'navigation.sessions', icon: FiCalendar },
  { to: '/attendance', labelKey: 'navigation.attendance', icon: FiCheckSquare, feature: 'attendance.enabled' },
  { to: '/homework', labelKey: 'navigation.homework', icon: FiClipboard, feature: 'homework.enabled' },
  { to: '/groups', labelKey: 'navigation.groups', icon: FiUsers },
  { to: '/certificates', labelKey: 'navigation.certificates', icon: FiAward, feature: 'certificates.enabled' },
  { to: '/settings', labelKey: 'navigation.settings', icon: FiSettings },
] satisfies NavItem[];

export const operationalNavItems = [
  { to: '/courses', labelKey: 'navigation.courses', icon: FiBookOpen },
  { to: '/groups', labelKey: 'navigation.groups', icon: FiUsers },
  { to: '/sessions', labelKey: 'navigation.sessions', icon: FiCalendar },
  { to: '/attendance', labelKey: 'navigation.attendance', icon: FiCheckSquare, feature: 'attendance.enabled' },
  { to: '/homework', labelKey: 'navigation.homework', icon: FiClipboard, feature: 'homework.enabled' },
  { to: '/certificates', labelKey: 'navigation.certificates', icon: FiAward, feature: 'certificates.enabled' },
] satisfies NavItem[];

export const adminNavItems = [
  { to: '/', labelKey: 'navigation.overview', icon: FiHome },
  { to: '/reports', labelKey: 'navigation.reports', icon: FiBarChart2 },
  { to: '/operations', labelKey: 'navigation.operations', icon: FiGrid },
  { to: '/members', labelKey: 'navigation.members', icon: FiUsers },
  { to: '/settings', labelKey: 'navigation.settings', icon: FiSettings },
] satisfies NavItem[];

export const studentNavItems = [
  { to: '/student/today', labelKey: 'student.today', icon: FiHome },
  { to: '/student/todo', labelKey: 'student.toDo', icon: FiCheckSquare },
  { to: '/student/courses', labelKey: 'navigation.courses', icon: FiBookOpen },
  { to: '/student/materials', labelKey: 'student.materials', icon: FiPlayCircle },
  { to: '/student/progress', labelKey: 'student.progress', icon: FiBarChart2 },
  { to: '/student/help', labelKey: 'student.help', icon: FiHelpCircle },
] satisfies NavItem[];

export const assistantNavItems = [
  { to: '/', labelKey: 'navigation.overview', icon: FiHome },
  { to: '/operations', labelKey: 'navigation.operations', icon: FiGrid },
  { to: '/courses', labelKey: 'navigation.courses', icon: FiBookOpen },
  { to: '/groups', labelKey: 'navigation.groups', icon: FiUsers },
  { to: '/sessions', labelKey: 'navigation.sessions', icon: FiCalendar },
  { to: '/support', labelKey: 'navigation.support', icon: FiLifeBuoy },
  { to: '/certificates', labelKey: 'navigation.certificates', icon: FiAward, feature: 'certificates.enabled' },
  { to: '/reports', labelKey: 'navigation.reports', icon: FiBarChart2 },
  { to: '/members', labelKey: 'navigation.members', icon: FiUsers },
  { to: '/settings', labelKey: 'navigation.settings', icon: FiSettings },
] satisfies NavItem[];

export const primaryMobileRoutes = new Set(['/', '/courses', '/groups', '/sessions']);

const mobileRoutePriorityByRole: Record<string, string[]> = {
  instructor: ['/sessions', '/attendance', '/homework', '/'],
  assistant: ['/', '/support', '/groups', '/sessions'],
  owner: ['/', '/operations', '/members', '/settings'],
  company_admin: ['/', '/operations', '/members', '/settings'],
  student: ['/student/today', '/student/todo', '/student/courses', '/student/materials'],
};

export function getVisibleOperationalNavItems(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return operationalNavItems.filter((item) => {
    if (item.to === '/certificates') {
      return canManageTenantCertificates(user, tenant) && (!item.feature || isTenantFeatureEnabled(tenant, item.feature));
    }
    if (item.to === '/courses' && !canCoordinateTenantLearning(user, tenant)) return false;
    if (['/groups', '/sessions'].includes(item.to) && !canViewOperationalLearning(user, tenant) && !canOperateTenantLearning(user, tenant)) return false;
    if (item.to === '/attendance' && !canManageAssignedAttendance(user, tenant) && !canManageTenantCourses(user, tenant)) return false;
    if (item.to === '/homework' && !canManageAssignedHomework(user, tenant) && !canManageTenantCourses(user, tenant)) return false;
    if (!canViewOperationalLearning(user, tenant) && !canOperateTenantLearning(user, tenant)) return false;
    return !item.feature || isTenantFeatureEnabled(tenant, item.feature);
  });
}

function shouldUseAdminNavigation(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const role = getEffectiveTenantRole(user, tenant);
  const teachingRole = role === 'instructor';
  if (teachingRole) {
    return canManageTenantMembers(user, tenant)
      || canManageTenantProfile(user, tenant)
      || canManageTenantSettings(user, tenant);
  }

  return canManageTenantMembers(user, tenant)
    || canManageTenantProfile(user, tenant)
    || canManageTenantSettings(user, tenant)
    || canViewTenantReports(user, tenant)
    || canViewOperationalReports(user, tenant);
}

export function getVisibleNavItems(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const learnerView = isTenantStudent(user, tenant);
  if (learnerView) return studentNavItems;
  if (getEffectiveTenantRole(user, tenant) === 'assistant') {
    return assistantNavItems.filter((item) => {
      if (item.to === '/operations') return getVisibleOperationalNavItems(user, tenant).length > 0;
      if (item.to === '/courses') return canManageTenantCourses(user, tenant);
      if (['/groups', '/sessions'].includes(item.to)) return canViewOperationalLearning(user, tenant) || canOperateTenantLearning(user, tenant);
      if (item.to === '/support') return canViewStudentSupportContext(user, tenant) && (canViewOperationalLearning(user, tenant) || canOperateTenantLearning(user, tenant));
      if (item.to === '/certificates') return canManageTenantCertificates(user, tenant) && (!item.feature || isTenantFeatureEnabled(tenant, item.feature));
      if (item.to === '/reports') return canViewOperationalReports(user, tenant) || canViewTenantReports(user, tenant);
      if (item.to === '/members') return canManageTenantMembers(user, tenant);
      if (item.to === '/settings') {
        return canSupportTenantOperations(user, tenant)
          || canOperateTenantLearning(user, tenant)
          || canManageTenantProfile(user, tenant)
          || canManageTenantSettings(user, tenant);
      }
      return true;
    });
  }

  if (shouldUseAdminNavigation(user, tenant)) {
    const visibleOperations = getVisibleOperationalNavItems(user, tenant);
    return adminNavItems.filter((item) => {
      if (item.to === '/reports') return canViewTenantReports(user, tenant) || canViewOperationalReports(user, tenant);
      if (item.to === '/operations') return visibleOperations.length > 0;
      if (item.to === '/members') return canManageTenantMembers(user, tenant);
      if (item.to === '/settings') {
        return canManageTenantProfile(user, tenant)
          || canManageTenantSettings(user, tenant)
          || canOperateTenantLearning(user, tenant);
      }
      return true;
    });
  }

  if (canTeachAssignedSessions(user, tenant) || canViewAssignedLearning(user, tenant)) {
    return instructorNavItems.filter((item) => {
      if (item.to === '/certificates') return canApproveAssignedCertificates(user, tenant);
      return !item.feature || isTenantFeatureEnabled(tenant, item.feature);
    });
  }

  const navItems: NavItem[] = learnerView
    ? studentNavItems
    : staffNavItems.filter((item) => {
      if (item.to === '/members') return canManageTenantMembers(user, tenant);
      if (item.to === '/certificates') return canManageTenantCertificates(user, tenant);
      return true;
    });

  return navItems.filter((item) => !item.feature || isTenantFeatureEnabled(tenant, item.feature));
}

export function getMobileNavGroups(
  visibleNavItems: NavItem[],
  learnerView: boolean,
  user?: AuthUser | null,
  tenant?: Tenant | null,
) {
  const role = getEffectiveTenantRole(user, tenant);
  const preferredRoutes = mobileRoutePriorityByRole[role] ?? Array.from(primaryMobileRoutes);
  const preferredPrimaryItems = preferredRoutes
    .map((route) => visibleNavItems.find((item) => item.to === route))
    .filter((item): item is NavItem => Boolean(item));
  const overflowPrimaryItems = visibleNavItems.filter((item) => !preferredPrimaryItems.some((primaryItem) => primaryItem.to === item.to));
  const primaryMobileItemLimit = learnerView ? Math.min(4, visibleNavItems.length) : 4;
  const primaryMobileNavItems = [...preferredPrimaryItems, ...overflowPrimaryItems].slice(0, primaryMobileItemLimit);
  const secondaryMobileNavItems = visibleNavItems.filter((item) => !primaryMobileNavItems.some((primaryItem) => primaryItem.to === item.to));

  return { primaryMobileNavItems, secondaryMobileNavItems };
}

export function countEnabledStaffTools(tenant: Tenant | null | undefined) {
  return staffNavItems.filter((item) => item.feature && isTenantFeatureEnabled(tenant, item.feature)).length;
}
