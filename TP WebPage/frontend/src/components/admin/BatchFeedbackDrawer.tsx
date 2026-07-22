import { useEffect, useState } from 'react';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import EmptyState from '../EmptyState';
import { useAuthStore } from '../../store/authStore';
import { useFacilitatorAssignmentsStore } from '../../store/facilitatorAssignmentsStore';
import * as batchFeedbackService from '../../services/api/batchFeedbackService';
import type { BatchFeedbackForm, BatchFeedbackFormInput } from '../../types/batchFeedback';
import type { FeedbackFormStatus } from '../../types/feedbackForm';
import { openFeedbackForm } from '../../utils/formUrl';
import { canAttachFeedbackForm, canDeleteFeedbackForm, canEditFeedbackForm, canReportInvalidFeedbackLink } from '../../constants/permissions';

const FORM_TYPE_OPTIONS: BatchFeedbackForm['formType'][] = ['Batch Feedback', 'Mid-Program Feedback', 'Final Program Feedback', 'Custom Feedback'];
const AUDIENCE_OPTIONS: BatchFeedbackForm['audience'][] = ['Trainees', 'Facilitators', 'Primary Coordinators', 'Admins', 'Multiple Roles'];
const STATUS_OPTIONS: FeedbackFormStatus[] = ['Draft', 'Scheduled', 'Active', 'Closed', 'Archived', 'Invalid Link'];
const STATUS_STYLE: Record<FeedbackFormStatus, string> = {
  Draft: 'bg-gray-200 text-gray-600',
  Scheduled: 'bg-blue-100 text-blue-700',
  Active: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-200 text-gray-500',
  Archived: 'bg-gray-100 text-gray-400',
  'Invalid Link': 'bg-red-100 text-red-700'
};

const EMPTY_DRAFT: BatchFeedbackFormInput = {
  name: '',
  description: '',
  formUrl: '',
  formType: 'Batch Feedback',
  audience: 'Trainees',
  isRequired: false,
  instructions: '',
  openDate: null,
  dueDate: null
};

interface BatchFeedbackDrawerProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
}

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** Admin + facilitator (Primary Coordinator/Lead Facilitator) surface for batch/program-level
 * feedback forms -- Prompt 3, Phases 2 and 7. A plain Trainer on the batch team can still open
 * this drawer to view forms and report a broken link, but cannot attach, edit, or delete one. */
