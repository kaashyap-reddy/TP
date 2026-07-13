import type { AuditLogEntry } from '../../types/auditLog';
import { api } from './apiClient';

interface ApiNotification {
  id: string;
  occurredAt: string;
  eventType: string;
  message: string;
  actorId: string | null;
  module: string;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  isRead: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  unreadCount: number;
}

function toEntry(n: ApiNotification): AuditLogEntry {
  const occurred = new Date(n.occurredAt);
  return {
    id: n.id,
    date: occurred.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: occurred.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    type: n.eventType,
    message: n.message,
    user: n.actorId ?? '',
    module: n.module,
    previousValue: n.previousValue ?? '',
    newValue: n.newValue ?? '',
    ipAddress: n.ipAddress ?? ''
  };
}

/** Notifications are derived server-side from the platform's AuditLog, with per-user read state. */
export async function listNotifications(params?: { unreadOnly?: boolean; page?: number; pageSize?: number }): Promise<{
  entries: AuditLogEntry[];
  readIds: Set<string>;
  unreadCount: number;
}> {
  const res = await api.get<PaginatedResponse<ApiNotification>>('/notifications', { ...params, pageSize: params?.pageSize ?? 50 });
  return {
    entries: res.data.map(toEntry),
    readIds: new Set(res.data.filter((n) => n.isRead).map((n) => n.id)),
    unreadCount: res.unreadCount
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
