import { useState } from 'react';
import { Session } from '../../store/sessionsStore';
import { Batch } from '../../store/batchesStore';
import StatusBadge from '../StatusBadge';
import EmptyState from '../EmptyState';

interface SessionsCalendarViewProps {
  sessions: Session[];
  batches: Batch[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sameDay(dateStr: string, day: Date): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

export default function SessionsCalendarView({ sessions, batches }: SessionsCalendarViewProps) {
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  ];

  function sessionsOn(day: Date) {
    return sessions.filter((s) => sameDay(s.date, day));
  }

  const selectedSessions = selectedDay ? sessionsOn(selectedDay) : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewedMonth(new Date(year, month - 1, 1))} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">‹</button>
        <h3 className="font-bold text-gray-800">{viewedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => setViewedMonth(new Date(year, month + 1, 1))} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
        {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-20" />;
          const daySessions = sessionsOn(day);
          const isSelected = selectedDay && sameDay(day.toISOString(), selectedDay);
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={`h-20 border rounded-lg p-1.5 text-left flex flex-col hover:border-blue-300 hover:bg-blue-50/40 transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
            >
              <span className="text-xs font-bold text-gray-600">{day.getDate()}</span>
              <div className="flex-1 overflow-hidden space-y-0.5 mt-1">
                {daySessions.slice(0, 2).map((s) => (
                  <div key={s.id} className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 truncate">{s.title}</div>
                ))}
                {daySessions.length > 2 && <div className="text-[10px] text-gray-400">+{daySessions.length - 2} more</div>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <h4 className="font-bold text-sm text-gray-700 mb-3">
          {selectedDay ? selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a day'}
        </h4>
        {!selectedDay ? (
          <p className="text-sm text-gray-400">Click a date to see its sessions.</p>
        ) : selectedSessions.length === 0 ? (
          <EmptyState title="No sessions this day" icon="calendar" />
        ) : (
          <div className="space-y-2">
            {selectedSessions.map((s) => {
              const batch = batches.find((b) => b.id === s.batchId);
              return (
                <div key={s.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{s.title} — {batch?.name ?? s.batchId}</div>
                    <div className="text-xs text-gray-500">{s.time} • {s.facilitator}</div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
