import { useEffect, useState } from 'react';
import * as batchFeedbackService from '../services/api/batchFeedbackService';
import type { BatchFeedbackForm } from '../types/batchFeedback';
import type { FeedbackFormStatus } from '../types/feedbackForm';
import { openFeedbackForm } from '../utils/formUrl';
import { useToastStore } from '../store/toastStore';

const STATUS_STYLE: Record<FeedbackFormStatus, string> = {
  Draft: 'bg-gray-200 text-gray-600',
  Scheduled: 'bg-blue-100 text-blue-700',
  Active: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-200 text-gray-500',
  Archived: 'bg-gray-100 text-gray-400',
  'Invalid Link': 'bg-red-100 text-red-700'
};

interface TraineeBatchFeedbackListProps {
  batchId: string;
}

/** Trainee-facing batch/program-level feedback forms (Mid-Program, Final Program, etc.) -- Prompt
 * 3, Phase 3. The server already hides Draft/Invalid Link forms and anything not addressed to
 * Trainees (see demoMode.ts) -- this only renders whatever it's given. */
export default function TraineeBatchFeedbackList({ batchId }: TraineeBatchFeedbackListProps) {
  const [forms, setForms] = useState<BatchFeedbackForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    batchFeedbackService
      .listBatchFeedbackForms(batchId)
      .then((res) => {
        if (!cancelled) setForms(res);
      })
      .catch(() => {
        if (!cancelled) setForms([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  async function handleSubmit(form: BatchFeedbackForm) {
    setSubmittingId(form.id);
    try {
      await batchFeedbackService.submitBatchFeedback(batchId, form.id);
      setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, mySubmitted: true, submittedCount: f.submittedCount + 1 } : f)));
      showToast('Marked as submitted (local demo status only).');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to mark this feedback as submitted.', 'error');
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) return null;
  if (forms.length === 0) return null;

  const now = Date.now();

  return (
    <div className="px-6 pb-6">
      <h4 className="text-sm font-bold text-gray-700 mb-3">Batch Feedback</h4>
      <div className="space-y-3">
        {forms.map((f) => {
          const notYetOpen = f.openDate ? new Date(f.openDate).getTime() > now : false;
          return (
            <div key={f.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">{f.name}</span>
                  {f.status && <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[f.status]}`}>{f.status}</span>}
                  {f.isRequired && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Required</span>}
                </div>
                {f.description && <p className="text-xs text-gray-500 mt-1">{f.description}</p>}
                <div className="text-[11px] text-gray-400 mt-1">
                  {f.dueDate && `Due ${f.dueDate.slice(0, 10)}`}
                  {notYetOpen && f.openDate && ` • Opens ${f.openDate.slice(0, 10)}`}
                  {f.mySubmitted && ' • Feedback Submitted (local demo status)'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openFeedbackForm(f.formUrl)}
                  disabled={notYetOpen}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Opens the external feedback form in a new tab"
                >
                  Open Form
                </button>
                {f.mySubmitted ? (
                  <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">Submitted</span>
                ) : (
                  f.status === 'Active' && (
                    <button
                      onClick={() => handleSubmit(f)}
                      disabled={submittingId === f.id}
                      className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
                      title="Marks this as completed in this demo only -- does not verify a real Microsoft Forms submission"
                    >
                      {submittingId === f.id ? 'Marking…' : 'Mark Submitted'}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
