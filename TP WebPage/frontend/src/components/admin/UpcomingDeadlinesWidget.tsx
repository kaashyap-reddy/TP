import { Assignment } from '../../store/assignmentsStore';
import { Session } from '../../store/sessionsStore';
import { Batch } from '../../store/batchesStore';
import EmptyState from '../EmptyState';
import StatusBadge from '../StatusBadge';
import { formatDateTime } from '../../utils/dateUtils';

interface DeadlineItem {
  kind: 'Assignment' | 'Session';
  title: string;
  batchName: string;
  when: string;
  sortKey: number;
  daysUntil: number;
}

interface UpcomingDeadlinesWidgetProps {
  assignments: Assignment[];
  sessions: Session[];
  batches: Batch[];
  onViewAssignments: () => void;
  onItemClick?: (item: DeadlineItem) => void;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number): string {
  if (days < 0) return 'text-red-600';
  if (days <= 2) return 'text-red-600';
  if (days <= 7) return 'text-amber-600';
  return 'text-gray-600';
}

export default function UpcomingDeadlinesWidget({ assignments, sessions, batches, onViewAssignments, onItemClick }: UpcomingDeadlinesWidgetProps) {
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? id;

  const items: DeadlineItem[] = [
    ...assignments
      .filter((a) => a.status === 'Open')
      .map((a) => ({
        kind: 'Assignment' as const,
        title: a.title,
        batchName: batchName(a.batchId),
        when: formatDateTime(a.deadline),
        sortKey: new Date(a.deadline).getTime() || Infinity,
        daysUntil: daysUntil(a.deadline)
      })),
    ...sessions
      .filter((s) => s.status === 'Upcoming')
      .map((s) => ({
        kind: 'Session' as const,
        title: s.title,
        batchName: batchName(s.batchId),
        when: s.date,
        sortKey: new Date(s.date).getTime() || Infinity,
        daysUntil: daysUntil(s.date)
      }))
  ]
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 6);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Upcoming Deadlines</h3>
        <button onClick={onViewAssignments} className="text-blue-600 text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">View All</button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nothing due soon" message="Open assignments and upcoming sessions will appear here." icon="calendar" />
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => onItemClick?.(item)}
              className="w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase flex-shrink-0 ${item.kind === 'Assignment' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {item.kind}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                <p className="text-xs text-gray-400">{item.batchName}</p>
              </div>
              {item.daysUntil < 0 ? (
                <StatusBadge status="Overdue" />
              ) : (
                <span className={`text-xs font-bold flex-shrink-0 ${urgencyClass(item.daysUntil)}`}>{item.when}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
