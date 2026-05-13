import { getCurrentLocale } from '../i18n/locale';
import i18n from '../i18n/config';

export function formatDate(value?: string | null) {
  if (!value) return i18n.t('states.notSet');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t('states.notSet');
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function readable(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return i18n.t('states.notSet');
  return String(value).replaceAll('_', ' ');
}
