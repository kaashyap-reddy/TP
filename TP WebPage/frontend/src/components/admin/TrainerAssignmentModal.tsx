import { useMemo, useState } from 'react';
import Modal from '../Modal';
import type { Session } from '../../types/session';
import { findTrainerConflicts } from '../../utils/trainerConflicts';

const GUEST_VALUE = '__guest__';
const UNASSIGN_VALUE = '__unassign__';

export interface TrainerAssignmentResult {
  primaryTrainerId?: string | null;
  guestTrainer?: { name: string; email: string; organization: string | null; notes: string | null } | null;
  skipAlreadyAssigned: boolean;
}

interface TrainerAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  /** The session(s) being assigned -- one for a single assignment, several for bulk. */
  targetSessions: Session[];
  /** Candidate trainers -- normally the batch's active facilitator team; if assigning across
   * several batches in bulk, the union of their teams. */
  candidates: { id: string; name: string }[];
  allSessions: Session[];
  onSave: (result: TrainerAssignmentResult) => Promise<void>;
}

// Covers both the single-session "Assign Trainer" action and the bulk "Assign Trainer to
// Selected" action from one component, per Phase 5/6 -- candidates always come from the batch's
// team; picking someone outside it means adding them as a Guest Trainer instead of silently
// creating an inconsistent assignment.
export default function TrainerAssignmentModal({ open, onClose, targetSessions, candidates, allSessions, onSave }: TrainerAssignmentModalProps) {
  const isBulk = targetSessions.length > 1;
  const [selection, setSelection] = useState<string>(targetSessions[0]?.primaryTrainerId ?? '');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestOrg, setGuestOrg] = useState('');
  const [skipAssigned, setSkipAssigned] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyAssignedCount = useMemo(() => targetSessions.filter((s) => s.primaryTrainerId || s.guestTrainer).length, [targetSessions]);

  const conflicts = useMemo(() => {
    if (!selection || selection === GUEST_VALUE || selection === UNASSIGN_VALUE) return [];
    const sessionIds = targetSessions.map((s) => s.id);
    return findTrainerConflicts(allSessions, selection, sessionIds, targetSessions);
  }, [selection, targetSessions, allSessions]);

  async function handleSave() {
    setError(null);
    if (selection === GUEST_VALUE && !guestName.trim()) {
      setError('Enter the guest trainer\'s name.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        primaryTrainerId: selection === GUEST_VALUE || selection === UNASSIGN_VALUE ? null : selection,
        guestTrainer: selection === GUEST_VALUE ? { name: guestName.trim(), email: guestEmail.trim(), organization: guestOrg.trim() || null, notes: null } : null,
        skipAlreadyAssigned: isBulk ? skipAssigned : false
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this assignment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBulk ? `Assign Trainer to ${targetSessions.length} Sessions` : `Assign Trainer — ${targetSessions[0]?.title ?? ''}`}
      subtitle={isBulk ? undefined : targetSessions[0] ? `${targetSessions[0].date} • ${targetSessions[0].time}` : undefined}
      maxWidth="md"
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-red-600">{error}</p>}

        {isBulk && alreadyAssignedCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-2">
            <p>{alreadyAssignedCount} of {targetSessions.length} selected sessions already have a trainer.</p>
            <label className="flex items-center gap-2">
              <input type="radio" checked={skipAssigned} onChange={() => setSkipAssigned(true)} />
              Skip already-assigned sessions (recommended)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!skipAssigned} onChange={() => setSkipAssigned(false)} />
              Replace their existing primary trainer
            </label>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Trainer</label>
          <select value={selection} onChange={(e) => setSelection(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500">
            <option value={UNASSIGN_VALUE}>— Unassigned —</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={GUEST_VALUE}>+ Add as Guest Trainer…</option>
          </select>
          <p className="text-[11px] text-gray-400 mt-1">Only shows facilitators already on the batch's team. Pick "Add as Guest Trainer" for a one-off, non-portal trainer.</p>
        </div>

        {selection === GUEST_VALUE && (
          <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest trainer name" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email (optional)" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            <input type="text" value={guestOrg} onChange={(e) => setGuestOrg(e.target.value)} placeholder="Organization (optional)" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            <p className="text-[11px] text-gray-400">Guest trainers get no portal account and no access beyond this one session.</p>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
            <p className="font-bold">Scheduling conflict{conflicts.length === 1 ? '' : 's'} detected:</p>
            {conflicts.slice(0, 3).map((c, i) => (
              <p key={i}>
                Already booked for "{c.session.title}" ({c.session.date}, {c.session.time})
              </p>
            ))}
            <p>You can still assign, but confirm this is intentional (Admin override).</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : conflicts.length > 0 ? 'Assign Anyway' : 'Assign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
