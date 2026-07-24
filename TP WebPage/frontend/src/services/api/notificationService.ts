import { api } from './apiClient';

export type NotificationSeverity = 'Info' | 'Warning' | 'Critical';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  targetUrl: string | null;
  severity: NotificationSeverity;
  createdAt: string;
  readAt: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  unreadCount: number;
}

/** Every notification returned here already belongs solely to the caller -- the backend scopes
 * by recipientId on every query (see backend/src/services/notifications.service.ts); there is no
 * client-side filtering step because there's nothing to filter out. */
export async function listNotifications(params?: { unreadOnly?: boolean; page?: number; pageSize?: number }): Promise<{
  entries: AppNotification[];
  unreadCount: number;
  totalPages: number;
}> {
  const res = await api.get<PaginatedResponse<AppNotification>>('/notifications', { ...params, pageSize: params?.pageSize ?? 20 });
  return { entries: res.data, unreadCount: res.unreadCount, totalPages: res.pagination.totalPages };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
