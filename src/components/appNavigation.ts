import { FiAward, FiBarChart2, FiBookOpen, FiCalendar, FiCheckSquare, FiClipboard, FiGrid, FiHome, FiSettings, FiUsers } from 'react-icons/fi';
import type { AuthUser, Tenant } from '../types/domain';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import {
  canManageTenantCertificates,
  canManageTenantMembers,
  canManageTenantProfile,
  canManageTenantSettings,
  canOperateTenantLearning,
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
  { to: '/student', labelKey: 'navigation.myLearning', icon: FiHome },
  { to: '/settings', labelKey: 'navigation.settings', icon: FiSettings },
] satisfies NavItem[];

export const primaryMobileRoutes = new Set(['/', '/courses', '/groups', '/sessions']);

const mobileRoutePriorityByRole: Record<string, string[]> = {
  instructor: ['/sessions', '/attendance', '/homework', '/courses'],
  assistant: ['/sessions', '/attendance', '/homework', '/courses'],
  owner: ['/', '/operations', '/members', '/settings'],
  company_admin: ['/', '/operations', '/members', '/settings'],
};

export function getVisibleOperationalNavItems(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return operationalNavItems.filter((item) => {
    if (item.to === '/certificates') {
      return canManageTenantCertificates(user, tenant) && (!item.feature || isTenantFeatureEnabled(tenant, item.feature));
    }
    if (!canOperateTenantLearning(user, tenant)) return false;
    return !item.feature || isTenantFeatureEnabled(tenant, item.feature);
  });
}

function shouldUseAdminNavigation(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  return canManageTenantMembers(user, tenant)
    || canManageTenantProfile(user, tenant)
    || canManageTenantSettings(user, tenant)
    || canViewTenantReports(user, tenant);
}

export function getVisibleNavItems(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const learnerView = isTenantStudent(user, tenant);
  if (learnerView) return studentNavItems;

  if (shouldUseAdminNavigation(user, tenant)) {
    const visibleOperations = getVisibleOperationalNavItems(user, tenant);
    return adminNavItems.filter((item) => {
      if (item.to === '/reports') return canViewTenantReports(user, tenant);
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
  const primaryMobileNavItems = learnerView
    ? visibleNavItems
    : [...preferredPrimaryItems, ...overflowPrimaryItems].slice(0, 4);
  const secondaryMobileNavItems = visibleNavItems.filter((item) => !primaryMobileNavItems.some((primaryItem) => primaryItem.to === item.to));

  return { primaryMobileNavItems, secondaryMobileNavItems };
}

export function countEnabledStaffTools(tenant: Tenant | null | undefined) {
  return staffNavItems.filter((item) => item.feature && isTenantFeatureEnabled(tenant, item.feature)).length;
}
