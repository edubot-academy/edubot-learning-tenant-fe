/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from './config';
import { LOCALE_LABELS, localeStore, resolveLocale, setCurrentLocale, type SupportedLocale } from './locale';
import { useTenant } from '../features/tenant/TenantProvider';

type LocaleContextValue = {
  locale: SupportedLocale;
  localeLabels: typeof LOCALE_LABELS;
  setLocale: (locale: SupportedLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { activeTenant, resolvedTenant } = useTenant();
  const tenantLocale = activeTenant?.locale ?? resolvedTenant?.locale;
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveLocale(tenantLocale));

  useEffect(() => {
    const nextLocale = resolveLocale(tenantLocale);
    setLocaleState(nextLocale);
  }, [tenantLocale]);

  useEffect(() => {
    setCurrentLocale(locale);
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    localeLabels: LOCALE_LABELS,
    setLocale: (nextLocale) => {
      localeStore.set(nextLocale);
      setLocaleState(nextLocale);
    },
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}
