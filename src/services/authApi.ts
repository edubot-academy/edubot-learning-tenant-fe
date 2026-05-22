import type { AuthUser } from '../types/domain';
import { api, dedupeRead, tokenStore } from './http';

type LoginResponse = {
  token?: string;
  access_token?: string;
  user?: AuthUser;
};

function storeAuthToken(data: LoginResponse) {
  const token = data.token || data.access_token;
  if (token) tokenStore.set(token);
  return token;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  const token = storeAuthToken(data);
  if (!token) throw new Error('Login response did not include a token');
  return data.user ?? getCurrentUser();
}

export async function completeAccountSetup(payload: { token: string; newPassword: string }) {
  const { data } = await api.post<LoginResponse>('/auth/setup-account', payload);
  const token = storeAuthToken(data);
  if (!token) throw new Error('Account setup response did not include a token');
  return data.user ?? getCurrentUser();
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function requestPasswordReset(payload: { identifier: string; method: 'email' | 'whatsapp' | 'telegram' }) {
  const { data } = await api.post<{ message?: string; messageKey?: string; labelKey?: string }>('/auth/forgot-password', payload);
  return data;
}

export async function resetPassword(payload: {
  identifier: string;
  method: 'email' | 'whatsapp' | 'telegram';
  otp: string;
  newPassword: string;
}) {
  const { data } = await api.post<{ message?: string; messageKey?: string; labelKey?: string }>('/auth/reset-password', payload);
  return data;
}

export async function getCurrentUser() {
  return dedupeRead('auth:profile', async () => {
    const { data } = await api.get<AuthUser>('/auth/profile');
    return data;
  });
}
