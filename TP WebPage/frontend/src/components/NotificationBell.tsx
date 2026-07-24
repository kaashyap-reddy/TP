import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../services/api/notificationService';
import { useToastStore } from '../store/toastStore';
import Button from './Button';
import NotificationPanel from './NotificationPanel';

const BELL_ICON =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

// Single shared bell/dropdown for all three dashboards -- replaces three previously independent
// (and behaviorally divergent) implementations: Admin used to reimplement local-only
// read-tracking directly against the full unfiltered audit log with no backend interaction at
// all, while Facilitator/Trainee called the real (now properly authorized) API.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);
  const { entries, unreadCount, isLoading, error, hasMore, isLoadingMore, loadMore, refreshNotifications, markNotificationRead, markAllNotificationsRead } =
    useNotifications();

  useClickOutside(menuRef, () => setOpen(false), open);
  useEscapeKey(() => setOpen(false), open);

  function handleSelect(notification: AppNotification) {
    setOpen(false);
    if (!notification.targetUrl) {
      showToast('This notification has no linked page.', 'info');
      return;
    }
    // An unmatched/stale path still resolves safely to the app's existing 404 page rather than
    // breaking navigation -- there's nothing further to guard here.
    navigate(notification.targetUrl);
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BELL_ICON} />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications'}
      </span>
      {open && (
        <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <NotificationPanel
            entries={entries}
            isLoading={isLoading}
            error={error}
            onRetry={refreshNotifications}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            onSelect={handleSelect}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        </div>
      )}
    </div>
  );
}
