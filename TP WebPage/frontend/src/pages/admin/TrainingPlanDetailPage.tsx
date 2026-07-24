import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import SavingButton from '../../components/SavingButton';
import StatCard from '../../components/StatCard';
import { useTrainingPlansStore } from '../../store/trainingPlansStore';
import { useBatchesStore } from '../../store/batchesStore';
import { useToastStore } from '../../store/toastStore';
import { useAuditLogStore } from '../../store/auditLogStore';
import { ROUTES } from '../../constants/routes';
import type { TrainingPlanAnnouncement, TrainingPlanAssignment, TrainingPlanResource, TrainingPlanSession } from '../../types/trainingPlan';
import AuthenticatedDetailLayout from '../../layouts/AuthenticatedDetailLayout';

function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const PLATFORM_OPTIONS: TrainingPlanSession['platform'][] = ['Google Meet', 'Microsoft Teams', 'Zoom', 'Other'];
const PRIORITY_OPTIONS: TrainingPlanAnnouncement['priority'][] = ['Normal', 'Important', 'Critical'];

interface SessionFormState {
  id: string | null;
  title: string;
  agenda: string;
  dayOffset: string;
  startTime: string;
  endTime: string;
  platform: TrainingPlanSession['platform'];
  order: string;
  feedbackFormUrl: string;
}

const EMPTY_SESSION_FORM: SessionFormState = {
  id: null,
  title: '',
  agenda: '',
  dayOffset: '0',
  startTime: '14:30',
  endTime: '16:30',
  platform: 'Google Meet',
  order: '1',
  feedbackFormUrl: ''
};

interface AssignmentFormState {
  id: string | null;
  title: string;
  agenda: string;
  description: string;
  dueDayOffset: string;
  relatedSessionId: string;
}

const EMPTY_ASSIGNMENT_FORM: AssignmentFormState = {
  id: null,
  title: '',
  agenda: '',
  description: '',
  dueDayOffset: '0',
  relatedSessionId: ''
};

interface ResourceFormState {
  id: string | null;
  title: string;
  category: string;
  url: string;
}

const EMPTY_RESOURCE_FORM: ResourceFormState = { id: null, title: '', category: '', url: '' };

interface AnnouncementFormState {
  id: string | null;
  title: string;
  message: string;
  priority: TrainingPlanAnnouncement['priority'];
}

const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormState = { id: null, title: '', message: '', priority: 'Normal' };

/**
 * Admin's full Training Plan editor — one page with everything: general info, the impacted-batch
 * count, and full CRUD (view/edit/reschedule/delete/add) over the plan's Sessions and Assignments,
 * plus Resources/Announcements. Editing here only ever touches the template — already-generated
 * batch schedules are untouched (batch schedules are copied once at batch-creation time).
 */
