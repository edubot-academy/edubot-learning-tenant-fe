import i18n from '../i18n/config';

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
};

type ApiErrorLike = {
  response?: {
    data?: ApiErrorPayload;
  };
};

function getPayload(error: unknown): ApiErrorPayload | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  return (error as ApiErrorLike).response?.data ?? null;
}

export function getBackendErrorCode(error: unknown): string | null {
  const code = getPayload(error)?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

function getBackendErrorMessage(error: unknown): string | null {
  const message = getPayload(error)?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const code = getBackendErrorCode(error);
  if (code) {
    const translationKey = `backendErrors.${code}`;
    if (i18n.exists(translationKey)) return i18n.t(translationKey);
  }

  return getBackendErrorMessage(error) ?? (error instanceof Error ? error.message : fallback);
}
