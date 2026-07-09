import { useState } from 'react';
import { AuditLogEntry } from '../store/auditLogStore';
import EmptyState from './EmptyState';

export type NotificationCategory = 'Assignment' | 'Session' | 'Announcement' | 'Resource' | 'Feedback' | 'Batch' | 'Other';

const CATEGORIES: NotificationCategory[] = ['Assignment', 'Session', 'Announcement', 'Resource', 'Feedback', 'Batch', 'Other'];

export function categorize(type: string): NotificationCategory {
  if (['Assignment', 'Submission'].includes(type)) return 'Assignment';
  if (type === 'Session') return 'Session';
  if (type === 'Announcement') return 'Announcement';
  if (type === 'Resource') return 'Resource';
  if (type === 'Feedback') return 'Feedback';
  if (['Batch', 'Onboarding'].includes(type)) return 'Batch';
  return 'Other';
}

interface NotificationPanelProps {
  entries: AuditLogEntry[];
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
  viewAllLabel?: string;
}

export default function NotificationPanel({ entries, readIds, onMarkRead, onMarkAllRead, onViewAll, viewAllLabel = 'View all in Audit Logs' }: NotificationPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<NotificationCategory | 'All'>('All');

  const filtered = entries.filter((e) => {
    const matchesSearch = search.trim() === '' || e.message.toLowerCase().includes(search.trim().toLowerCase()) || e.type.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = category === 'All' || categorize(e.type) === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-96">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 className="font-bold text-gray-800">Notifications</h3>
        <button onClick={onMarkAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">Mark all read</button>
      </div>
      <div className="p-3 border-b border-gray-100 space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications..."
          aria-label="Search notifications"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory('All')}
            className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${category === 'All' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${category === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {filtered.length === 0 && <EmptyState title="No notifications" icon="inbox" />}
        {filtered.map((n) => {
          const read = readIds.has(n.id);
          return (
            <div
              key={n.id}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${read ? 'opacity-60' : ''}`}
              onClick={() => onMarkRead(n.id)}
            >
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${read ? 'bg-transparent' : 'bg-blue-500'}`}></span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${read ? 'text-gray-600' : 'text-gray-800'}`}>{n.type}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
        <button onClick={onViewAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">{viewAllLabel}</button>
      </div>
    </div>
  );
}
