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

  it('supports backend simple feature flag aliases', () => {
    expect(isTenantFeatureEnabled(tenant({ attendance: false }), 'attendance.enabled')).toBe(false);
    expect(isTenantFeatureEnabled(tenant({ homework: false }), 'homework.enabled')).toBe(false);
    expect(isTenantFeatureEnabled(tenant({ certificates: false }), 'certificates.enabled')).toBe(false);
    expect(isTenantFeatureEnabled(tenant({ liveSessions: false }), 'courses.onlineLive.enabled')).toBe(false);
  });

  it('lets dotted feature flags override simple aliases', () => {
    expect(isTenantFeatureEnabled(tenant({ attendance: false, 'attendance.enabled': true }), 'attendance.enabled')).toBe(true);
    expect(isTenantFeatureEnabled(tenant({ attendance: true, 'attendance.enabled': false }), 'attendance.enabled')).toBe(false);
  });
});
