import { useCallback, useRef, useState } from 'react';
import * as notificationService from '../services/api/notificationService';
import type { AppNotification } from '../services/api/notificationService';
import { usePolling } from './usePolling';

/**
 * Notification-bell state, backed by the real per-recipient GET /api/notifications (see
 * backend/src/services/notifications.service.ts) -- every entry returned already belongs solely
 * to the current user, so no audit-log fallback or client-side filtering is needed here anymore.
 */
export function useNotifications() {
  const [entries, setEntries] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Guards against overlapping refreshes (a slow request still in flight when the next poll
  // tick or a manual "Retry" click fires) racing each other and applying stale results last.
  const requestIdRef = useRef(0);

  const refreshNotifications = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setError(null);
    return notificationService
      .listNotifications({ page: 1 })
      .then(({ entries, unreadCount, totalPages }) => {
        if (requestId !== requestIdRef.current) return;
        setEntries(entries);
        setUnreadCount(unreadCount);
        setPage(1);
        setTotalPages(totalPages);
        setIsLoading(false);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setIsLoading(false);
        setError(err instanceof Error ? err.message : 'Unable to load notifications.');
      });
  }, []);

  usePolling(refreshNotifications, 30_000);

  function loadMore() {
    if (isLoadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    notificationService
      .listNotifications({ page: nextPage })
      .then(({ entries: more, totalPages }) => {
        setEntries((prev) => [...prev, ...more]);
        setPage(nextPage);
        setTotalPages(totalPages);
      })
      .catch(() => undefined)
      .finally(() => setIsLoadingMore(false));
  }

  function markNotificationRead(id: string) {
    setEntries((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    void notificationService.markNotificationRead(id).catch(() => undefined);
  }

  function markAllNotificationsRead() {
    setEntries((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    void notificationService.markAllNotificationsRead().catch(() => undefined);
  }

  return {
    entries,
    unreadCount,
    isLoading,
    error,
    hasMore: page < totalPages,
    isLoadingMore,
    loadMore,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead
  };
}
