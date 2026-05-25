import { describe, expect, it } from 'vitest';
import i18n from '../i18n/config';
import { activityActionLabelKeys, activityTargetLabelKeys, enumLabel, humanizeEnumValue } from './enumLabels';

describe('enum labels', () => {
  it('localizes backend activity action keys instead of exposing raw keys', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.t.bind(i18n);

    expect(enumLabel('tenant.crm_link_updated', activityActionLabelKeys, t)).toBe('CRM link updated');
    expect(enumLabel('member.role_set', activityActionLabelKeys, t)).toBe('Member role updated');
    expect(enumLabel('member.invited', activityActionLabelKeys, t)).toBe('Member invited');
  });

  it('uses singular target labels for audit targets', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.t.bind(i18n);

    expect(enumLabel('members', activityTargetLabelKeys, t)).toBe('Member');
    expect(enumLabel('tenant', activityTargetLabelKeys, t)).toBe('Workspace');
  });

  it('humanizes unmapped backend enum values before showing the fallback', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.t.bind(i18n);

    expect(humanizeEnumValue('tenant.crm_link_removed')).toBe('Tenant CRM Link Removed');
    expect(enumLabel('future.backend_key', {}, t)).toBe('Unknown: Future Backend Key');
  });
});
