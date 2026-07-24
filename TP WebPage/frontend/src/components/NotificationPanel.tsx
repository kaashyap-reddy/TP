import { useMemo, useState } from 'react';
import type { AppNotification } from '../services/api/notificationService';
import { formatDateTime, formatRelativeTime } from '../utils/dateUtils';
import Button from './Button';
import EmptyState from './EmptyState';
import { SkeletonRows } from './Skeleton';

interface NotificationPanelProps {
  entries: AppNotification[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelect: (notification: AppNotification) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

type Tab = 'unread' | 'all';

const SEVERITY_DOT: Record<AppNotification['severity'], string> = {
  Info: 'bg-blue-500',
  Warning: 'bg-amber-500',
  Critical: 'bg-red-500'
};

// Text label alongside the dot so severity isn't communicated by color alone.
const SEVERITY_LABEL: Record<AppNotification['severity'], string | null> = {
  Info: null,
  Warning: 'Warning',
  Critical: 'Critical'
};

function groupLabel(createdAt: string): 'Today' | 'Earlier this week' | 'Older' {
  const created = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (created >= startOfToday) return 'Today';
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (created >= weekAgo) return 'Earlier this week';
  return 'Older';
}

const GROUP_ORDER = ['Today', 'Earlier this week', 'Older'] as const;

export default function NotificationPanel({
  entries,
  isLoading,
  error,
  onRetry,
  onMarkRead,
  onMarkAllRead,
  onSelect,
  hasMore,
  isLoadingMore,
  onLoadMore
}: NotificationPanelProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [type, setType] = useState<string | 'All'>('All');

  const types = useMemo(() => Array.from(new Set(entries.map((e) => e.type))).sort(), [entries]);

  const filtered = entries.filter((e) => {
    const matchesTab = tab === 'all' || !e.readAt;
    const matchesType = type === 'All' || e.type === type;
    return matchesTab && matchesType;
  });

  const grouped = GROUP_ORDER.map((label) => ({
    label,
    items: filtered.filter((e) => groupLabel(e.createdAt) === label)
  })).filter((g) => g.items.length > 0);

  const hasAnyEntries = entries.length > 0;
  const unreadTotal = entries.filter((e) => !e.readAt).length;

  return (
    <div className="w-96">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 className="font-bold text-gray-800">Notifications</h3>
        <Button
          variant="link"
          onClick={onMarkAllRead}
          disabled={unreadTotal === 0}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
        >
          Mark all read
        </Button>
      </div>

      <div className="px-3 pt-2 border-b border-gray-100 flex gap-4">
        {(['all', 'unread'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-xs font-bold border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'all' ? 'All' : `Unread${unreadTotal > 0 ? ` (${unreadTotal})` : ''}`}
          </button>
        ))}
      </div>

      {types.length > 1 && (
        <div className="p-3 border-b border-gray-100 flex flex-wrap gap-1.5">
          <button
            onClick={() => setType('All')}
            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${type === 'All' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
          >
            All types
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        {isLoading && <SkeletonRows rows={4} />}

        {!isLoading && error && (
          <div className="p-6 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && !hasAnyEntries && <EmptyState title="No notifications" message="You're all caught up." icon="inbox" />}

        {!isLoading && !error && hasAnyEntries && filtered.length === 0 && (
          <EmptyState title="No matching notifications" message="Try a different tab or type filter." icon="inbox" />
        )}

        {!isLoading &&
          !error &&
          grouped.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-1.5 bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-400">{group.label}</div>
              <div className="divide-y divide-gray-100">
                {group.items.map((n) => {
                  const read = !!n.readAt;
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        onMarkRead(n.id);
                        onSelect(n);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onMarkRead(n.id);
                          onSelect(n);
                        }
                      }}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${read ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${read ? 'bg-transparent' : SEVERITY_DOT[n.severity]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${read ? 'text-gray-600' : 'text-gray-800'}`}>{n.title}</p>
                            {SEVERITY_LABEL[n.severity] && (
                              <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                                {SEVERITY_LABEL[n.severity]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1" title={formatDateTime(n.createdAt)}>
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {!isLoading && !error && hasMore && (
          <div className="p-3 text-center border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={onLoadMore} loading={isLoadingMore} loadingLabel="Loading…">
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
