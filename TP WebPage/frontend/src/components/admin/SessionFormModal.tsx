import { useMemo, useState } from 'react';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import SavingButton from '../SavingButton';
import { useSessionsStore, type MeetingPlatform, type Session, type SessionStatus } from '../../store/sessionsStore';
import { dateStrToIso, formatTimeRange, isoToDateStr, parseTimeRange } from '../../utils/sessionTime';
import { findTrainerConflicts } from '../../utils/trainerConflicts';

/** Native <input type="time"> gives "HH:MM" (24h, no range) -- converts that into minutes-since-midnight. */
function nativeTimeToMinutes(value: string): number {
  const [h, m] = value.split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
}

function minutesToNativeTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface SessionFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Undefined = create mode; a real Session = edit mode. */
  session?: Session;
  batchId: string;
  /** Every currently-loaded session (any batch) -- used for the creation-time conflict check. */
  allSessions: Session[];
  /** The trainer a newly-created session gets (create() always hard-codes creator = trainer server-side). */
  currentActorId: string;
  onSaved: (session: Session) => void;
  onDeleted: () => void;
}

const PLATFORMS: MeetingPlatform[] = ['Google Meet', 'Microsoft Teams', 'Zoom', 'Other'];
const STATUSES: SessionStatus[] = ['Upcoming', 'Live', 'Completed', 'Cancelled', 'Rescheduled'];

export default function SessionFormModal({ open, onClose, session, batchId, allSessions, currentActorId, onSaved, onDeleted }: SessionFormModalProps) {
  const isEdit = !!session;
  const { createSession, updateSession, deleteSession } = useSessionsStore();

  const [title, setTitle] = useState(session?.title ?? '');
  const [dateIso, setDateIso] = useState(session ? dateStrToIso(session.date) : '');
  const [timeValue, setTimeValue] = useState(session ? minutesToNativeTime(parseTimeRange(session.time).start) : '');
  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (!session) return 60;
    const { start, end } = parseTimeRange(session.time);
    return Math.max(15, end - start);
  });
  const [platform, setPlatform] = useState<MeetingPlatform>(session?.platform ?? 'Google Meet');
  const [link, setLink] = useState(session?.link ?? '');
  const [status, setStatus] = useState<SessionStatus>(session?.status ?? 'Upcoming');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // findTrainerConflicts only reads id/date/time/status/primaryTrainerId/coTrainers off a
  // candidate -- a full Session isn't needed (and isn't available yet in create mode).
  const candidateWindow: Pick<Session, 'id' | 'date' | 'time' | 'status' | 'primaryTrainerId' | 'coTrainers'> | null = useMemo(() => {
    if (!dateIso || !timeValue) return null;
    const startMin = nativeTimeToMinutes(timeValue);
    return {
      id: session?.id ?? '__draft__',
      date: isoToDateStr(dateIso),
      time: formatTimeRange(startMin, startMin + durationMinutes),
      status: session?.status ?? 'Upcoming',
      primaryTrainerId: session?.primaryTrainerId ?? currentActorId,
      coTrainers: session?.coTrainers ?? []
    };
  }, [dateIso, timeValue, durationMinutes, session, currentActorId]);

  // The trainer for a new session is always the creator (server-hardcoded); for an edit, it's
  // whoever the session is currently assigned to -- either way, that's who we're checking for a
  // double-booking against.
  const conflictTrainerId = session?.primaryTrainerId ?? currentActorId;
  const conflicts = useMemo(() => {
    if (!candidateWindow || !conflictTrainerId) return [];
    return findTrainerConflicts(allSessions, conflictTrainerId, session ? [session.id] : [], [candidateWindow as Session]);
  }, [allSessions, conflictTrainerId, candidateWindow, session]);

  async function handleSave() {
    setError('');
    if (!title.trim() || !dateIso || !timeValue) {
      setError('Title, date, and time are required.');
      return;
    }
    const startMin = nativeTimeToMinutes(timeValue);
    const date = isoToDateStr(dateIso);
    const time = formatTimeRange(startMin, startMin + durationMinutes);

    setSaving(true);
    try {
      if (isEdit && session) {
        await updateSession(session.id, { title: title.trim(), date, time, platform, link, status });
        onSaved({ ...session, title: title.trim(), date, time, platform, link, status });
      } else {
        const created = await createSession({ title: title.trim(), batchId, date, time, platform, link, status: 'Upcoming' });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this session.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!session) return;
    setDeleting(true);
    try {
      await deleteSession(session.id);
      setDeleteConfirmOpen(false);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete this session.');
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={isEdit ? `Edit Session — ${session!.title}` : 'Add Session'} maxWidth="md">
        <div className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label htmlFor="session-form-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input id="session-form-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-form-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input id="session-form-date" type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="session-form-time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input id="session-form-time" type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="session-form-duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input
              id="session-form-duration"
              type="number"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(15, Number(e.target.value) || 15))}
              className="w-full px-3 py-2 border rounded-lg outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="session-form-platform" className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select id="session-form-platform" value={platform} onChange={(e) => setPlatform(e.target.value as MeetingPlatform)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label htmlFor="session-form-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="session-form-status" value={status} onChange={(e) => setStatus(e.target.value as SessionStatus)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="session-form-link" className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
            <input id="session-form-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." className="w-full px-3 py-2 border rounded-lg outline-none" />
          </div>

          {conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-bold">Possible scheduling conflict:</p>
              {conflicts.slice(0, 3).map((c, i) => (
                <p key={i}>Already booked for "{c.session.title}" ({c.session.date}, {c.session.time})</p>
              ))}
              <p>You can still save, but confirm this is intentional.</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {isEdit ? (
              <button onClick={() => setDeleteConfirmOpen(true)} className="text-sm font-bold text-red-600 hover:text-red-700 px-2 py-2">
                Delete Session
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
              <SavingButton onClick={handleSave} isSaving={saving} label={isEdit ? 'Save Changes' : 'Add Session'} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete session?"
        message={`This will permanently remove "${session?.title ?? 'this session'}" from the schedule. This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
