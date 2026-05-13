export const SUPPORTED_LOCALES = ['ky', 'ru', 'en'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'ky';
export const LOCALE_STORAGE_KEY = 'edubot_locale';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ky: 'Кыргызча',
  ru: 'Русский',
  en: 'English',
};

let currentLocale: SupportedLocale | null = null;

function parseLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace('_', '-');
  const language = normalized.split('-')[0];
  return SUPPORTED_LOCALES.includes(language as SupportedLocale) ? language as SupportedLocale : null;
}

export function normalizeLocale(value: unknown): SupportedLocale {
  return parseLocale(value) ?? DEFAULT_LOCALE;
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export const localeStore = {
  get: () => {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  },
  set: (locale: SupportedLocale) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  },
  clear: () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  },
};

export function getBrowserLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  const candidates = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  for (const candidate of candidates) {
    const normalized = parseLocale(candidate);
    if (candidate && normalized) return normalized;
  }
  return null;
}

export function resolveLocale(tenantLocale?: string | null): SupportedLocale {
  return localeStore.get() ?? parseLocale(tenantLocale) ?? getBrowserLocale() ?? DEFAULT_LOCALE;
}

export function setCurrentLocale(locale: SupportedLocale) {
  currentLocale = locale;
}

export function clearCurrentLocale() {
  currentLocale = null;
}

export function getCurrentLocale(tenantLocale?: string | null): SupportedLocale {
  return currentLocale ?? resolveLocale(tenantLocale);
}
