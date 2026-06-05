import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import enEngagement from './locales/en/engagement.json';
import kyCommon from './locales/ky/common.json';
import kyEngagement from './locales/ky/engagement.json';
import ruCommon from './locales/ru/common.json';
import ruEngagement from './locales/ru/engagement.json';
import { DEFAULT_LOCALE, resolveLocale } from './locale';

type LocaleMessages = Record<string, unknown>;

function mergeMessages<T extends LocaleMessages>(base: T, overlay: LocaleMessages): T {
  const result: LocaleMessages = { ...base };

  Object.entries(overlay).forEach(([key, value]) => {
    const currentValue = result[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      currentValue &&
      typeof currentValue === 'object' &&
      !Array.isArray(currentValue)
    ) {
      result[key] = mergeMessages(currentValue as LocaleMessages, value as LocaleMessages);
      return;
    }

    result[key] = value;
  });

  return result as T;
}

const kyMessages = mergeMessages(kyCommon, kyEngagement);
const ruMessages = mergeMessages(ruCommon, ruEngagement);
const enMessages = mergeMessages(enCommon, enEngagement);

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ky: { common: kyMessages },
      ru: { common: ruMessages },
      en: { common: enMessages },
    },
    lng: resolveLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: ['ky', 'ru', 'en'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
  });

export default i18n;
