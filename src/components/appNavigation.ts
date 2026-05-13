import { FiAward, FiBookOpen, FiCalendar, FiCheckSquare, FiClipboard, FiHome, FiSettings, FiUsers } from 'react-icons/fi';
import type { AuthUser, Tenant } from '../types/domain';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import { canManageTenantCertificates, canManageTenantMembers, isTenantStudent } from '../features/tenant/tenantRoles';

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

export const studentNavItems = [
  { to: '/student', labelKey: 'navigation.myLearning', icon: FiHome },
  { to: '/settings', labelKey: 'navigation.settings', icon: FiSettings },
] satisfies NavItem[];

export const primaryMobileRoutes = new Set(['/', '/courses', '/groups', '/sessions']);

export function getVisibleNavItems(user: AuthUser | null | undefined, tenant: Tenant | null | undefined) {
  const learnerView = isTenantStudent(user, tenant);
  const navItems: NavItem[] = learnerView
    ? studentNavItems
    : staffNavItems.filter((item) => {
      if (item.to === '/members') return canManageTenantMembers(user, tenant);
      if (item.to === '/certificates') return canManageTenantCertificates(user, tenant);
      return true;
    });

  return navItems.filter((item) => !item.feature || isTenantFeatureEnabled(tenant, item.feature));
}

export function getMobileNavGroups(visibleNavItems: NavItem[], learnerView: boolean) {
  const primaryMobileNavItems = learnerView
    ? visibleNavItems
    : visibleNavItems.filter((item) => primaryMobileRoutes.has(item.to)).slice(0, 4);
  const secondaryMobileNavItems = visibleNavItems.filter((item) => !primaryMobileNavItems.some((primaryItem) => primaryItem.to === item.to));

  return { primaryMobileNavItems, secondaryMobileNavItems };
}

export function countEnabledStaffTools(tenant: Tenant | null | undefined) {
  return staffNavItems.filter((item) => item.feature && isTenantFeatureEnabled(tenant, item.feature)).length;
}
