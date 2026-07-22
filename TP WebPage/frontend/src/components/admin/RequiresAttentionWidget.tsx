import { useMemo } from 'react';
import { Batch } from '../../store/batchesStore';
import { Session } from '../../store/sessionsStore';
import EmptyState from '../EmptyState';

type Priority = 'high' | 'medium' | 'low';

interface AttentionItem {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  onClick: () => void;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-200 text-gray-600'
};

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface RequiresAttentionWidgetProps {
  batches: Batch[];
  sessions: Session[];
  onOpenBatch: (batchId: string) => void;
  onOpenSessions: () => void;
  onOpenFeedbackForms: () => void;
}

// Every item here is derived from real store data (batch.poc, session.facilitator,
// session.feedbackForm, batch.startDate/attendanceRate) -- nothing here is fabricated for
// visual effect, per the "keep Demo Mode honest" constraint.
export default function RequiresAttentionWidget({ batches, sessions, onOpenBatch, onOpenSessions, onOpenFeedbackForms }: RequiresAttentionWidgetProps) {
  const items = useMemo(() => {
    const result: AttentionItem[] = [];

    for (const b of batches) {
      if (!b.poc) {
        result.push({
          id: `no-coordinator-${b.id}`,
          title: `${b.name} has no coordinator`,
          description: 'Assign a POC/trainer so the batch has a clear point of contact.',
          priority: 'high',
          onClick: () => onOpenBatch(b.id)
        });
      }
      if (b.status === 'Active' && b.attendanceRate === null) {
        result.push({
          id: `attendance-pending-${b.id}`,
          title: `${b.name} has no attendance recorded`,
          description: 'Attendance is still pending for this active batch.',
          priority: 'low',
          onClick: () => onOpenBatch(b.id)
        });
      }
      if (b.status === 'Upcoming') {
        const days = daysUntil(b.startDate);
        if (days >= 0 && days <= 7) {
          result.push({
            id: `starting-soon-${b.id}`,
            title: `${b.name} starts in ${days === 0 ? 'less than a day' : `${days} day${days === 1 ? '' : 's'}`}`,
            description: 'Confirm facilitators and trainee onboarding are ready before kickoff.',
            priority: 'medium',
            onClick: () => onOpenBatch(b.id)
          });
        }
      }
    }

    const untrained = sessions.filter((s) => s.status === 'Upcoming' && !s.facilitator);
    if (untrained.length > 0) {
      result.push({
        id: 'sessions-no-trainer',
        title: `${untrained.length} upcoming session${untrained.length === 1 ? '' : 's'} without a trainer`,
        description: untrained
          .slice(0, 3)
          .map((s) => s.title)
          .join(', '),
        priority: 'high',
        onClick: onOpenSessions
      });
    }

    const missingForm = sessions.filter((s) => (s.status === 'Upcoming' || s.status === 'Completed') && s.feedbackForm === null);
    if (missingForm.length > 0) {
      result.push({
        id: 'sessions-no-feedback-form',
        title: `${missingForm.length} session${missingForm.length === 1 ? '' : 's'} missing a feedback form`,
        description: 'Attach a feedback-form link so trainees can submit session feedback.',
        priority: 'medium',
        onClick: onOpenFeedbackForms
      });
    }

    return result.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]).slice(0, 6);
  }, [batches, sessions, onOpenBatch, onOpenSessions, onOpenFeedbackForms]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-bold text-gray-800">Requires Attention</h3>
      </div>
      {items.length === 0 ? (
        <EmptyState title="All clear" message="Nothing needs your attention right now." icon="inbox" />
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${PRIORITY_STYLE[item.priority]}`}>{item.priority}</span>
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">{item.description}</p>
              </div>
              <button
                onClick={item.onClick}
                className="flex-shrink-0 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Review
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
