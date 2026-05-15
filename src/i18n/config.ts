import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import kyCommon from './locales/ky/common.json';
import ruCommon from './locales/ru/common.json';
import { DEFAULT_LOCALE, resolveLocale } from './locale';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ky: { common: kyCommon },
      ru: { common: ruCommon },
      en: { common: enCommon },
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
