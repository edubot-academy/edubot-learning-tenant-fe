export function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function readable(value?: string | number | boolean | null) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value).replaceAll('_', ' ');
}
