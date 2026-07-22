import { useEffect, useState } from 'react';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import EmptyState from '../EmptyState';
import { useFacilitatorAssignmentsStore, FacilitatorAssignmentStatus } from '../../store/facilitatorAssignmentsStore';
import type { FacilitatorRole } from '../../types/facilitatorAssignment';
import { listUsers, ApiUser } from '../../services/api/userService';
import { useAuthStore } from '../../store/authStore';
import { canManageFacilitatorTeam, canRemoveFacilitator, canSetPrimaryCoordinator } from '../../constants/permissions';

const ROLE_OPTIONS: FacilitatorRole[] = ['Primary Coordinator', 'Lead Facilitator', 'Trainer', 'Guest Trainer', 'Assignment Reviewer', 'Backup Facilitator'];
const STATUS_STYLE: Record<FacilitatorAssignmentStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Upcoming: 'bg-blue-100 text-blue-700',
  'Temporarily Unavailable': 'bg-amber-100 text-amber-700',
  Completed: 'bg-gray-200 text-gray-600',
  Removed: 'bg-red-100 text-red-700'
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

interface FacilitatorTeamDrawerProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
}

// Admin's Phase 4 facilitator-management surface: view the team, add/remove members, change
// roles, and transfer the Primary Coordinator -- all scoped to one batch. Guest trainers are
// intentionally not manageable here: they're a session-level, no-portal-access concept (see
// Phase 5/6), not a batch-team membership.
export default function FacilitatorTeamDrawer({ open, onClose, batchId, batchName }: FacilitatorTeamDrawerProps) {
  const role = useAuthStore((s) => s.role);
  const { assignments, fetchAssignments, addAssignment, updateAssignment, setPrimaryCoordinator, removeAssignment } = useFacilitatorAssignmentsStore();
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<ApiUser[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedRole, setSelectedRole] = useState<FacilitatorRole>('Trainer');
  const [confirmPrimaryId, setConfirmPrimaryId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) fetchAssignments({ batchId });
  }, [open, batchId, fetchAssignments]);

  useEffect(() => {
    if (addOpen) listUsers({ role: 'facilitator', pageSize: 200 }).then((res) => setCandidates(res.data));
  }, [addOpen]);

  const team = assignments.filter((a) => a.batchId === batchId && a.status !== 'Removed');
  const availableCandidates = candidates.filter(
    (c) => !team.some((t) => t.facilitatorId === c.id) && (search.trim() === '' || c.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  async function handleAdd() {
    if (!selectedCandidateId) return;
    if (!canManageFacilitatorTeam(role)) {
      setError('You do not have permission to manage this batch\'s facilitator team.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addAssignment({ batchId, facilitatorId: selectedCandidateId, role: selectedRole });
      setAddOpen(false);
      setSelectedCandidateId('');
      setSelectedRole('Trainer');
      setSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add that facilitator.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPrimary(id: string) {
    if (!canSetPrimaryCoordinator(role)) {
      setError('Only Admin can change a batch\'s Primary Coordinator.');
      setConfirmPrimaryId(null);
      return;
    }
    setBusy(true);
    try {
      await setPrimaryCoordinator(id);
    } finally {
      setBusy(false);
      setConfirmPrimaryId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!canRemoveFacilitator(role)) {
      setError('Only Admin can remove a facilitator from a batch.');
      setConfirmRemoveId(null);
      return;
    }
    setBusy(true);
    try {
      await removeAssignment(id);
    } finally {
      setBusy(false);
      setConfirmRemoveId(null);
    }
  }

  const removeTarget = team.find((a) => a.id === confirmRemoveId);
  const primaryTarget = team.find((a) => a.id === confirmPrimaryId);
  const currentPrimary = team.find((a) => a.isPrimaryCoordinator);

  const removeMessage = (() => {
    if (!removeTarget) return '';
    if (removeTarget.isPrimaryCoordinator) {
      return `${removeTarget.facilitatorName} is this batch's Primary Coordinator. Removing them leaves the batch with no coordinator until you assign a new one${
        removeTarget.upcomingSessionCount > 0 ? `, and they still have ${removeTarget.upcomingSessionCount} upcoming session(s) here` : ''
      }. Continue?`;
    }
    if (removeTarget.upcomingSessionCount > 0) {
      return `${removeTarget.facilitatorName} still has ${removeTarget.upcomingSessionCount} upcoming session(s) in this batch. Removing them from the team does not reassign those sessions -- reassign the affected sessions from the Sessions tab first, or confirm to remove anyway.`;
    }
    return `Remove ${removeTarget.facilitatorName} from this batch's team? They keep credit for any sessions already delivered.`;
  })();

  return (
    <Modal open={open} onClose={onClose} title={`Facilitators — ${batchName}`} subtitle="Manage who's on this batch's team and who coordinates it." maxWidth="lg">
      <div className="space-y-4">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">{team.length} facilitator{team.length === 1 ? '' : 's'} on this batch</span>
          <button onClick={() => setAddOpen((o) => !o)} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
            {addOpen ? 'Cancel' : '+ Add Facilitator'}
          </button>
        </div>

        {addOpen && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search facilitators..."
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
            />
            <select value={selectedCandidateId} onChange={(e) => setSelectedCandidateId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none bg-white">
              <option value="">Select a facilitator…</option>
              {availableCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as FacilitatorRole)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none bg-white">
              {ROLE_OPTIONS.filter((r) => r !== 'Primary Coordinator').map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400">To make someone Primary Coordinator, add them first, then use "Make Coordinator" below.</p>
            <div className="flex justify-end">
              <button
                disabled={!selectedCandidateId || busy}
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Team
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {team.length === 0 ? (
            <EmptyState title="No facilitators assigned" message="Add at least a Primary Coordinator so this batch has an owner." icon="inbox" />
          ) : (
            team.map((a) => (
              <div key={a.id} className="p-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{initials(a.facilitatorName)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800 truncate">{a.facilitatorName}</span>
                    {a.isPrimaryCoordinator && <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Coordinator</span>}
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{a.facilitatorEmail}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {a.sessionCount} session{a.sessionCount === 1 ? '' : 's'} in this batch • {a.upcomingSessionCount} upcoming
                  </div>
                  {a.notes && <div className="text-[11px] text-gray-400 mt-0.5 italic truncate">{a.notes}</div>}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <select
                    value={a.role}
                    onChange={(e) => updateAssignment(a.id, { role: e.target.value as FacilitatorRole })}
                    disabled={a.isPrimaryCoordinator}
                    className="text-xs border rounded-lg px-2 py-1 outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {ROLE_OPTIONS.filter((r) => r !== 'Primary Coordinator' || a.isPrimaryCoordinator).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    {!a.isPrimaryCoordinator && (
                      <button onClick={() => setConfirmPrimaryId(a.id)} className="text-[11px] font-bold text-purple-600 hover:underline">
                        Make Coordinator
                      </button>
                    )}
                    <button onClick={() => setConfirmRemoveId(a.id)} className="text-[11px] font-bold text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!primaryTarget}
        title="Change Primary Coordinator?"
        message={`${primaryTarget?.facilitatorName ?? ''} will become the Primary Coordinator${
          currentPrimary ? `, replacing ${currentPrimary.facilitatorName} (who becomes Lead Facilitator and stays on the team)` : ''
        }. This does not change any session's assigned trainer.`}
        confirmLabel="Set as Coordinator"
        onConfirm={() => primaryTarget && handleSetPrimary(primaryTarget.id)}
        onCancel={() => setConfirmPrimaryId(null)}
      />

      <ConfirmDialog open={!!removeTarget} title="Remove Facilitator?" message={removeMessage} confirmLabel="Remove" danger onConfirm={() => removeTarget && handleRemove(removeTarget.id)} onCancel={() => setConfirmRemoveId(null)} />
    </Modal>
  );
}
