import { useState } from 'react';
import type { Session } from '../types/session';
import type { SessionFeedbackAudience } from '../types/sessionFeedback';
import * as sessionFeedbackService from '../services/api/sessionFeedbackService';
import { useToastStore } from '../store/toastStore';

interface SessionFeedbackCellProps {
  session: Session;
  onChange: (sessionId: string, feedbackForm: Session['feedbackForm']) => void;
  /** Admin/facilitator can attach/edit the link; trainees only see it (handled by a different UI). */
  canManage: boolean;
}

const AUDIENCE_OPTIONS: { value: SessionFeedbackAudience; label: string }[] = [
  { value: 'Both', label: 'Trainees & Facilitators' },
  { value: 'Trainees', label: 'Trainees only' },
  { value: 'Facilitators', label: 'Facilitators only' }
];

/** Feedback-form cell shown on Admin/Facilitator Sessions & Calendar rows — attach/copy/edit an external form link. */
export default function SessionFeedbackCell({ session, onChange, canManage }: SessionFeedbackCellProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.feedbackForm?.name ?? `${session.title} Feedback`);
  const [description, setDescription] = useState(session.feedbackForm?.description ?? '');
  const [url, setUrl] = useState(session.feedbackForm?.formUrl ?? '');
  const [audience, setAudience] = useState<SessionFeedbackAudience>(session.feedbackForm?.audience ?? 'Both');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  function openEditor() {
    setName(session.feedbackForm?.name ?? `${session.title} Feedback`);
    setDescription(session.feedbackForm?.description ?? '');
    setUrl(session.feedbackForm?.formUrl ?? '');
    setAudience(session.feedbackForm?.audience ?? 'Both');
    setEditing(true);
  }

  async function handleSave() {
    if (!url.trim() || !name.trim()) return;
    setSaving(true);
    try {
      const form = session.feedbackForm
        ? await sessionFeedbackService.updateSessionFeedbackForm(session.id, {
            name: name.trim(),
            description: description.trim(),
            formUrl: url.trim(),
            audience
          })
        : await sessionFeedbackService.attachSessionFeedbackForm(session.id, {
            name: name.trim(),
            description: description.trim(),
            formUrl: url.trim(),
            audience
          });
      onChange(session.id, {
        id: form.id,
        name: form.name,
        description: form.description,
        formUrl: form.formUrl,
        audience: form.audience,
        submittedCount: form.submittedCount
      });
      setEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save the feedback form.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!session.feedbackForm) return;
    if (!window.confirm('Remove this session feedback form? This cannot be undone.')) return;
    setSaving(true);
    try {
      await sessionFeedbackService.removeSessionFeedbackForm(session.id);
      onChange(session.id, null);
      setEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove the feedback form.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!session.feedbackForm) return;
    navigator.clipboard?.writeText(session.feedbackForm.formUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined
    );
  }

  // "Session Feedback:" — not "Assignment:" — the form belongs to the session, not the related
  // assignment. Labeled here (once) so Admin/Facilitator/Trainee all read the same wording.
  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 w-56">
        <span className="text-gray-500 text-xs font-semibold">Session Feedback</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Form name"
          className="px-2 py-1 border rounded text-xs outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="px-2 py-1 border rounded text-xs outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://forms.gle/..."
          className="px-2 py-1 border rounded text-xs outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as SessionFeedbackAudience)}
          className="px-2 py-1 border rounded text-xs outline-none focus:ring-2 focus:ring-blue-500"
        >
          {AUDIENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="text-xs font-bold text-blue-700 hover:text-blue-900 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          {session.feedbackForm && (
            <button onClick={handleRemove} disabled={saving} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Remove</button>
          )}
        </div>
      </div>
    );
  }

  if (!session.feedbackForm) {
    return canManage ? (
      <span className="flex items-center gap-1.5">
        <span className="text-gray-500">Session Feedback:</span>
        <button onClick={openEditor} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Attach Feedback Form</button>
      </span>
    ) : (
      <span className="text-xs text-gray-400">Session Feedback: Not available</span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500">Session Feedback:</span>
      <a href={session.feedbackForm.formUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:text-blue-800">
        Open Feedback Form
      </a>
      <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600" title="Copy link">{copied ? 'Copied!' : 'Copy'}</button>
      {canManage && <button onClick={openEditor} className="text-gray-400 hover:text-gray-600" title="Edit link">Edit</button>}
      <span className="text-gray-400">({session.feedbackForm.submittedCount} submitted)</span>
    </div>
  );
}
