import { useState } from 'react';
import { AuditLogEntry } from '../store/auditLogStore';

export function useNotifications(auditEntries: AuditLogEntry[]) {
  const [readLogIds, setReadLogIds] = useState<Set<string>>(new Set());

  const notificationEntries = auditEntries.slice(0, 8);
  const unreadCount = auditEntries.filter((n) => !readLogIds.has(n.id)).length;

  function markNotificationRead(id: string) {
    setReadLogIds((prev) => new Set(prev).add(id));
  }

  function markAllNotificationsRead() {
    setReadLogIds((prev) => {
      const next = new Set(prev);
      auditEntries.forEach((n) => next.add(n.id));
      return next;
    });
  }

  return { readLogIds, notificationEntries, unreadCount, markNotificationRead, markAllNotificationsRead };
}