export default function TrainingPlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const {
    trainingPlans,
    planDetails,
    fetchTrainingPlans,
    fetchTrainingPlanDetail,
    updateTrainingPlan,
    addSession,
    editSession,
    removeSession,
    addAssignment,
    editAssignment,
    removeAssignment,
    addResource,
    editResource,
    removeResource,
    addAnnouncement,
    editAnnouncement,
    removeAnnouncement
  } = useTrainingPlansStore();
  const { batches, fetchBatches, createBatch } = useBatchesStore();
  const { showToast } = useToastStore();
  const { logEvent } = useAuditLogStore();

  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (trainingPlans.length === 0) fetchTrainingPlans();
  }, [trainingPlans.length, fetchTrainingPlans]);

  useEffect(() => {
    if (batches.length === 0) fetchBatches();
  }, [batches.length, fetchBatches]);

  useEffect(() => {
    if (!planId) return;
    fetchTrainingPlanDetail(planId).catch(() => setNotFound(true));
  }, [planId, fetchTrainingPlanDetail]);

  const detail = planId ? planDetails[planId] : undefined;
  const summary = trainingPlans.find((p) => p.id === planId);
  const impactedCount = useMemo(() => batches.filter((b) => b.trainingPlanId === planId).length, [batches, planId]);

  function goBack() {
    navigate(ROUTES.ADMIN, { state: { tab: 'trainingPlans' } });
  }

  // ---- general info ----
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [generalForm, setGeneralForm] = useState({
    name: '',
    description: '',
    durationMonths: 2,
    sessionStart: '14:30',
    sessionEnd: '16:30',
    assignmentStart: '09:30',
    assignmentDeadline: '23:59'
  });

  function openEditInfo() {
    if (!detail) return;
    setGeneralForm({
      name: detail.name,
      description: detail.description,
      durationMonths: detail.durationMonths,
      sessionStart: minutesToTimeInput(detail.defaultSessionStartMinute),
      sessionEnd: minutesToTimeInput(detail.defaultSessionEndMinute),
      assignmentStart: minutesToTimeInput(detail.defaultAssignmentStartMinute),
      assignmentDeadline: minutesToTimeInput(detail.defaultAssignmentDeadlineMinute)
    });
    setFormError(null);
    setEditInfoOpen(true);
  }

  async function saveGeneralEdit() {
    if (!planId) return;
    if (!generalForm.name.trim()) return setFormError('Name is required.');
    if (timeInputToMinutes(generalForm.sessionEnd) <= timeInputToMinutes(generalForm.sessionStart)) {
      return setFormError('Session end time must be after the start time.');
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateTrainingPlan(planId, {
        name: generalForm.name.trim(),
        description: generalForm.description.trim(),
        durationMonths: generalForm.durationMonths,
        defaultSessionStartMinute: timeInputToMinutes(generalForm.sessionStart),
        defaultSessionEndMinute: timeInputToMinutes(generalForm.sessionEnd),
        defaultAssignmentStartMinute: timeInputToMinutes(generalForm.assignmentStart),
        defaultAssignmentDeadlineMinute: timeInputToMinutes(generalForm.assignmentDeadline)
      });
      setEditInfoOpen(false);
      showToast('Training plan updated');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  // ---- assign to batch ----
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ name: '', poc: '', startDate: new Date().toISOString().slice(0, 10) });

  function openAssignToBatch() {
    setAssignForm({ name: '', poc: '', startDate: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setAssignOpen(true);
  }

  async function saveAssignToBatch() {
    if (!planId || !detail) return;
    if (!assignForm.name.trim()) return setFormError('Batch name is required.');
    if (!assignForm.startDate) return setFormError('Start date is required.');
    setSaving(true);
    setFormError(null);
    try {
      await createBatch({
        name: assignForm.name.trim(),
        trainingPlanId: planId,
        startDate: assignForm.startDate,
        poc: assignForm.poc.trim() || undefined
      });
      logEvent('Batch', `Created batch "${assignForm.name.trim()}" from "${detail.name}".`);
      showToast(`Batch "${assignForm.name.trim()}" created from ${detail.name}`);
      setAssignOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create batch.');
    } finally {
      setSaving(false);
    }
  }

  // ---- sessions ----
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(EMPTY_SESSION_FORM);
  const [sessionViewTarget, setSessionViewTarget] = useState<TrainingPlanSession | null>(null);
  const [sessionRescheduleTarget, setSessionRescheduleTarget] = useState<TrainingPlanSession | null>(null);
  const [rescheduleSessionForm, setRescheduleSessionForm] = useState({ dayOffset: '0', startTime: '14:30', endTime: '16:30' });

  function openAddSession() {
    setSessionForm(EMPTY_SESSION_FORM);
    setFormError(null);
    setSessionModalOpen(true);
  }
  function openEditSession(s: TrainingPlanSession) {
    setSessionForm({
      id: s.id,
      title: s.title,
      agenda: s.agenda,
      dayOffset: String(s.dayOffset),
      startTime: minutesToTimeInput(s.startMinute),
      endTime: minutesToTimeInput(s.endMinute),
      platform: s.platform,
      order: String(s.order),
      feedbackFormUrl: s.feedbackFormUrl ?? ''
    });
    setFormError(null);
    setSessionModalOpen(true);
  }
  function openRescheduleSession(s: TrainingPlanSession) {
    setRescheduleSessionForm({ dayOffset: String(s.dayOffset), startTime: minutesToTimeInput(s.startMinute), endTime: minutesToTimeInput(s.endMinute) });
    setFormError(null);
    setSessionRescheduleTarget(s);
  }
  async function saveSession() {
    if (!planId) return;
    const dayOffset = Number(sessionForm.dayOffset);
    const order = Number(sessionForm.order);
    const startMinute = timeInputToMinutes(sessionForm.startTime);
    const endMinute = timeInputToMinutes(sessionForm.endTime);

    if (!sessionForm.title.trim()) return setFormError('Title is required.');
    if (endMinute <= startMinute) return setFormError('End time must be after start time.');
    const dayTaken = detail?.sessions.some((s) => s.dayOffset === dayOffset && s.id !== sessionForm.id);
    if (dayTaken) return setFormError(`Day ${dayOffset} already has a session — pick a different day.`);

    setSaving(true);
    setFormError(null);
    try {
      const input = {
        title: sessionForm.title.trim(),
        agenda: sessionForm.agenda.trim(),
        dayOffset,
        startMinute,
        endMinute,
        platform: sessionForm.platform,
        order,
        feedbackFormUrl: sessionForm.feedbackFormUrl.trim() || undefined
      };
      if (sessionForm.id) {
        await editSession(planId, sessionForm.id, input);
      } else {
        await addSession(planId, input);
      }
      setSessionModalOpen(false);
      showToast(sessionForm.id ? 'Session updated' : 'Session added');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save session.');
    } finally {
      setSaving(false);
    }
  }
  async function saveSessionReschedule() {
    if (!planId || !sessionRescheduleTarget) return;
    const dayOffset = Number(rescheduleSessionForm.dayOffset);
    const startMinute = timeInputToMinutes(rescheduleSessionForm.startTime);
    const endMinute = timeInputToMinutes(rescheduleSessionForm.endTime);
    if (endMinute <= startMinute) return setFormError('End time must be after start time.');
    const dayTaken = detail?.sessions.some((s) => s.dayOffset === dayOffset && s.id !== sessionRescheduleTarget.id);
    if (dayTaken) return setFormError(`Day ${dayOffset} already has a session — pick a different day.`);

    setSaving(true);
    setFormError(null);
    try {
      await editSession(planId, sessionRescheduleTarget.id, { dayOffset, startMinute, endMinute });
      setSessionRescheduleTarget(null);
      showToast('Session rescheduled');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to reschedule session.');
    } finally {
      setSaving(false);
    }
  }
  async function confirmDeleteSession(s: TrainingPlanSession) {
    if (!planId) return;
    if (!window.confirm(`Delete "${s.title}" from this plan's template? Batches already created from this plan keep their copy — this only removes it from future batches.`)) return;
    await removeSession(planId, s.id);
    showToast('Session deleted');
  }

  // ---- assignments ----
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(EMPTY_ASSIGNMENT_FORM);
  const [assignmentViewTarget, setAssignmentViewTarget] = useState<TrainingPlanAssignment | null>(null);
  const [assignmentRescheduleTarget, setAssignmentRescheduleTarget] = useState<TrainingPlanAssignment | null>(null);
  const [rescheduleAssignmentDueDayOffset, setRescheduleAssignmentDueDayOffset] = useState('0');

  function openAddAssignment() {
    setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
    setFormError(null);
    setAssignmentModalOpen(true);
  }
  function openEditAssignment(a: TrainingPlanAssignment) {
    setAssignmentForm({
      id: a.id,
      title: a.title,
      agenda: a.agenda,
      description: a.description,
      dueDayOffset: String(a.dueDayOffset),
      relatedSessionId: a.relatedSessionId ?? ''
    });
    setFormError(null);
    setAssignmentModalOpen(true);
  }
  function openRescheduleAssignment(a: TrainingPlanAssignment) {
    setRescheduleAssignmentDueDayOffset(String(a.dueDayOffset));
    setFormError(null);
    setAssignmentRescheduleTarget(a);
  }
  async function saveAssignment() {
    if (!planId) return;
    if (!assignmentForm.title.trim()) return setFormError('Title is required.');
    setSaving(true);
    setFormError(null);
    try {
      const input = {
        title: assignmentForm.title.trim(),
        agenda: assignmentForm.agenda.trim(),
        description: assignmentForm.description.trim(),
        dueDayOffset: Number(assignmentForm.dueDayOffset),
        relatedSessionId: assignmentForm.relatedSessionId || undefined
      };
      if (assignmentForm.id) {
        await editAssignment(planId, assignmentForm.id, input);
      } else {
        await addAssignment(planId, input);
      }
      setAssignmentModalOpen(false);
      showToast(assignmentForm.id ? 'Assignment updated' : 'Assignment added');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save assignment.');
    } finally {
      setSaving(false);
    }
  }
  async function saveAssignmentReschedule() {
    if (!planId || !assignmentRescheduleTarget) return;
    setSaving(true);
    setFormError(null);
    try {
      await editAssignment(planId, assignmentRescheduleTarget.id, { dueDayOffset: Number(rescheduleAssignmentDueDayOffset) });
      setAssignmentRescheduleTarget(null);
      showToast('Assignment rescheduled');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to reschedule assignment.');
    } finally {
      setSaving(false);
    }
  }
  async function confirmDeleteAssignment(a: TrainingPlanAssignment) {
    if (!planId) return;
    if (!window.confirm(`Delete "${a.title}" from this plan's template?`)) return;
    await removeAssignment(planId, a.id);
    showToast('Assignment deleted');
  }

  // ---- resources ----
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>(EMPTY_RESOURCE_FORM);
  function openAddResource() {
    setResourceForm(EMPTY_RESOURCE_FORM);
    setFormError(null);
    setResourceModalOpen(true);
  }
  function openEditResource(r: TrainingPlanResource) {
    setResourceForm({ id: r.id, title: r.title, category: r.category, url: r.url });
    setFormError(null);
    setResourceModalOpen(true);
  }
  async function saveResource() {
    if (!planId) return;
    if (!resourceForm.title.trim() || !resourceForm.category.trim() || !resourceForm.url.trim()) {
      return setFormError('Title, category, and URL are all required.');
    }
    setSaving(true);
    setFormError(null);
    try {
      const input = { title: resourceForm.title.trim(), category: resourceForm.category.trim(), url: resourceForm.url.trim() };
      if (resourceForm.id) {
        await editResource(planId, resourceForm.id, input);
      } else {
        await addResource(planId, input);
      }
      setResourceModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save resource.');
    } finally {
      setSaving(false);
    }
  }
  async function confirmDeleteResource(r: TrainingPlanResource) {
    if (!planId) return;
    if (!window.confirm(`Delete "${r.title}" from this plan's template?`)) return;
    await removeResource(planId, r.id);
  }

  // ---- announcements ----
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(EMPTY_ANNOUNCEMENT_FORM);
  function openAddAnnouncement() {
    setAnnouncementForm(EMPTY_ANNOUNCEMENT_FORM);
    setFormError(null);
    setAnnouncementModalOpen(true);
  }
  function openEditAnnouncement(a: TrainingPlanAnnouncement) {
    setAnnouncementForm({ id: a.id, title: a.title, message: a.message, priority: a.priority });
    setFormError(null);
    setAnnouncementModalOpen(true);
  }
  async function saveAnnouncement() {
    if (!planId) return;
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      return setFormError('Title and message are both required.');
    }
    setSaving(true);
    setFormError(null);
    try {
      const input = { title: announcementForm.title.trim(), message: announcementForm.message.trim(), priority: announcementForm.priority };
      if (announcementForm.id) {
        await editAnnouncement(planId, announcementForm.id, input);
      } else {
        await addAnnouncement(planId, input);
      }
      setAnnouncementModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save announcement.');
    } finally {
      setSaving(false);
    }
  }
  async function confirmDeleteAnnouncement(a: TrainingPlanAnnouncement) {
    if (!planId) return;
    if (!window.confirm(`Delete "${a.title}" from this plan's template?`)) return;
    await removeAnnouncement(planId, a.id);
  }

  if (notFound) {
    return (
      <AuthenticatedDetailLayout
        role="admin"
        activeTab="trainingPlans"
        headerTitle="Training Plan"
        breadcrumbTrail={['Admin', 'Training Plans']}
        onBack={goBack}
        backLabel="Back to Training Plans"
      >
        <p className="text-sm text-gray-600">Training plan not found.</p>
      </AuthenticatedDetailLayout>
    );
  }

  return (
    <AuthenticatedDetailLayout
      role="admin"
      activeTab="trainingPlans"
      headerTitle={detail?.name ?? summary?.name ?? '…'}
      breadcrumbTrail={['Admin', 'Training Plans', detail?.name ?? summary?.name ?? '…']}
      onBack={goBack}
      backLabel="Back to Training Plans"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {!detail ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            {/* Overview */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{detail.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">{detail.code}</p>
                  <p className="text-sm text-gray-600 mt-3 max-w-2xl">
                    {detail.description || <span className="text-gray-400 italic">No description yet.</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={openAssignToBatch} className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                    Assign to Batch
                  </button>
                  <button onClick={openEditInfo} className="px-3 py-1.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Edit Plan Info
                  </button>
                </div>
              </div>

              {impactedCount > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">
                  {impactedCount} batch{impactedCount === 1 ? '' : 'es'} already generated from this plan. Editing the template below will
                  not change their existing schedules.
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <StatCard label="Duration" value={detail.durationMonths} valueSuffix={<span className="text-base font-medium text-gray-400"> mo</span>} />
                <StatCard label="Sessions" value={detail.sessions.length} />
                <StatCard label="Assignments" value={detail.assignments.length} />
                <StatCard label="Batches Using Plan" value={impactedCount} />
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">Sessions ({detail.sessions.length})</h2>
                <button onClick={openAddSession} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Session</button>
              </div>
              {detail.sessions.length === 0 ? (
                <EmptyState title="No sessions yet" icon="calendar" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {[...detail.sessions].sort((a, b) => a.order - b.order).map((s) => (
                    <div key={s.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 text-sm">
                          Day {s.dayOffset}: {s.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {minutesToTimeInput(s.startMinute)}–{minutesToTimeInput(s.endMinute)} • {s.platform}
                          {s.agenda && <span className="ml-2 text-gray-400">({s.agenda})</span>}
                          {s.feedbackFormUrl && <span className="ml-2 text-blue-600 font-medium">Feedback form attached</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs font-medium">
                        <button onClick={() => setSessionViewTarget(s)} className="text-gray-500 hover:text-gray-800">View</button>
                        <button onClick={() => openEditSession(s)} className="text-gray-500 hover:text-gray-800">Edit</button>
                        <button onClick={() => openRescheduleSession(s)} className="text-blue-600 hover:text-blue-800">Reschedule</button>
                        <button onClick={() => confirmDeleteSession(s)} className="text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assignments */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">Assignments ({detail.assignments.length})</h2>
                <button onClick={openAddAssignment} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Assignment</button>
              </div>
              {detail.assignments.length === 0 ? (
                <EmptyState title="No assignments yet" icon="inbox" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {[...detail.assignments].sort((a, b) => a.dueDayOffset - b.dueDayOffset).map((a) => (
                    <div key={a.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 text-sm">
                          Due day {a.dueDayOffset}: {a.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {a.agenda && <span className="font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{a.agenda}</span>}
                          {a.relatedSessionTitle && <span className="ml-2 text-gray-400">→ {a.relatedSessionTitle}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs font-medium">
                        <button onClick={() => setAssignmentViewTarget(a)} className="text-gray-500 hover:text-gray-800">View</button>
                        <button onClick={() => openEditAssignment(a)} className="text-gray-500 hover:text-gray-800">Edit</button>
                        <button onClick={() => openRescheduleAssignment(a)} className="text-blue-600 hover:text-blue-800">Reschedule</button>
                        <button onClick={() => confirmDeleteAssignment(a)} className="text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resources */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">Resources ({detail.resources.length})</h2>
                <button onClick={openAddResource} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Resource</button>
              </div>
              {detail.resources.length === 0 ? (
                <EmptyState title="No resources yet" icon="inbox" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {detail.resources.map((r) => (
                    <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                      <span className="text-sm">{r.title} <span className="text-xs text-gray-400">({r.category})</span></span>
                      <span className="flex items-center gap-3 shrink-0 text-xs font-medium">
                        <button onClick={() => openEditResource(r)} className="text-gray-500 hover:text-gray-800">Edit</button>
                        <button onClick={() => confirmDeleteResource(r)} className="text-red-500 hover:text-red-700">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Announcements */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">Default Announcements ({detail.announcements.length})</h2>
                <button onClick={openAddAnnouncement} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Announcement</button>
              </div>
              {detail.announcements.length === 0 ? (
                <EmptyState title="No announcements yet" icon="inbox" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {detail.announcements.map((a) => (
                    <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                      <span className="text-sm"><span className="font-medium">{a.title}</span> — <span className="text-gray-500">{a.message}</span></span>
                      <span className="flex items-center gap-3 shrink-0 text-xs font-medium">
                        <button onClick={() => openEditAnnouncement(a)} className="text-gray-500 hover:text-gray-800">Edit</button>
                        <button onClick={() => confirmDeleteAnnouncement(a)} className="text-red-500 hover:text-red-700">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Plan Info */}
      <Modal open={editInfoOpen} onClose={() => setEditInfoOpen(false)} title="Edit Plan Info" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={generalForm.name} onChange={(e) => setGeneralForm({ ...generalForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={generalForm.description} onChange={(e) => setGeneralForm({ ...generalForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none h-20 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
            <input type="number" min={1} value={generalForm.durationMonths} onChange={(e) => setGeneralForm({ ...generalForm, durationMonths: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default session start</label>
              <input type="time" value={generalForm.sessionStart} onChange={(e) => setGeneralForm({ ...generalForm, sessionStart: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default session end</label>
              <input type="time" value={generalForm.sessionEnd} onChange={(e) => setGeneralForm({ ...generalForm, sessionEnd: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default assignment opens</label>
              <input type="time" value={generalForm.assignmentStart} onChange={(e) => setGeneralForm({ ...generalForm, assignmentStart: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default assignment deadline</label>
              <input type="time" value={generalForm.assignmentDeadline} onChange={(e) => setGeneralForm({ ...generalForm, assignmentDeadline: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditInfoOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveGeneralEdit} isSaving={saving} label="Save" />
          </div>
        </div>
      </Modal>

      {/* Assign to Batch */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Training Plan to a New Batch" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Every batch belongs to exactly one Training Plan, set at creation. This creates a new batch from "{detail?.name}" — its full
            session/assignment schedule is generated automatically.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch name</label>
            <input type="text" value={assignForm.name} onChange={(e) => setAssignForm({ ...assignForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trainer / POC (optional)</label>
            <input type="text" value={assignForm.poc} onChange={(e) => setAssignForm({ ...assignForm, poc: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
            <input type="date" value={assignForm.startDate} onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAssignOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveAssignToBatch} isSaving={saving} label="Create Batch" />
          </div>
        </div>
      </Modal>

      {/* Add/Edit Session */}
      <Modal open={sessionModalOpen} onClose={() => setSessionModalOpen(false)} title={sessionForm.id ? 'Edit Session' : 'Add Session'} maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agenda</label>
            <input type="text" value={sessionForm.agenda} onChange={(e) => setSessionForm({ ...sessionForm, agenda: e.target.value })} placeholder="What this session covers" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day offset</label>
              <input type="number" min={0} value={sessionForm.dayOffset} onChange={(e) => setSessionForm({ ...sessionForm, dayOffset: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
              <input type="time" value={sessionForm.startTime} onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
              <input type="time" value={sessionForm.endTime} onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select value={sessionForm.platform} onChange={(e) => setSessionForm({ ...sessionForm, platform: e.target.value as TrainingPlanSession['platform'] })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500">
                {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <input type="number" min={0} value={sessionForm.order} onChange={(e) => setSessionForm({ ...sessionForm, order: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default feedback form URL (optional)</label>
            <input type="url" value={sessionForm.feedbackFormUrl} onChange={(e) => setSessionForm({ ...sessionForm, feedbackFormUrl: e.target.value })} placeholder="https://forms.gle/..." className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setSessionModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveSession} isSaving={saving} label="Save" />
          </div>
        </div>
      </Modal>

      {/* Reschedule Session */}
      <Modal open={sessionRescheduleTarget !== null} onClose={() => setSessionRescheduleTarget(null)} title={`Reschedule "${sessionRescheduleTarget?.title ?? ''}"`} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day offset</label>
            <input type="number" min={0} value={rescheduleSessionForm.dayOffset} onChange={(e) => setRescheduleSessionForm({ ...rescheduleSessionForm, dayOffset: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
              <input type="time" value={rescheduleSessionForm.startTime} onChange={(e) => setRescheduleSessionForm({ ...rescheduleSessionForm, startTime: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
              <input type="time" value={rescheduleSessionForm.endTime} onChange={(e) => setRescheduleSessionForm({ ...rescheduleSessionForm, endTime: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setSessionRescheduleTarget(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveSessionReschedule} isSaving={saving} label="Reschedule" />
          </div>
        </div>
      </Modal>

      {/* View Session */}
      <Modal open={sessionViewTarget !== null} onClose={() => setSessionViewTarget(null)} title={sessionViewTarget?.title ?? ''} maxWidth="sm">
        {sessionViewTarget && (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium text-gray-700">Agenda:</span> {sessionViewTarget.agenda || '—'}</p>
            <p><span className="font-medium text-gray-700">Day offset:</span> {sessionViewTarget.dayOffset}</p>
            <p><span className="font-medium text-gray-700">Time:</span> {minutesToTimeInput(sessionViewTarget.startMinute)}–{minutesToTimeInput(sessionViewTarget.endMinute)}</p>
            <p><span className="font-medium text-gray-700">Platform:</span> {sessionViewTarget.platform}</p>
            <p><span className="font-medium text-gray-700">Order:</span> {sessionViewTarget.order}</p>
            <p><span className="font-medium text-gray-700">Feedback form:</span> {sessionViewTarget.feedbackFormUrl || '—'}</p>
            <div className="flex justify-end pt-2">
              <button onClick={() => setSessionViewTarget(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Assignment */}
      <Modal open={assignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title={assignmentForm.id ? 'Edit Assignment' : 'Add Assignment'} maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agenda</label>
            <input type="text" value={assignmentForm.agenda} onChange={(e) => setAssignmentForm({ ...assignmentForm, agenda: e.target.value })} placeholder="What it's meant to achieve" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none h-20 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due day offset</label>
              <input type="number" min={0} value={assignmentForm.dueDayOffset} onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDayOffset: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Related session</label>
              <select value={assignmentForm.relatedSessionId} onChange={(e) => setAssignmentForm({ ...assignmentForm, relatedSessionId: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {detail?.sessions.map((s) => (
                  <option key={s.id} value={s.id}>Day {s.dayOffset}: {s.title}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAssignmentModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveAssignment} isSaving={saving} label="Save" />
          </div>
        </div>
      </Modal>

      {/* Reschedule Assignment */}
      <Modal open={assignmentRescheduleTarget !== null} onClose={() => setAssignmentRescheduleTarget(null)} title={`Reschedule "${assignmentRescheduleTarget?.title ?? ''}"`} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due day offset</label>
            <input type="number" min={0} value={rescheduleAssignmentDueDayOffset} onChange={(e) => setRescheduleAssignmentDueDayOffset(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAssignmentRescheduleTarget(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveAssignmentReschedule} isSaving={saving} label="Reschedule" />
          </div>
        </div>
      </Modal>

      {/* View Assignment */}
      <Modal open={assignmentViewTarget !== null} onClose={() => setAssignmentViewTarget(null)} title={assignmentViewTarget?.title ?? ''} maxWidth="sm">
        {assignmentViewTarget && (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium text-gray-700">Agenda:</span> {assignmentViewTarget.agenda || '—'}</p>
            <p><span className="font-medium text-gray-700">Description:</span> {assignmentViewTarget.description || '—'}</p>
            <p><span className="font-medium text-gray-700">Due day offset:</span> {assignmentViewTarget.dueDayOffset}</p>
            <p><span className="font-medium text-gray-700">Related session:</span> {assignmentViewTarget.relatedSessionTitle || '—'}</p>
            <div className="flex justify-end pt-2">
              <button onClick={() => setAssignmentViewTarget(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Resource */}
      <Modal open={resourceModalOpen} onClose={() => setResourceModalOpen(false)} title={resourceForm.id ? 'Edit Resource' : 'Add Resource'} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input type="text" value={resourceForm.category} onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input type="url" value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setResourceModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveResource} isSaving={saving} label="Save" />
          </div>
        </div>
      </Modal>

      {/* Add/Edit Announcement */}
      <Modal open={announcementModalOpen} onClose={() => setAnnouncementModalOpen(false)} title={announcementForm.id ? 'Edit Announcement' : 'Add Announcement'} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none h-20 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select value={announcementForm.priority} onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value as TrainingPlanAnnouncement['priority'] })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500">
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAnnouncementModalOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
            <SavingButton onClick={saveAnnouncement} isSaving={saving} label="Save" />
          </div>
        </div>
      </Modal>
    </AuthenticatedDetailLayout>
  );
}
