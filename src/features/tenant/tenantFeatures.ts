import type { Tenant } from '../../types/domain';

export type TenantFeatureKey =
  | 'courses.video.enabled'
  | 'courses.offline.enabled'
  | 'courses.onlineLive.enabled'
  | 'certificates.enabled'
  | 'attendance.enabled'
  | 'homework.enabled'
  | 'aiAssistant.enabled';

const featureFlagAliases: Partial<Record<TenantFeatureKey, string[]>> = {
  'attendance.enabled': ['attendance'],
  'homework.enabled': ['homework'],
  'certificates.enabled': ['certificates'],
  'courses.onlineLive.enabled': ['liveSessions'],
};

export function isTenantFeatureEnabled(tenant: Tenant | null | undefined, key: TenantFeatureKey) {
  const flags = tenant?.featureFlags ?? {};
  if (Object.prototype.hasOwnProperty.call(flags, key)) return flags[key] !== false;
  return !(featureFlagAliases[key] ?? []).some((alias) => flags[alias] === false);
}
