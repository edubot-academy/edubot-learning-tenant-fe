import { useEffect, useRef, useState } from 'react';
import { FiGlobe } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/locale';
import { useLocale } from '../i18n/LocaleProvider';

const languageMenuLabels: Record<SupportedLocale, string> = {
  ky: 'KG',
  ru: 'RU',
  en: 'US',
};

type LanguageMenuProps = {
  className?: string;
};

export function LanguageMenu({ className = '' }: LanguageMenuProps) {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const chooseLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    setOpen(false);
  };

  return (
    <div className={`language-compact ${className}`.trim()} ref={menuRef}>
      <button
        type="button"
        className={open ? 'active' : ''}
        aria-label={t('language.label')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="language-menu"
        title={t('language.label')}
        onClick={() => setOpen((current) => !current)}
      >
        <FiGlobe aria-hidden="true" />
      </button>
      {open ? (
        <div className="language-menu" id="language-menu" role="menu" aria-label={t('language.label')}>
          {SUPPORTED_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={locale === code}
              className={locale === code ? 'active' : ''}
              onClick={() => chooseLocale(code)}
            >
              {languageMenuLabels[code]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
