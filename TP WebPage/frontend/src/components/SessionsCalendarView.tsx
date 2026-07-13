import { useEffect, useState } from 'react';
import { CalendarEvent, CalendarEventType, listCalendarEvents } from '../services/api/calendarService';
import EmptyState from './EmptyState';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { formatDateTime } from '../utils/dateUtils';

interface SessionsCalendarViewProps {
  /** Narrows events to a single batch — omit to show everything the caller is authorized to see. */
  batchId?: string;
}

type FilterValue = 'all' | CalendarEventType;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'session', label: 'Sessions' },
  { value: 'assignment-deadline', label: 'Assignment Deadlines' }
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_STYLES: Record<CalendarEventType, { pill: string; dot: string; label: string; icon: string }> = {
  session: { pill: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: 'Session', icon: '🎥' },
  'assignment-deadline': { pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', label: 'Assignment Deadline', icon: '📌' }
};

function sameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

export default function SessionsCalendarView({ batchId }: SessionsCalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listCalendarEvents({ batchId, type: filter })
      .then((res) => {
        if (!cancelled) setEvents(res);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, filter]);

  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  ];

  function eventsOn(day: Date) {
    return events.filter((e) => sameDay(e.start, day));
  }

  const selectedEvents = selectedDay ? eventsOn(selectedDay) : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewedMonth(new Date(year, month - 1, 1))} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">‹</button>
          <h3 className="font-bold text-gray-800 min-w-[10rem] text-center">{viewedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => setViewedMonth(new Date(year, month + 1, 1))} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">›</button>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                filter === f.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-20" />;
          const dayEvents = eventsOn(day);
          const isSelected = selectedDay && sameDay(day.toISOString(), selectedDay);
          const isToday = sameDay(new Date().toISOString(), day);
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={`h-20 border rounded-lg p-1.5 text-left flex flex-col hover:border-blue-300 hover:bg-blue-50/40 transition-colors ${
                isSelected ? 'border-blue-500 bg-blue-50' : isToday ? 'border-blue-200' : 'border-gray-100'
              }`}
            >
              <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>{day.getDate()}</span>
              <div className="flex-1 overflow-hidden space-y-0.5 mt-1">
                {dayEvents.slice(0, 2).map((e) => (
                  <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${EVENT_STYLES[e.type].pill}`}>
                    {EVENT_STYLES[e.type].icon} {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <div className="text-[10px] text-gray-400">+{dayEvents.length - 2} more</div>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <h4 className="font-bold text-sm text-gray-700 mb-3">
          {selectedDay ? selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a day'}
        </h4>
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !selectedDay ? (
          <p className="text-sm text-gray-400">Click a date to see its sessions and deadlines.</p>
        ) : selectedEvents.length === 0 ? (
          <EmptyState title="Nothing scheduled this day" icon="calendar" />
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => setDetailEvent(e)}
                className="w-full flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_STYLES[e.type].dot}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{e.title}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {EVENT_STYLES[e.type].label} • {e.batchNames.join(', ') || 'All batches'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={e.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={detailEvent !== null} onClose={() => setDetailEvent(null)} title={detailEvent?.title} maxWidth="sm">
        {detailEvent && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${EVENT_STYLES[detailEvent.type].pill}`}>
                {EVENT_STYLES[detailEvent.type].icon} {EVENT_STYLES[detailEvent.type].label}
              </span>
              <StatusBadge status={detailEvent.status} />
            </div>
            <div>
              <span className="text-gray-500">Batch{detailEvent.batchNames.length > 1 ? 'es' : ''}:</span>{' '}
              <span className="font-medium text-gray-800">{detailEvent.batchNames.join(', ') || 'All batches'}</span>
            </div>
            <div>
              <span className="text-gray-500">{detailEvent.type === 'assignment-deadline' ? 'Deadline:' : 'Date & time:'}</span>{' '}
              <span className="font-medium text-gray-800">
                {formatDateTime(detailEvent.start)}
              </span>
            </div>
            {detailEvent.metadata.facilitatorName && (
              <div>
                <span className="text-gray-500">Facilitator:</span>{' '}
                <span className="font-medium text-gray-800">{detailEvent.metadata.facilitatorName}</span>
              </div>
            )}
            {detailEvent.type === 'session' && detailEvent.metadata.platform && (
              <div>
                <span className="text-gray-500">Platform:</span> <span className="font-medium text-gray-800">{detailEvent.metadata.platform}</span>
              </div>
            )}
            {detailEvent.type === 'session' && detailEvent.metadata.meetingLink && (
              <a
                href={detailEvent.metadata.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                Join Meeting
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
