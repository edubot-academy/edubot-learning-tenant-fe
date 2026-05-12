import { describe, expect, it } from 'vitest';
import type { Tenant } from '../../types/domain';
import { isTenantFeatureEnabled } from './tenantFeatures';

const tenant = (featureFlags: Tenant['featureFlags'] = {}): Tenant => ({
  id: 1,
  name: 'Tenant',
  featureFlags,
});

describe('tenant feature flags', () => {
  it('treats missing flags as enabled for current tenant defaults', () => {
    expect(isTenantFeatureEnabled(tenant(), 'attendance.enabled')).toBe(true);
  });

  it('only disables a feature on explicit false', () => {
    expect(isTenantFeatureEnabled(tenant({ 'attendance.enabled': false }), 'attendance.enabled')).toBe(false);
    expect(isTenantFeatureEnabled(tenant({ 'attendance.enabled': true }), 'attendance.enabled')).toBe(true);
  });
});
