import { useState } from 'react';
import { AuditLogEntry } from '../../store/auditLogStore';
import EmptyState from '../EmptyState';

const TYPE_STYLE: Record<string, { color: string; icon: string }> = {
  Assignment: { color: 'bg-blue-100 text-blue-700', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  Session: { color: 'bg-purple-100 text-purple-700', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  Announcement: { color: 'bg-green-100 text-green-700', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  Resource: { color: 'bg-amber-100 text-amber-700', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  Feedback: { color: 'bg-pink-100 text-pink-700', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  Batch: { color: 'bg-indigo-100 text-indigo-700', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  Report: { color: 'bg-gray-200 text-gray-700', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  Onboarding: { color: 'bg-teal-100 text-teal-700', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }
};
const DEFAULT_STYLE = { color: 'bg-gray-100 text-gray-600', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };

interface RecentActivityWidgetProps {
  entries: AuditLogEntry[];
  onViewAll: () => void;
  onItemClick?: (entry: AuditLogEntry) => void;
}

export default function RecentActivityWidget({ entries, onViewAll, onItemClick }: RecentActivityWidgetProps) {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const categories = Array.from(new Set(entries.map((e) => e.type)));
  const filtered = categoryFilter === 'All' ? entries : entries.filter((e) => e.type === categoryFilter);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Recent Activity</h3>
        <button onClick={onViewAll} className="text-blue-600 text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">View All</button>
      </div>
      {categories.length > 1 && (
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter('All')}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${categoryFilter === 'All' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${categoryFilter === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState title="No activity yet" message="Actions across the portal will show up here." icon="inbox" />
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {filtered.map((e) => {
            const style = TYPE_STYLE[e.type] ?? DEFAULT_STYLE;
            return (
              <button
                key={e.id}
                onClick={() => onItemClick?.(e)}
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.color}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon} /></svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{e.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{e.user} • {e.time}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
