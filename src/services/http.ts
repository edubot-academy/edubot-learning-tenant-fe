import axios from 'axios';
import { getCurrentLocale } from '../i18n/locale';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipTenantHeader?: boolean;
    __csrfRetry?: boolean;
  }
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'edubot_tenant_token';
const TENANT_KEY = 'edubot_active_tenant_id';

export type StudentPagedResponse<T> = {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export function toStudentPage<T>(data: T[] | StudentPagedResponse<T>): StudentPagedResponse<T> {
  return Array.isArray(data)
    ? { items: data, total: data.length, page: 1, limit: data.length, totalPages: 1 }
    : { ...data, items: data.items ?? [], totalPages: data.totalPages ?? (data.total && data.limit ? Math.ceil(data.total / data.limit) : undefined) };
}

const pendingReadRequests = new Map<string, Promise<unknown>>();

export function dedupeRead<T>(key: string, request: () => Promise<T>): Promise<T> {
  const pending = pendingReadRequests.get(key);
  if (pending) return pending as Promise<T>;

  const nextRequest = request().finally(() => {
    pendingReadRequests.delete(key);
  });
  pendingReadRequests.set(key, nextRequest);
  return nextRequest;
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY),
  set: (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },
};

export const tenantStore = {
  get: () => {
    const value = localStorage.getItem(TENANT_KEY);
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  },
  set: (tenantId: number) => localStorage.setItem(TENANT_KEY, String(tenantId)),
  clear: () => localStorage.removeItem(TENANT_KEY),
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const AUTH_EXPIRED_EVENT = 'edubot_tenant_auth_expired';
const CSRF_ERROR_TEXT = 'CSRF token missing or invalid';
const CSRF_ERROR_CODE = 'CSRF_TOKEN_INVALID';

function getCookieValue(name: string) {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function getBackendErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const data = (error as { response?: { data?: { code?: unknown; errorCode?: unknown; error?: { code?: unknown } } } }).response?.data;
  const code = data?.error?.code ?? data?.code ?? data?.errorCode;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = tenantStore.get();
  if (config.skipTenantHeader) {
    delete config.headers['X-Company-Id'];
  } else if (tenantId) {
    config.headers['X-Company-Id'] = String(tenantId);
  }
  const method = String(config.method || 'get').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].indexOf(method) === -1) {
    const csrfToken = getCookieValue('edubot_csrf_token');
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  }
  config.headers['Accept-Language'] = getCurrentLocale();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error?.response?.data?.message;
    const code = getBackendErrorCode(error);
    const isCsrfError =
      error?.response?.status === 403 &&
      (code === CSRF_ERROR_CODE ||
        (Array.isArray(message)
          ? message.indexOf(CSRF_ERROR_TEXT) !== -1
          : String(message || '').indexOf(CSRF_ERROR_TEXT) !== -1));

    if (isCsrfError && error.config && !error.config.__csrfRetry) {
      error.config.__csrfRetry = true;
      try {
        await api.get('/auth/profile', { skipTenantHeader: true, __csrfRetry: true });
        return api(error.config);
      } catch {
        return Promise.reject(error);
      }
    }

    if (error?.response?.status === 401) {
      tokenStore.clear();
      tenantStore.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
