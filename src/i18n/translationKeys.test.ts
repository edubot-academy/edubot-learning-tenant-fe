import { describe, expect, it } from 'vitest';
import enCommon from './locales/en/common.json';
import kyCommon from './locales/ky/common.json';
import ruCommon from './locales/ru/common.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe('translation resources', () => {
  it('keeps Kyrgyz, Russian, and English locale keys in sync', () => {
    const kyKeys = flattenKeys(kyCommon).sort();
    const ruKeys = flattenKeys(ruCommon).sort();
    const enKeys = flattenKeys(enCommon).sort();

    expect(ruKeys).toEqual(kyKeys);
    expect(enKeys).toEqual(kyKeys);
  });
});
