import { describe, expect, it } from 'vitest';
import { isNeutralTenantHostname, resolveTenantLookupHostname } from './TenantProvider';

describe('tenant hostname resolution', () => {
  it('keeps platform, staging, and API hosts tenant-neutral', () => {
    [
      '',
      'localhost',
      '127.0.0.1',
      '::1',
      'lms.edubot.it.com',
      'staging.lms.edubot.it.com',
      'api.lms.edubot.it.com',
      'staging-api.lms.edubot.it.com',
      'edubot-learning-tenant-fe.vercel.app',
    ].forEach((hostname) => {
      expect(isNeutralTenantHostname(hostname)).toBe(true);
      expect(resolveTenantLookupHostname(hostname)).toBeNull();
    });
  });

  it('normalizes tenant lookup hosts', () => {
    expect(isNeutralTenantHostname('acme.lms.edubot.it.com')).toBe(false);
    expect(resolveTenantLookupHostname('Acme.lms.edubot.it.com.')).toBe('acme.lms.edubot.it.com');
  });
});
