import type { StudentAccessState, StudentNotification } from '../types/domain';
import { api } from './http';

export async function getStudentAccess() {
  const { data } = await api.get<StudentAccessState>('/student/access');
  return data;
}

export async function listStudentNotifications(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<StudentNotification[] | { items?: StudentNotification[] }>('/student/notifications', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function getStudentNotificationUnreadCount() {
  const { data } = await api.get('/student/notifications/unread-count');
  return data;
}

export async function markStudentNotificationRead(notificationId: number) {
  const { data } = await api.post(`/student/notifications/${notificationId}/read`);
  return data;
}
