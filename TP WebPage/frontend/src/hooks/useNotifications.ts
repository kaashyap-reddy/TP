import { useEffect, useState } from 'react';
import { AuditLogEntry } from '../store/auditLogStore';
import * as notificationService from '../services/api/notificationService';

/**
 * Notification-bell state. Backed by the real GET /api/notifications (audit-log-derived,
 * per-user read state) whenever it returns data; falls back to the caller's client-side
 * audit entries when it doesn't — Demo Mode's interceptor returns an empty list, and a
 * dev server without a database errors, so both keep today's client-derived behavior.
 */
export function useNotifications(auditEntries: AuditLogEntry[]) {
  const [apiEntries, setApiEntries] = useState<AuditLogEntry[] | null>(null);
  const [readLogIds, setReadLogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    notificationService
      .listNotifications()
      .then(({ entries, readIds }) => {
        if (cancelled || entries.length === 0) return;
        setApiEntries(entries);
        setReadLogIds(readIds);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const source = apiEntries ?? auditEntries;
  const notificationEntries = source.slice(0, 8);
  const unreadCount = source.filter((n) => !readLogIds.has(n.id)).length;

  function markNotificationRead(id: string) {
    setReadLogIds((prev) => new Set(prev).add(id));
    if (apiEntries) void notificationService.markNotificationRead(id).catch(() => undefined);
  }

  function markAllNotificationsRead() {
    setReadLogIds((prev) => {
      const next = new Set(prev);
      source.forEach((n) => next.add(n.id));
      return next;
    });
    if (apiEntries) void notificationService.markAllNotificationsRead().catch(() => undefined);
  }

  return { readLogIds, notificationEntries, unreadCount, markNotificationRead, markAllNotificationsRead };
}