export default function BatchFeedbackDrawer({ open, onClose, batchId, batchName }: BatchFeedbackDrawerProps) {
  const role = useAuthStore((s) => s.role);
  const currentUserId = useAuthStore((s) => s.id);
  const { assignments, fetchAssignments } = useFacilitatorAssignmentsStore();
  const [forms, setForms] = useState<BatchFeedbackForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BatchFeedbackFormInput>(EMPTY_DRAFT);
  const [draftStatus, setDraftStatus] = useState<FeedbackFormStatus>('Draft');
  const [saving, setSaving] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const myBatchRole = assignments.find((a) => a.batchId === batchId && a.facilitatorId === currentUserId && a.status !== 'Removed')?.role ?? null;
  const canAttach = canAttachFeedbackForm(role, myBatchRole);
  const canDelete = canDeleteFeedbackForm(role);
  const canReportInvalid = canReportInvalidFeedbackLink(role);

  useEffect(() => {
    if (!open) return;
    fetchAssignments({ batchId });
    setLoading(true);
    setError(null);
    batchFeedbackService
      .listBatchFeedbackForms(batchId)
      .then(setForms)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load feedback forms.'))
      .finally(() => setLoading(false));
  }, [open, batchId, fetchAssignments]);

  function openEditor(form?: BatchFeedbackForm) {
    if (form) {
      setEditingId(form.id);
      setDraft({
        name: form.name,
        description: form.description,
        formUrl: form.formUrl,
        formType: form.formType,
        audience: form.audience,
        isRequired: form.isRequired ?? false,
        instructions: form.instructions ?? '',
        openDate: form.openDate ?? null,
        dueDate: form.dueDate ?? null
      });
      setDraftStatus(form.status ?? 'Draft');
    } else {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      setDraftStatus('Draft');
    }
    setAddOpen(true);
  }

  async function handleSave() {
    if (!draft.name.trim() || !draft.formUrl.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const input: BatchFeedbackFormInput & { status?: FeedbackFormStatus } = {
        ...draft,
        name: draft.name.trim(),
        description: (draft.description ?? '').trim(),
        formUrl: draft.formUrl.trim(),
        instructions: (draft.instructions ?? '').trim() || undefined,
        status: draftStatus
      } as BatchFeedbackFormInput & { status?: FeedbackFormStatus };
      const saved = editingId
        ? await batchFeedbackService.updateBatchFeedbackForm(batchId, editingId, input)
        : await batchFeedbackService.attachBatchFeedbackForm(batchId, input);
      setForms((prev) => (editingId ? prev.map((f) => (f.id === saved.id ? saved : f)) : [...prev, saved]));
      setAddOpen(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the feedback form.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReportInvalid(form: BatchFeedbackForm) {
    setSaving(true);
    setError(null);
    try {
      const updated = await batchFeedbackService.updateBatchFeedbackForm(batchId, form.id, { status: 'Invalid Link' } as Partial<BatchFeedbackFormInput>);
      setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to report this link.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(formId: string) {
    setSaving(true);
    try {
      await batchFeedbackService.removeBatchFeedbackForm(batchId, formId);
      setForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove this feedback form.');
    } finally {
      setSaving(false);
      setConfirmRemoveId(null);
    }
  }

  const removeTarget = forms.find((f) => f.id === confirmRemoveId);

  return (
    <Modal open={open} onClose={onClose} title={`Feedback — ${batchName}`} subtitle="Batch/program-level feedback forms (Mid-Program, Final Program, etc.)." maxWidth="lg">
      <div className="space-y-4">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">{forms.length} form{forms.length === 1 ? '' : 's'} attached to this batch</span>
          {canAttach && (
            <button onClick={() => (addOpen ? setAddOpen(false) : openEditor())} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              {addOpen ? 'Cancel' : '+ Attach Feedback Form'}
            </button>
          )}
        </div>

        {addOpen && canAttach && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <input type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Form name" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" autoFocus />
            <input type="text" value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Description (optional)" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            <input type="url" value={draft.formUrl} onChange={(e) => setDraft((d) => ({ ...d, formUrl: e.target.value }))} placeholder="https://forms.office.com/..." className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <select value={draft.formType} onChange={(e) => setDraft((d) => ({ ...d, formType: e.target.value as BatchFeedbackForm['formType'] }))} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                {FORM_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select value={draft.audience} onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value as BatchFeedbackForm['audience'] }))} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                {AUDIENCE_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500 flex flex-col gap-1">
                Opens
                <input type="date" value={toDateInputValue(draft.openDate)} onChange={(e) => setDraft((d) => ({ ...d, openDate: e.target.value || null }))} className="px-3 py-2 border rounded-lg text-sm outline-none" />
              </label>
              <label className="text-xs text-gray-500 flex flex-col gap-1">
                Due
                <input type="date" value={toDateInputValue(draft.dueDate)} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value || null }))} className="px-3 py-2 border rounded-lg text-sm outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 items-center">
              <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as FeedbackFormStatus)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={draft.isRequired ?? false} onChange={(e) => setDraft((d) => ({ ...d, isRequired: e.target.checked }))} />
                Required
              </label>
            </div>
            <p className="text-[11px] text-gray-400">
              Completion is tracked locally in this demo only — opening or submitting here never syncs with a real Microsoft Forms response.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              <button disabled={saving || !draft.name.trim() || !draft.formUrl.trim()} onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Attach Form'}
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading…</div>
          ) : forms.length === 0 ? (
            <EmptyState title="No feedback forms attached" message="Attach a Mid-Program or Final Program feedback form to this batch." icon="inbox" />
          ) : (
            forms.map((f) => (
              <div key={f.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">{f.name}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{f.formType}</span>
                  {f.status && <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[f.status]}`}>{f.status}</span>}
                  {f.isRequired && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Required</span>}
                </div>
                {f.description && <div className="text-xs text-gray-500 mt-1">{f.description}</div>}
                <div className="text-[11px] text-gray-400 mt-1">
                  Audience: {f.audience} • {f.submittedCount}/{f.totalTrainees} submitted
                  {f.openDate && ` • Opens ${f.openDate.slice(0, 10)}`}
                  {f.dueDate && ` • Due ${f.dueDate.slice(0, 10)}`}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <button onClick={() => openFeedbackForm(f.formUrl)} className="font-bold text-blue-600 hover:text-blue-800">Open Form</button>
                  {canEditFeedbackForm(role, myBatchRole) && (
                    <button onClick={() => openEditor(f)} className="text-gray-500 hover:text-gray-700">Edit</button>
                  )}
                  {!canEditFeedbackForm(role, myBatchRole) && canReportInvalid && f.status !== 'Invalid Link' && (
                    <button onClick={() => handleReportInvalid(f)} className="text-amber-600 hover:text-amber-800">Report Invalid Link</button>
                  )}
                  {canDelete && (
                    <button onClick={() => setConfirmRemoveId(f.id)} className="text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Feedback Form?"
        message={`Remove "${removeTarget?.name ?? ''}" from ${batchName}? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => removeTarget && handleRemove(removeTarget.id)}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </Modal>
  );
}
