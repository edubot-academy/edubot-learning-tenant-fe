import { beforeEach, describe, expect, it } from 'vitest';
import { clearCurrentLocale, getCurrentLocale, localeStore, normalizeLocale, resolveLocale, setCurrentLocale } from './locale';

describe('locale resolution', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCurrentLocale();
  });

  it('normalizes supported regional language codes', () => {
    expect(normalizeLocale('ky-KG')).toBe('ky');
    expect(normalizeLocale('ru_RU')).toBe('ru');
    expect(normalizeLocale('en-US')).toBe('en');
  });

  it('uses Kyrgyz as the fallback for unsupported values', () => {
    expect(normalizeLocale('de')).toBe('ky');
  });

  it('prefers explicit user language over tenant language', () => {
    localeStore.set('en');

    expect(resolveLocale('ru')).toBe('en');
  });

  it('uses tenant language when no explicit user language exists', () => {
    expect(resolveLocale('ru')).toBe('ru');
  });

  it('uses the current runtime language before resolving fallbacks', () => {
    localStorage.setItem('edubot_locale', 'ru');
    setCurrentLocale('en');

    expect(getCurrentLocale('ky')).toBe('en');
  });
});
