import { useState } from 'react';
import type { Assignment } from '../types/assignment';
import type { AssignmentFeedbackAudience } from '../types/assignmentFeedback';
import * as assignmentFeedbackService from '../services/api/assignmentFeedbackService';

interface AssignmentFeedbackCellProps {
  assignment: Assignment;
  onChange: (assignmentId: string, feedbackForm: Assignment['feedbackForm']) => void;
  /** Admin/facilitator can attach/edit the link; trainees only see it (handled by a different UI). */
  canManage: boolean;
}

const AUDIENCE_OPTIONS: { value: AssignmentFeedbackAudience; label: string }[] = [
  { value: 'Both', label: 'Trainees & Facilitators' },
  { value: 'Trainees', label: 'Trainees only' },
  { value: 'Facilitators', label: 'Facilitators only' }
];

/** Feedback-form cell for an assignment — attach/copy/edit an external form link, same pattern as SessionFeedbackCell. */
export default function AssignmentFeedbackCell({ assignment, onChange, canManage }: AssignmentFeedbackCellProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(assignment.feedbackForm?.name ?? `${assignment.title} Feedback`);
  const [description, setDescription] = useState(assignment.feedbackForm?.description ?? '');
  const [url, setUrl] = useState(assignment.feedbackForm?.formUrl ?? '');
  const [audience, setAudience] = useState<AssignmentFeedbackAudience>(assignment.feedbackForm?.audience ?? 'Both');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  function openEditor() {
    setName(assignment.feedbackForm?.name ?? `${assignment.title} Feedback`);
    setDescription(assignment.feedbackForm?.description ?? '');
    setUrl(assignment.feedbackForm?.formUrl ?? '');
    setAudience(assignment.feedbackForm?.audience ?? 'Both');
    setEditing(true);
  }

  async function handleSave() {
    if (!url.trim() || !name.trim()) return;
    setSaving(true);
    try {
      const form = assignment.feedbackForm
        ? await assignmentFeedbackService.updateAssignmentFeedbackForm(assignment.id, {
            name: name.trim(),
            description: description.trim(),
            formUrl: url.trim(),
            audience
          })
        : await assignmentFeedbackService.attachAssignmentFeedbackForm(assignment.id, {
            name: name.trim(),
            description: description.trim(),
            formUrl: url.trim(),
            audience
          });
      onChange(assignment.id, {
        id: form.id,
        name: form.name,
        description: form.description,
        formUrl: form.formUrl,
        audience: form.audience,
        submittedCount: form.submittedCount
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!assignment.feedbackForm) return;
    if (!window.confirm('Remove this assignment feedback form? This cannot be undone.')) return;
    setSaving(true);
    try {
      await assignmentFeedbackService.removeAssignmentFeedbackForm(assignment.id);
      onChange(assignment.id, null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!assignment.feedbackForm) return;
    navigator.clipboard?.writeText(assignment.feedbackForm.formUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined
    );
  }

  // "Assignment Feedback:" — labeled here (once) so Admin/Facilitator/Trainee all read the same wording.
  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 w-56">
        <span className="text-gray-500 text-xs font-semibold">Assignment Feedback</span>
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
          onChange={(e) => setAudience(e.target.value as AssignmentFeedbackAudience)}
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
          {assignment.feedbackForm && (
            <button onClick={handleRemove} disabled={saving} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Remove</button>
          )}
        </div>
      </div>
    );
  }

  if (!assignment.feedbackForm) {
    return canManage ? (
      <span className="flex items-center gap-1.5">
        <span className="text-gray-500">Assignment Feedback:</span>
        <button onClick={openEditor} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Attach Feedback Form</button>
      </span>
    ) : (
      <span className="text-xs text-gray-400">Assignment Feedback: Not available</span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500">Assignment Feedback:</span>
      <a href={assignment.feedbackForm.formUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:text-blue-800">
        Open Feedback Form
      </a>
      <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600" title="Copy link">{copied ? 'Copied!' : 'Copy'}</button>
      {canManage && <button onClick={openEditor} className="text-gray-400 hover:text-gray-600" title="Edit link">Edit</button>}
      <span className="text-gray-400">({assignment.feedbackForm.submittedCount} submitted)</span>
    </div>
  );
}
