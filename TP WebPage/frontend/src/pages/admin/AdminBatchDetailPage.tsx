import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBatchesStore, type Batch } from '../../store/batchesStore';
import { useAssignmentsStore } from '../../store/assignmentsStore';
import { useSessionsStore, type Session } from '../../store/sessionsStore';
import { useResourcesStore } from '../../store/resourcesStore';
import { useAnnouncementsStore } from '../../store/announcementsStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useAuditLogStore } from '../../store/auditLogStore';
import { listBatchTraineeStats, type BatchTraineeStats } from '../../services/api/batchService';
import { formatDateTime } from '../../utils/dateUtils';
import { dateStrToIso } from '../../utils/sessionTime';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import ProgressBar from '../../components/ProgressBar';
import Table from '../../components/Table';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import SavingButton from '../../components/SavingButton';
import FacilitatorTeamDrawer from '../../components/admin/FacilitatorTeamDrawer';
import SessionFormModal from '../../components/admin/SessionFormModal';
import { ROUTES } from '../../constants/routes';
import AuthenticatedDetailLayout from '../../layouts/AuthenticatedDetailLayout';

function initialsOf(name: string): string {
  return name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
}

export default function AdminBatchDetailPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.id);
  const showToast = useToastStore((s) => s.showToast);
  const logEvent = useAuditLogStore((s) => s.logEvent);

  const batches = useBatchesStore((s) => s.batches);
  const fetchBatches = useBatchesStore((s) => s.fetchBatches);
  const updateBatch = useBatchesStore((s) => s.updateBatch);
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const assignments = useAssignmentsStore((s) => s.assignments);
  const fetchAssignments = useAssignmentsStore((s) => s.fetchAssignments);
  useEffect(() => {
    if (batchId) fetchAssignments({ batchId });
  }, [fetchAssignments, batchId]);

  const sessions = useSessionsStore((s) => s.sessions);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);
  useEffect(() => {
    if (batchId) fetchSessions({ batchId });
  }, [fetchSessions, batchId]);

  const resources = useResourcesStore((s) => s.resources);
  const fetchResources = useResourcesStore((s) => s.fetchResources);
  useEffect(() => {
    if (batchId) fetchResources({ batchId });
  }, [fetchResources, batchId]);

  const announcements = useAnnouncementsStore((s) => s.announcements);
  const fetchAnnouncements = useAnnouncementsStore((s) => s.fetchAnnouncements);
  useEffect(() => {
    if (batchId) fetchAnnouncements(batches, { batchId });
    // Only re-run when the batch list first loads/changes shape, not on every batches re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAnnouncements, batchId, batches?.length]);

  const [trainees, setTrainees] = useState<BatchTraineeStats[]>([]);
  const [traineesLoading, setTraineesLoading] = useState(true);
  const [traineesError, setTraineesError] = useState('');
  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    setTraineesLoading(true);
    setTraineesError('');
    listBatchTraineeStats(batchId)
      .then((res) => {
        if (!cancelled) setTrainees(res);
      })
      .catch((err) => {
        if (!cancelled) setTraineesError(err instanceof Error ? err.message : 'Unable to load trainee stats.');
      })
      .finally(() => {
        if (!cancelled) setTraineesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const batch = useMemo(() => batches.find((b) => b.id === batchId), [batches, batchId]);

  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', code: '', status: 'Active' as Batch['status'], startDateIso: '', endDateIso: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionBeingEdited, setSessionBeingEdited] = useState<Session | undefined>(undefined);

  function openEditInfo() {
    if (!batch) return;
    setEditForm({
      name: batch.name,
      code: batch.code,
      status: batch.status,
      startDateIso: batch.startDate ? dateStrToIso(batch.startDate) : '',
      endDateIso: batch.endDate ? dateStrToIso(batch.endDate) : ''
    });
    setEditError('');
    setEditInfoOpen(true);
  }

  async function saveEditInfo() {
    if (!batch) return;
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setEditError('Name and code are required.');
      return;
    }
    setEditSaving(true);
    try {
      await updateBatch(batch.id, {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        status: editForm.status,
        startDate: editForm.startDateIso || undefined,
        endDate: editForm.endDateIso || null
      });
      logEvent('Batch', `${batch.name} details were updated.`);
      showToast('Batch details updated');
      setEditInfoOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update batch.');
    } finally {
      setEditSaving(false);
    }
  }

  function openAddSession() {
    setSessionBeingEdited(undefined);
    setSessionModalOpen(true);
  }

  function openEditSession(session: Session) {
    setSessionBeingEdited(session);
    setSessionModalOpen(true);
  }

  function goBack() {
    navigate(ROUTES.ADMIN, { state: { tab: 'batches' } });
  }

  if (!batchId || !batch) {
    return (
      <AuthenticatedDetailLayout role="admin" activeTab="batches" headerTitle="Batch" breadcrumbTrail={['Admin', 'Batch Management']} onBack={goBack} backLabel="Back to Batch Management">
        <p className="text-sm text-gray-600">Batch not found.</p>
      </AuthenticatedDetailLayout>
    );
  }

  const batchAssignments = assignments.filter((a) => a.batchId === batchId || a.batches.some((b) => b.id === batchId));
  const upcomingSessions = sessions.filter((s) => s.status === 'Upcoming').sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AuthenticatedDetailLayout
      role="admin"
      activeTab="batches"
      headerTitle={batch.name}
      breadcrumbTrail={['Admin', 'Batch Management', batch.name]}
      onBack={goBack}
      backLabel="Back to Batch Management"
    >
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <StatusBadge status={batch.status} />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{batch.code}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {batch.program} {batch.track} • {batch.startMonth || '—'} – {batch.endDate ? formatDateTime(batch.endDate) : '—'} • POC: {batch.poc || 'Unassigned'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTeamDrawerOpen(true)} className="px-3 py-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            Manage Facilitators
          </button>
          <button onClick={openEditInfo} className="px-3 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Edit Batch Info
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Trainees" value={batch.traineeCount} valueClassName="text-3xl font-bold mt-2 text-gray-800" />
          <StatCard label="Completion" value={batch.completion !== null ? `${batch.completion}%` : '—'} valueClassName="text-3xl font-bold mt-2 text-gray-800" />
          <StatCard label="Attendance" value={batch.attendanceRate !== null ? `${batch.attendanceRate}%` : '—'} valueClassName="text-3xl font-bold mt-2 text-gray-800" />
          <StatCard label="Avg Score" value={batch.avgScore !== null ? `${batch.avgScore}/100` : '—'} valueClassName="text-3xl font-bold mt-2 text-gray-800" />
        </div>

        {/* Trainee roster */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-800">Trainees</h2>
          </div>
          {traineesError ? (
            <p className="p-6 text-sm text-red-600">{traineesError}</p>
          ) : traineesLoading ? (
            <p className="p-6 text-sm text-gray-400">Loading…</p>
          ) : trainees.length === 0 ? (
            <EmptyState title="No trainees enrolled yet" icon="inbox" />
          ) : (
            <Table
              columns={[
                { key: 'trainee', label: 'Trainee' },
                { key: 'attendance', label: 'Attendance' },
                { key: 'completed', label: 'Completed' },
                { key: 'pending', label: 'Pending' },
                { key: 'grade', label: 'Avg Grade' },
                { key: 'progress', label: 'Overall Progress' }
              ]}
            >
              {trainees.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(ROUTES.ADMIN_TRAINEE_PROFILE(t.name), { state: { from: { batchId: batch.id } } })}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">{initialsOf(t.name)}</div>
                      <div>
                        <div className="font-bold text-gray-800">{t.name}</div>
                        <div className="text-xs text-gray-500">{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{t.attendancePercentage !== null ? `${t.attendancePercentage}%` : '—'}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{t.assignmentsCompleted}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{t.assignmentsPending}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{t.avgGrade !== null ? `${t.avgGrade}/100` : '—'}</td>
                  <td className="px-6 py-4 w-40">{t.overallProgress !== null ? <ProgressBar value={t.overallProgress} /> : <span className="text-gray-400 text-sm">—</span>}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        {/* Sessions */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Sessions</h2>
            <button onClick={openAddSession} className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
              + Add Session
            </button>
          </div>
          {sessions.length === 0 ? (
            <EmptyState title="No sessions scheduled yet" icon="calendar" />
          ) : (
            <div className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{s.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {s.date} • {s.time} • {s.platform} • {s.primaryTrainerName ?? 'No trainer assigned'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={s.status} />
                    <button onClick={() => openEditSession(s)} className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assignments */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-800">Assignments</h2>
            </div>
            {batchAssignments.length === 0 ? (
              <EmptyState title="No assignments for this batch yet" icon="inbox" />
            ) : (
              <div className="divide-y divide-gray-100">
                {batchAssignments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(ROUTES.ASSIGNMENT_DETAIL(a.id))}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 text-sm">{a.title}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="text-[11px] text-gray-500">Deadline: {formatDateTime(a.deadline)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming sessions */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-800">Upcoming Sessions</h2>
            </div>
            {upcomingSessions.length === 0 ? (
              <EmptyState title="No upcoming sessions scheduled" icon="calendar" />
            ) : (
              <div className="divide-y divide-gray-100">
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="p-4">
                    <div className="font-medium text-gray-800 text-sm">{s.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.date} • {s.time} • {s.platform}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resources */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Resources</h2>
              <span className="text-xs font-bold text-gray-400">{resources.length}</span>
            </div>
            {resources.length === 0 ? (
              <EmptyState title="No resources uploaded yet" icon="inbox" />
            ) : (
              <div className="divide-y divide-gray-100">
                {resources.slice(0, 6).map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800 text-sm">{r.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{r.category}</div>
                    </div>
                    {r.verified && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Verified</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="px-6 py-3 border-t border-gray-100">
              <button onClick={() => navigate(ROUTES.ADMIN, { state: { tab: 'resources' } })} className="text-xs font-bold text-blue-600 hover:underline">
                Manage in Global Resources →
              </button>
            </div>
          </div>

          {/* Announcements */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Announcements</h2>
              <span className="text-xs font-bold text-gray-400">{announcements.length}</span>
            </div>
            {announcements.length === 0 ? (
              <EmptyState title="No announcements for this batch yet" icon="inbox" />
            ) : (
              <div className="divide-y divide-gray-100">
                {announcements.slice(0, 6).map((a) => (
                  <div key={a.id} className="p-4">
                    <div className="font-medium text-gray-800 text-sm">{a.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{a.date} • {a.priority}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-6 py-3 border-t border-gray-100">
              <button onClick={() => navigate(ROUTES.ADMIN, { state: { tab: 'announcements' } })} className="text-xs font-bold text-blue-600 hover:underline">
                Manage in Global Announcements →
              </button>
            </div>
          </div>
        </div>
      </div>

      <FacilitatorTeamDrawer open={teamDrawerOpen} onClose={() => setTeamDrawerOpen(false)} batchId={batch.id} batchName={batch.name} />

      {sessionModalOpen && currentUserId && (
        <SessionFormModal
          open={sessionModalOpen}
          onClose={() => setSessionModalOpen(false)}
          session={sessionBeingEdited}
          batchId={batch.id}
          allSessions={sessions}
          currentActorId={currentUserId}
          onSaved={() => {
            showToast(sessionBeingEdited ? 'Session updated' : 'Session scheduled');
            logEvent('Session', sessionBeingEdited ? `"${sessionBeingEdited.title}" was updated.` : 'A new session was scheduled.');
          }}
          onDeleted={() => showToast('Session deleted')}
        />
      )}

      <Modal open={editInfoOpen} onClose={() => setEditInfoOpen(false)} title="Edit Batch Info" maxWidth="sm">
        <div className="space-y-4">
          {editError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</div>}
          <div>
            <label htmlFor="admin-batch-edit-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input id="admin-batch-edit-name" type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
          </div>
          <div>
            <label htmlFor="admin-batch-edit-code" className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input id="admin-batch-edit-code" type="text" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
          </div>
          <div>
            <label htmlFor="admin-batch-edit-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="admin-batch-edit-status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Batch['status'] })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
              <option>Active</option>
              <option>Upcoming</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="admin-batch-edit-start" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input id="admin-batch-edit-start" type="date" value={editForm.startDateIso} onChange={(e) => setEditForm({ ...editForm, startDateIso: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-batch-edit-end" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input id="admin-batch-edit-end" type="date" value={editForm.endDateIso} onChange={(e) => setEditForm({ ...editForm, endDateIso: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Program, track, and training plan are set at creation and can't be changed here.</p>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={() => setEditInfoOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
          <SavingButton onClick={saveEditInfo} isSaving={editSaving} label="Save Changes" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" />
        </div>
      </Modal>
    </AuthenticatedDetailLayout>
  );
}
