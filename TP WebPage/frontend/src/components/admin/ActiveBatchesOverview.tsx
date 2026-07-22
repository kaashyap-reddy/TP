import { Batch } from '../../store/batchesStore';
import { Session } from '../../store/sessionsStore';
import ProgressBar from '../ProgressBar';
import StatusBadge from '../StatusBadge';

interface ActiveBatchesOverviewProps {
  batches: Batch[];
  sessions: Session[];
  onOpenBatch: (batchId: string) => void;
  onViewSchedule: (batchId: string) => void;
  onViewAll: () => void;
}

// A compact card overview -- deliberately not the full management table (that stays on the
// Batch Management tab). Shows just enough to answer "what's active and does it need me?"
export default function ActiveBatchesOverview({ batches, sessions, onOpenBatch, onViewSchedule, onViewAll }: ActiveBatchesOverviewProps) {
  const active = batches.filter((b) => b.status === 'Active').slice(0, 4);

  function nextSessionFor(batchId: string): Session | undefined {
    return sessions
      .filter((s) => s.batchId === batchId && s.status === 'Upcoming')
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Active Batches</h3>
        <button onClick={onViewAll} className="text-blue-600 text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">View All</button>
      </div>
      {active.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">No active batches right now.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
          {active.map((b) => {
            const next = nextSessionFor(b.id);
            return (
              <div key={b.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 hover:shadow-sm transition-all duration-150">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">{b.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{b.poc || 'No coordinator'} • {b.traineeCount} trainees</div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase font-bold mb-1">
                    <span>Completion</span>
                    <span className="text-gray-600 normal-case">{b.completion !== null ? `${b.completion}%` : '—'}</span>
                  </div>
                  <ProgressBar value={b.completion} color="bg-green-500" size="sm" />
                </div>
                <div className="mt-3 text-xs text-gray-500 truncate">
                  {next ? `Next: ${next.title} • ${next.date}` : 'No upcoming session scheduled'}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onOpenBatch(b.id)}
                    className="flex-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => onViewSchedule(b.id)}
                    className="flex-1 text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    View Schedule
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
