import type { Tenant } from '../../types/domain';

export type TenantFeatureKey =
  | 'courses.video.enabled'
  | 'courses.offline.enabled'
  | 'courses.onlineLive.enabled'
  | 'certificates.enabled'
  | 'attendance.enabled'
  | 'homework.enabled'
  | 'aiAssistant.enabled';

export function isTenantFeatureEnabled(tenant: Tenant | null | undefined, key: TenantFeatureKey) {
  return tenant?.featureFlags?.[key] !== false;
}
