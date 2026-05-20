import i18n from '../i18n/config';

type ApiErrorPayload = {
  code?: unknown;
  errorCode?: unknown;
  error?: {
    code?: unknown;
    messageKey?: unknown;
    labelKey?: unknown;
  };
  messageKey?: unknown;
  labelKey?: unknown;
  message?: unknown;
};

type ApiErrorLike = {
  response?: {
    data?: ApiErrorPayload;
  };
};

function getPayload(error: unknown): ApiErrorPayload | null {
  if (!error || typeof error !== 'object') return null;
  if ('response' in error) return (error as ApiErrorLike).response?.data ?? null;
  return error as ApiErrorPayload;
}

function stableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const ERROR_CATEGORY_PREFIXES: Array<[string, string]> = [
  ['AUTH_', 'auth'],
  ['TENANT_', 'tenant'],
  ['COMPANY_', 'company'],
  ['USER_', 'user'],
  ['STUDENT_PORTAL_', 'student'],
  ['STUDENT_', 'student'],
  ['COURSE_GROUP_', 'group'],
  ['GROUP_SESSION_', 'session'],
  ['COURSE_', 'course'],
  ['HOMEWORK_', 'homework'],
  ['ATTENDANCE_', 'attendance'],
  ['CERTIFICATE_', 'certificate'],
  ['ENROLLMENT_', 'enrollment'],
  ['AI_', 'ai'],
  ['VIDEO_', 'media'],
  ['IMAGE_', 'media'],
  ['NOTIFICATION_', 'notification'],
  ['LANGUAGE_', 'language'],
];

export function getBackendErrorCode(error: unknown): string | null {
  const payload = getPayload(error);
  return stableString(payload?.error?.code) ?? stableString(payload?.code) ?? stableString(payload?.errorCode);
}

function getBackendTranslationKey(error: unknown): string | null {
  const payload = getPayload(error);
  return (
    stableString(payload?.error?.messageKey) ??
    stableString(payload?.error?.labelKey) ??
    stableString(payload?.messageKey) ??
    stableString(payload?.labelKey)
  );
}

function translationKeyCandidates(key: string) {
  const candidates = [key, `apiMessages.${key}`];
  if (key.startsWith('errors.')) {
    candidates.push(`backendErrors.${key.slice('errors.'.length)}`);
  } else if (key.startsWith('backendErrors.')) {
    candidates.push(`errors.${key.slice('backendErrors.'.length)}`);
  }
  return candidates;
}

function translateIfExists(key: string) {
  for (const candidate of translationKeyCandidates(key)) {
    if (i18n.exists(candidate)) return i18n.t(candidate);
  }
  return null;
}

export function getApiResponseMessage(response: unknown, fallback: string) {
  const translationKey = getBackendTranslationKey(response);
  if (translationKey) {
    const translated = translateIfExists(translationKey);
    if (translated) return translated;
  }
  return fallback;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const translationKey = getBackendTranslationKey(error);
  if (translationKey) {
    const translated = translateIfExists(translationKey);
    if (translated) return translated;
  }

  const code = getBackendErrorCode(error);
  if (code) {
    const translated = translateIfExists(`backendErrors.${code}`);
    if (translated) return translated;

    const category = ERROR_CATEGORY_PREFIXES.find(([prefix]) => code.startsWith(prefix))?.[1];
    if (category) {
      const categoryMessage = translateIfExists(`backendErrors.categories.${category}`);
      if (categoryMessage) return categoryMessage;
    }
  }

  return fallback;
}
