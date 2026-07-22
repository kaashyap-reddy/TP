import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Batch, useBatchesStore } from '../store/batchesStore';
import { effectiveStatus, useAssignmentsStore } from '../store/assignmentsStore';
import { assignmentAttachmentUrl } from '../services/api/assignmentService';
import { MeetingPlatform, Session, SessionStatus, useSessionsStore } from '../store/sessionsStore';
import { useTrainingPlansStore } from '../store/trainingPlansStore';
import TrainingPlansPanel from './admin/TrainingPlansPanel';
import SessionFeedbackCell from '../components/SessionFeedbackCell';
import { RESOURCE_CATEGORIES, useResourcesStore } from '../store/resourcesStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useToastStore } from '../store/toastStore';
import { Announcement, useAnnouncementsStore } from '../store/announcementsStore';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { logout } from '../services/api/authService';
import { useAuthStore } from '../store/authStore';
import { createInvite } from '../services/api/authService';
import { dateStrToIso, formatTimeRange, isoToDateStr, minutesToLabel, parseTimeRange } from '../utils/sessionTime';
import AdminDashboardHome from '../components/admin/AdminDashboardHome';
import { useFacilitatorAssignmentsStore } from '../store/facilitatorAssignmentsStore';
import FacilitatorTeamDrawer from '../components/admin/FacilitatorTeamDrawer';
import { useReassignmentRequestsStore } from '../store/reassignmentRequestsStore';
import TrainerAssignmentModal, { TrainerAssignmentResult } from '../components/admin/TrainerAssignmentModal';
import SessionsCalendarView from '../components/SessionsCalendarView';
import BatchMultiSelect from '../components/BatchMultiSelect';
import AssignmentBatchesCell from '../components/AssignmentBatchesCell';
import AssignmentTitleLink from '../components/AssignmentTitleLink';
import FileViewButton from '../components/FileViewButton';
import FeedbackCard from '../components/FeedbackCard';
import NotificationPanel from '../components/NotificationPanel';
import ProfileDropdown from '../components/ProfileDropdown';
import BatchRow from '../components/admin/BatchRow';
import { formatDate, formatDateTime, isRecentlyUpdated } from '../utils/dateUtils';
import { downloadTextFile } from '../utils/downloadFile';
import { average } from '../utils/mathUtils';
import GlobalSearch, { SearchItem } from '../components/GlobalSearch';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBaseline } from '../hooks/useBaseline';
import TrendIndicator from '../components/TrendIndicator';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Breadcrumbs from '../components/Breadcrumbs';
import { SkeletonCards, SkeletonRows } from '../components/Skeleton';
import Pagination, { paginate } from '../components/Pagination';
import BarChartComponent, { BarChartDatum } from '../components/BarChart';
import SavingButton from '../components/SavingButton';
import Table from '../components/Table';
import DashboardLayout from '../layouts/DashboardLayout';
import type { AdminTabId } from '../constants/navigation';
import { ADMIN_HEADER_TITLES, ADMIN_BRAND_LABEL, ADMIN_NAV_ITEMS, ADMIN_NAV_GROUPS } from '../constants/navigation';
import { PRIORITY_STYLES } from '../constants/announcements';
import { ROUTES } from '../constants/routes';

type TabId = AdminTabId;
const HEADER_TITLES = ADMIN_HEADER_TITLES;

const CHART_LABEL_MAP: Record<string, string> = {
  completion: 'Completion Rate',
  avgscore: 'Average Score',
  attendance: 'Attendance Rate',
  submissions: 'Assignment Submissions',
  feedback: 'Feedback Rating'
};

const CHART_BAR_COLORS = ['bg-blue-500', 'bg-blue-500', 'bg-indigo-500', 'bg-indigo-500', 'bg-purple-500', 'bg-purple-500', 'bg-pink-500', 'bg-pink-500'];

function getChartBarValue(batch: Batch, parameter: string): { percent: number; label: string } {
  if (parameter === 'feedback') {
    const rating = batch.feedbackRating;
    return { percent: rating !== null ? (rating / 5) * 100 : 0, label: rating !== null ? `${rating}/5` : '—' };
  }
  const raw =
    parameter === 'avgscore' ? batch.avgScore :
    parameter === 'attendance' ? batch.attendanceRate :
    parameter === 'submissions' ? batch.submissionRate :
    batch.completion;
  return { percent: raw ?? 0, label: raw !== null ? `${raw}%` : '—' };
}

const PROGRAM_COLORS: Record<string, string> = {
  BA: 'bg-blue-50/60 text-blue-800',
  'Data Engineering': 'bg-indigo-50/60 text-indigo-800',
  'AI ML': 'bg-purple-50/60 text-purple-800',
  'UI/UX': 'bg-pink-50/60 text-pink-800'
};

export type ReportType = 'attendance' | 'assignment' | 'performance' | 'feedback' | 'session' | 'resource' | 'audit';

interface ReportDef {
  id: ReportType;
  title: string;
  description: string;
}

const REPORT_DEFS: ReportDef[] = [
  { id: 'attendance', title: 'Attendance Report', description: 'Present/absent counts and attendance % across sessions.' },
  { id: 'assignment', title: 'Assignment Report', description: 'Status, deadlines, and submission breakdown per assignment.' },
  { id: 'performance', title: 'Performance Report', description: 'Batch-level average scores, completion, and attendance.' },
  { id: 'feedback', title: 'Feedback Report', description: 'Trainee feedback ratings and comments by facilitator.' },
  { id: 'session', title: 'Session Report', description: 'All sessions with status, platform, and scheduling detail.' },
  { id: 'resource', title: 'Resource Usage Report', description: 'Download counts and verification status per resource.' },
  { id: 'audit', title: 'Audit Report', description: 'Full system audit trail with user, module, and change detail.' }
];


export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { tab?: TabId; expandBatchId?: string } | null;
  const initialTab = locationState?.tab;
  const initialExpandBatchId = locationState?.expandBatchId;
  const clearSession = useAuthStore((s) => s.clearSession);
  const { batches, fetchBatches, updateBatch, deleteBatch, createBatch } = useBatchesStore();

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);
  const { assignments: facilitatorAssignments, fetchAssignments: fetchFacilitatorAssignments } = useFacilitatorAssignmentsStore();
  useEffect(() => {
    fetchFacilitatorAssignments();
  }, [fetchFacilitatorAssignments]);
  const [facilitatorDrawerBatch, setFacilitatorDrawerBatch] = useState<{ id: string; name: string } | null>(null);
  const { assignments, fetchAssignments, createAssignment, bulkDelete, bulkClose, bulkExtendDeadline, duplicateAssignment } = useAssignmentsStore();
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);
  const { sessions, fetchSessions, createSession, updateSession, assignSessionTrainer } = useSessionsStore();
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [assignTrainerTarget, setAssignTrainerTarget] = useState<Session[] | null>(null);
  const { requests: reassignmentRequests, fetchRequests: fetchReassignmentRequests, reviewRequest: reviewReassignmentRequest } = useReassignmentRequestsStore();
  useEffect(() => {
    fetchReassignmentRequests();
  }, [fetchReassignmentRequests]);
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  const { resources, fetchResources, addResource, verifyResource, deleteResource } = useResourcesStore();
  useEffect(() => {
    fetchResources();
  }, [fetchResources]);
  const { feedback, fetchFeedback, submitFeedback } = useFeedbackStore();
  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);
  const { trainingPlans, fetchTrainingPlans } = useTrainingPlansStore();
  useEffect(() => {
    fetchTrainingPlans();
  }, [fetchTrainingPlans]);
  const { entries: auditEntries, logEvent } = useAuditLogStore();
  const { showToast } = useToastStore();
  const { announcements, fetchAnnouncements, postAnnouncement } = useAnnouncementsStore();
  useEffect(() => {
    fetchAnnouncements(batches);
  }, [fetchAnnouncements, batches]);

  const dashboardLoadTime = useRef(new Date()).current;
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const baselineAvgScore = useBaseline(average(batches.map((b) => b.avgScore)));
  const baselineCompletion = useBaseline(average(batches.map((b) => b.completion)));

  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'analytics');
  const [tabLoading, setTabLoading] = useState(false);
  const isFirstTabRender = useRef(true);

  useEffect(() => {
    if (isFirstTabRender.current) {
      isFirstTabRender.current = false;
      return;
    }
    setTabLoading(true);
    const timer = setTimeout(() => setTabLoading(false), 350);
    return () => clearTimeout(timer);
  }, [activeTab]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  useClickOutside(notificationMenuRef, () => setNotificationOpen(false), notificationOpen);
  const [readLogIds, setReadLogIds] = useState<Set<string>>(new Set());
  const [chartParameter, setChartParameter] = useState('completion');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', batchId: '' });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  // Set instead of inviteLink when the backend didn't return a raw token (production — see
  // authService.createInvite) — there's no link to show, just confirmation an email will go out.
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');

  // Search filters
  const [batchSearch, setBatchSearch] = useState('');
  const [batchTypeFilter, setBatchTypeFilter] = useState('All Types');
  const [batchStatusFilter, setBatchStatusFilter] = useState('All Statuses');
  const [batchPocFilter, setBatchPocFilter] = useState('All POCs');
  const [batchMonthFilter, setBatchMonthFilter] = useState('All Months');
  const [batchMinCompletion, setBatchMinCompletion] = useState(0);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(initialExpandBatchId ?? null);
  const [batchSort, setBatchSort] = useState<'program' | 'name' | 'trainees' | 'score' | 'completion'>('program');
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState('All Categories');
  const [resourceSort, setResourceSort] = useState<'newest' | 'downloads' | 'name'>('newest');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [bulkDeleteResourcesConfirmOpen, setBulkDeleteResourcesConfirmOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((open) => !open);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('All Categories');
  const [announcementPriorityFilter, setAnnouncementPriorityFilter] = useState('All Priorities');
  const [feedbackSort, setFeedbackSort] = useState<'rating' | 'date'>('date');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [scheduledReports, setScheduledReports] = useState<Array<{ id: string; reportType: ReportType; frequency: string }>>([]);
  const [newScheduleType, setNewScheduleType] = useState<ReportType>('performance');
  const [newScheduleFrequency, setNewScheduleFrequency] = useState('Weekly');
  const [announcementAudienceFilter, setAnnouncementAudienceFilter] = useState('All Audiences');
  const [sessionBatchFilter, setSessionBatchFilter] = useState('All Batches');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('All Statuses');
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'calendar'>('list');
  const [attendanceEditingId, setAttendanceEditingId] = useState<string | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState({ present: '0', absent: '0' });
  const [logTypeFilter, setLogTypeFilter] = useState('All Event Types');
  const [logDateFilter, setLogDateFilter] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(1);

  // Batch management
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchTrainingPlanId, setNewBatchTrainingPlanId] = useState('');
  useEffect(() => {
    if (!newBatchTrainingPlanId && trainingPlans.length > 0) setNewBatchTrainingPlanId(trainingPlans[0].id);
  }, [trainingPlans, newBatchTrainingPlanId]);
  // Trainer/POC is optional — the org's workflow is just Name + Training Plan + Start Date.
  const [newBatchPoc, setNewBatchPoc] = useState('');
  const [newBatchStartDate, setNewBatchStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRowCount, setCsvRowCount] = useState<number | null>(null);

  const [batchManageModalOpen, setBatchManageModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const selectedBatch = batches.find((b) => b.id === selectedBatchId) ?? null;

  const [editBatchModalOpen, setEditBatchModalOpen] = useState(false);
  const [editBatchForm, setEditBatchForm] = useState({ poc: '', status: 'Active' as Batch['status'], avgScore: '', completion: '' });

  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' });

  const [deleteBatchConfirmOpen, setDeleteBatchConfirmOpen] = useState(false);

  // Assignments
  const [createAssignmentModalOpen, setCreateAssignmentModalOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ title: '', agenda: '', batchIds: [] as string[], sessionId: '', deadline: '', description: '' });
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentFormError, setAssignmentFormError] = useState('');
  const [assignmentFormSaving, setAssignmentFormSaving] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('All Statuses');
  const [assignmentBatchFilter, setAssignmentBatchFilter] = useState('All Batches');
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [extendDeadlineModalOpen, setExtendDeadlineModalOpen] = useState(false);
  const [extendDeadlineDraft, setExtendDeadlineDraft] = useState('');

  // Announcements
  const [createAnnouncementModalOpen, setCreateAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    priority: 'Normal' as Announcement['priority'],
    audience: 'All Users',
    message: '',
    pinned: false,
    scheduledFor: '',
    expiresAt: ''
  });
  const [announcementFormError, setAnnouncementFormError] = useState('');
  const [announcementFormSaving, setAnnouncementFormSaving] = useState(false);

  // Sessions
  const [createSessionModalOpen, setCreateSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState<{ title: string; batchId: string; date: string; time: string; platform: MeetingPlatform }>({
    title: '',
    batchId: batches[0]?.id ?? '',
    date: '',
    time: '',
    platform: 'Google Meet'
  });
  const [sessionFormError, setSessionFormError] = useState('');
  const [sessionFormSaving, setSessionFormSaving] = useState(false);
  const [sessionEditingId, setSessionEditingId] = useState<string | null>(null);
  const sessionEditPopoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(sessionEditPopoverRef, () => setSessionEditingId(null), sessionEditingId !== null);
  const [sessionEditDraft, setSessionEditDraft] = useState({ dateIso: '', startMin: 9 * 60, endMin: 10 * 60 });

  // Feedback
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<{ facilitator: string; batchId: string } | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ trainee: '', rating: '5', comment: '' });

  // Global Resources
  const [resourceUploadModalOpen, setResourceUploadModalOpen] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: '', category: 'PDF Guides', batchId: 'All' });
  const [resourceFormError, setResourceFormError] = useState('');
  const [resourceFormSaving, setResourceFormSaving] = useState(false);

  useEscapeKey(() => setBulkUploadModalOpen(false), bulkUploadModalOpen);
  useEscapeKey(() => setBatchManageModalOpen(false), batchManageModalOpen);
  useEscapeKey(() => setNotificationOpen(false), notificationOpen);
  useEscapeKey(() => setSessionEditingId(null), sessionEditingId !== null);

  function hiddenUnless(tab: TabId) {
    return activeTab === tab ? '' : 'hidden';
  }

  const unreadCount = auditEntries.filter((n) => !readLogIds.has(n.id)).length;

  function markNotificationRead(id: string) {
    setReadLogIds((prev) => new Set(prev).add(id));
  }

  function markAllNotificationsRead() {
    setReadLogIds((prev) => {
      const next = new Set(prev);
      auditEntries.forEach((n) => next.add(n.id));
      return next;
    });
  }

  function toggleNotificationMenu() {
    setNotificationOpen((open) => !open);
  }

  // ---- Batch management actions ----
  function openBatchManage(batchId: string) {
    setSelectedBatchId(batchId);
    setBatchManageModalOpen(true);
  }

  function openTraineeProfile(batchId: string, traineeName: string) {
    navigate(ROUTES.ADMIN_TRAINEE_PROFILE(traineeName), { state: { from: { batchId } } });
  }

  function openReschedule() {
    if (!selectedBatch) return;
    const existing = sessions.find((s) => s.batchId === selectedBatch.id);
    setRescheduleForm({ date: existing?.date ?? '', time: existing?.time ?? '' });
    setBatchManageModalOpen(false);
    setRescheduleModalOpen(true);
  }

  async function saveReschedule() {
    if (!selectedBatch) return;
    const existing = sessions.find((s) => s.batchId === selectedBatch.id);
    try {
      if (existing) {
        await updateSession(existing.id, { date: rescheduleForm.date, time: rescheduleForm.time });
      } else {
        await createSession({
          title: `${selectedBatch.name} Sync`,
          batchId: selectedBatch.id,
          date: rescheduleForm.date,
          time: rescheduleForm.time,
          link: '',
          platform: 'Google Meet',
          status: 'Upcoming'
        });
      }
      logEvent('Batch', `${selectedBatch.name} session rescheduled to ${rescheduleForm.date} ${rescheduleForm.time}.`);
      showToast('Session rescheduled');
      setRescheduleModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reschedule session.', 'error');
    }
  }

  function openEditBatch() {
    if (!selectedBatch) return;
    setEditBatchForm({
      poc: selectedBatch.poc,
      status: selectedBatch.status,
      avgScore: selectedBatch.avgScore !== null ? String(selectedBatch.avgScore) : '',
      completion: selectedBatch.completion !== null ? String(selectedBatch.completion) : ''
    });
    setBatchManageModalOpen(false);
    setEditBatchModalOpen(true);
  }

  async function saveEditBatch() {
    if (!selectedBatch) return;
    try {
      await updateBatch(selectedBatch.id, {
        poc: editBatchForm.poc,
        status: editBatchForm.status,
        avgScore: editBatchForm.avgScore.trim() === '' ? null : Number(editBatchForm.avgScore),
        completion: editBatchForm.completion.trim() === '' ? null : Number(editBatchForm.completion)
      });
      logEvent('Batch', `${selectedBatch.name} details were updated.`);
      showToast('Batch details updated');
      setEditBatchModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update batch.', 'error');
    }
  }

  function openDeleteBatch() {
    setBatchManageModalOpen(false);
    setDeleteBatchConfirmOpen(true);
  }

  async function confirmDeleteBatch() {
    if (!selectedBatch) return;
    try {
      await deleteBatch(selectedBatch.id);
      logEvent('Batch', `${selectedBatch.name} was deleted.`);
      showToast('Batch deleted');
      setDeleteBatchConfirmOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete batch.', 'error');
    }
  }

  async function sendInvite() {
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) {
      setInviteError('Name and email are required.');
      return;
    }
    setInviteError('');
    try {
      const { email, token } = await createInvite(inviteForm.email.trim());
      if (inviteForm.batchId) {
        const batch = batches.find((b) => b.id === inviteForm.batchId);
        if (batch) {
          await updateBatch(batch.id, { members: [...batch.members, inviteForm.name.trim()] });
        }
      }
      if (token) {
        setInviteLink(`${window.location.origin}/invite?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
      } else {
        setInviteSentTo(email);
      }
      logEvent('Invite', `Invite created for ${inviteForm.name} (${email}).`);
      showToast('Invite created');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Unable to create invite.');
    }
  }

  function closeInviteModal() {
    setInviteModalOpen(false);
    setInviteForm({ name: '', email: '', batchId: '' });
    setInviteLink(null);
    setInviteSentTo(null);
    setInviteError('');
  }

  function handleCsvFile(file: File | null) {
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      setCsvRowCount(Math.max(lines.length - 1, 0));
    };
    reader.readAsText(file);
  }

  async function executeOnboarding() {
    const rowCount = csvRowCount ?? 0;
    const plan = trainingPlans.find((p) => p.id === newBatchTrainingPlanId);
    const batch = await createBatch({
      name: newBatchName.trim() || `${plan?.name ?? 'Training Plan'} New Batch`,
      trainingPlanId: newBatchTrainingPlanId,
      poc: newBatchPoc || undefined,
      traineeCount: rowCount,
      startDate: newBatchStartDate
    });
    logEvent('Onboarding', `Training Plan automation generated "${batch.name}"'s full ~2-month schedule and dispatched ${rowCount} invitation emails.`);
    showToast(`Batch created — full schedule generated automatically.`);
    setBulkUploadModalOpen(false);
    setNewBatchName('');
    setNewBatchPoc('');
    setNewBatchStartDate(new Date().toISOString().slice(0, 10));
    setCsvFileName('');
    setCsvRowCount(null);
  }

  // ---- Assignments ----
  async function createNewAssignment() {
    if (!assignmentForm.title.trim() || assignmentForm.batchIds.length === 0) {
      setAssignmentFormError('Please enter a title and select at least one batch.');
      return;
    }
    setAssignmentFormError('');
    setAssignmentFormSaving(true);
    try {
      const assignment = await createAssignment({ ...assignmentForm, file: assignmentFile });
      logEvent('Assignment', `"${assignment.title}" was created for ${assignment.batches.length} batch(es).`);
      showToast('Assignment created');
      setCreateAssignmentModalOpen(false);
      setAssignmentForm({ title: '', agenda: '', batchIds: [], sessionId: '', deadline: '', description: '' });
      setAssignmentFile(null);
    } catch (err) {
      setAssignmentFormError(err instanceof Error ? err.message : 'Unable to create assignment.');
    } finally {
      setAssignmentFormSaving(false);
    }
  }

  // ---- Sessions ----
  async function createNewSession() {
    if (!sessionForm.title.trim() || !sessionForm.batchId || !sessionForm.date.trim() || !sessionForm.time.trim()) {
      setSessionFormError('Please fill in the title, date, and time.');
      return;
    }
    setSessionFormError('');
    setSessionFormSaving(true);
    try {
      const batch = batches.find((b) => b.id === sessionForm.batchId);
      await createSession({
        title: sessionForm.title,
        batchId: sessionForm.batchId,
        date: sessionForm.date,
        time: sessionForm.time,
        link: '',
        platform: sessionForm.platform,
        status: 'Upcoming'
      });
      logEvent('Session', `"${sessionForm.title}" was scheduled for ${batch?.name ?? sessionForm.batchId}.`);
      showToast('Session scheduled');
      setCreateSessionModalOpen(false);
      setSessionForm({ title: '', batchId: batches[0]?.id ?? '', date: '', time: '', platform: 'Google Meet' });
    } catch (err) {
      setSessionFormError(err instanceof Error ? err.message : 'Unable to schedule session.');
    } finally {
      setSessionFormSaving(false);
    }
  }

  function startEditSession(session: Session) {
    setSessionEditingId(session.id);
    const { start, end } = parseTimeRange(session.time);
    setSessionEditDraft({ dateIso: dateStrToIso(session.date), startMin: start, endMin: end });
  }

  async function saveSessionEdit(session: Session) {
    const date = isoToDateStr(sessionEditDraft.dateIso);
    const time = formatTimeRange(sessionEditDraft.startMin, sessionEditDraft.endMin);
    try {
      await updateSession(session.id, { date, time });
      logEvent('Session', `"${session.title}" timing updated to ${date} ${time}.`);
      showToast('Session timing updated');
      setSessionEditingId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update session.', 'error');
    }
  }

  function toggleSessionSelected(id: string) {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllSessions(visibleSessions: Session[]) {
    setSelectedSessionIds((prev) => (prev.size === visibleSessions.length && visibleSessions.length > 0 ? new Set() : new Set(visibleSessions.map((s) => s.id))));
  }

  /** Candidate trainers for the session(s) being assigned -- the union of the involved batches'
   * active facilitator teams, never "every facilitator in the org" (see Phase 5). */
  function trainerCandidatesFor(targetSessions: Session[]): { id: string; name: string }[] {
    const batchIds = new Set(targetSessions.map((s) => s.batchId));
    const seen = new Map<string, string>();
    for (const a of facilitatorAssignments) {
      if (batchIds.has(a.batchId) && a.status !== 'Removed') seen.set(a.facilitatorId, a.facilitatorName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }

  async function handleAssignTrainerSave(result: TrainerAssignmentResult) {
    if (!assignTrainerTarget) return;
    for (const s of assignTrainerTarget) {
      if (result.skipAlreadyAssigned && (s.primaryTrainerId || s.guestTrainer)) continue;
      await assignSessionTrainer(s.id, { primaryTrainerId: result.primaryTrainerId, guestTrainer: result.guestTrainer });
    }
    logEvent('Session', `Trainer assignment updated for ${assignTrainerTarget.length} session(s).`, { module: 'Sessions' });
    showToast(`Trainer updated for ${assignTrainerTarget.length} session(s)`);
    setSelectedSessionIds(new Set());
    setAssignTrainerTarget(null);
  }

  function startEditAttendance(session: Session) {
    setAttendanceEditingId(session.id);
    setAttendanceDraft({ present: String(session.presentCount ?? 0), absent: String(session.absentCount ?? 0) });
  }

  async function saveAttendance(session: Session) {
    const presentCount = Number(attendanceDraft.present) || 0;
    const absentCount = Number(attendanceDraft.absent) || 0;
    await updateSession(session.id, { presentCount, absentCount });
    logEvent('Session', `Attendance recorded for "${session.title}": ${presentCount} present, ${absentCount} absent.`, { module: 'Sessions' });
    showToast('Attendance saved');
    setAttendanceEditingId(null);
  }

  // ---- Feedback ----
  function openSubmitFeedback(facilitator: string, batchId: string) {
    setFeedbackTarget({ facilitator, batchId });
    setFeedbackForm({ trainee: '', rating: '5', comment: '' });
    setFeedbackModalOpen(true);
  }

  async function saveSubmitFeedback() {
    if (!feedbackTarget) return;
    try {
      await submitFeedback({
        trainee: feedbackForm.trainee.trim(),
        facilitator: feedbackTarget.facilitator,
        batchId: feedbackTarget.batchId,
        category: 'Trainer Feedback',
        rating: Number(feedbackForm.rating),
        comment: feedbackForm.comment,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      logEvent('Feedback', `New feedback submitted for ${feedbackTarget.facilitator}.`);
      showToast('Feedback submitted');
      setFeedbackModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit feedback.', 'error');
    }
  }

  // ---- Announcements ----
  async function postNewAnnouncement() {
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      setAnnouncementFormError('Please enter both a title and a message.');
      return;
    }
    setAnnouncementFormError('');
    setAnnouncementFormSaving(true);
    try {
      // A real Announcement row is scoped by batchId (null = global); the generic labels
      // ("All Users", "Facilitators Only", etc.) all mean global, only a specific batch's
      // name in the dropdown resolves to a real batchId.
      const batchId = batches.find((b) => b.name === announcementForm.audience)?.id ?? null;
      await postAnnouncement(
        {
          title: announcementForm.title,
          message: announcementForm.message,
          priority: announcementForm.priority,
          audience: announcementForm.audience,
          batchId,
          pinned: announcementForm.pinned,
          scheduledFor: announcementForm.scheduledFor || null,
          expiresAt: announcementForm.expiresAt || null
        },
        batches
      );
      logEvent('Announcement', `"${announcementForm.title}" was broadcast to ${announcementForm.audience}.`, { module: 'Announcements', newValue: announcementForm.title });
      showToast('Broadcasted to all users!');
      setCreateAnnouncementModalOpen(false);
      setAnnouncementForm({ title: '', priority: 'Normal', audience: 'All Users', message: '', pinned: false, scheduledFor: '', expiresAt: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post announcement.', 'error');
    } finally {
      setAnnouncementFormSaving(false);
    }
  }

  // ---- Reports ----
  function inRange(dateStr: string): boolean {
    if (!reportDateFrom && !reportDateTo) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    if (reportDateFrom && d < new Date(reportDateFrom)) return false;
    if (reportDateTo && d > new Date(reportDateTo)) return false;
    return true;
  }

  function buildReport(type: ReportType): { title: string; headers: string[]; rows: (string | number)[][]; chart: BarChartDatum[] } {
    switch (type) {
      case 'attendance': {
        const rows = sessions.filter((s) => inRange(s.date)).map((s) => {
          const batch = batches.find((b) => b.id === s.batchId);
          const total = (s.presentCount ?? 0) + (s.absentCount ?? 0);
          const pct = total > 0 ? Math.round(((s.presentCount ?? 0) / total) * 100) : 0;
          return [s.title, batch?.name ?? s.batchId, s.date, s.presentCount ?? 0, s.absentCount ?? 0, `${pct}%`];
        });
        const chart = sessions.filter((s) => inRange(s.date)).slice(0, 8).map((s) => {
          const total = (s.presentCount ?? 0) + (s.absentCount ?? 0);
          const pct = total > 0 ? Math.round(((s.presentCount ?? 0) / total) * 100) : 0;
          return { label: s.title, percent: pct, displayValue: `${pct}%`, color: 'bg-blue-500' };
        });
        return { title: 'Attendance Report', headers: ['Session', 'Batch', 'Date', 'Present', 'Absent', 'Attendance %'], rows, chart };
      }
      case 'assignment': {
        const rows = assignments.filter((a) => inRange(a.deadline)).map((a) => {
          const batch = batches.find((b) => b.id === a.batchId);
          const submitted = a.submissions.filter((s) => s.status === 'Completed').length;
          const late = a.submissions.filter((s) => s.status === 'Late').length;
          const pending = a.submissions.length - submitted - late;
          return [a.title, batch?.name ?? a.batchId, a.trainingPlanName ?? '—', formatDate(a.deadline), effectiveStatus(a), submitted, pending, late];
        });
        const chart = assignments.filter((a) => inRange(a.deadline)).slice(0, 8).map((a) => {
          const pct = a.submissions.length > 0 ? Math.round((a.submissions.filter((s) => s.status === 'Completed').length / a.submissions.length) * 100) : 0;
          return { label: a.title, percent: pct, displayValue: `${pct}%`, color: 'bg-green-500' };
        });
        return { title: 'Assignment Report', headers: ['Assignment', 'Batch', 'Training Plan', 'Deadline', 'Status', 'Submitted', 'Pending', 'Late'], rows, chart };
      }
      case 'performance': {
        const rows = batches.map((b) => [b.name, b.program, b.poc, b.avgScore ?? '—', `${b.completion ?? 0}%`, `${b.attendanceRate ?? 0}%`]);
        const chart = batches.map((b) => ({ label: b.name, percent: b.completion ?? 0, displayValue: b.completion !== null ? `${b.completion}%` : '—', color: 'bg-indigo-500' }));
        return { title: 'Performance Report', headers: ['Batch', 'Program', 'POC', 'Avg Score', 'Completion', 'Attendance'], rows, chart };
      }
      case 'feedback': {
        const rows = feedback.filter((f) => inRange(f.date)).map((f) => {
          const batch = batches.find((b) => b.id === f.batchId);
          return [f.trainee, f.facilitator, batch?.name ?? f.batchId, f.category, f.rating, f.date];
        });
        return { title: 'Feedback Report', headers: ['Trainee', 'Facilitator', 'Batch', 'Category', 'Rating', 'Date'], rows, chart: ratingDistribution };
      }
      case 'session': {
        const rows = sessions.filter((s) => inRange(s.date)).map((s) => {
          const batch = batches.find((b) => b.id === s.batchId);
          return [s.title, batch?.name ?? s.batchId, s.facilitator, s.date, s.time, s.status, s.platform];
        });
        const statuses: SessionStatus[] = ['Upcoming', 'Live', 'Completed', 'Cancelled', 'Rescheduled'];
        const chart = statuses.map((st) => {
          const count = sessions.filter((s) => s.status === st).length;
          const pct = sessions.length > 0 ? Math.round((count / sessions.length) * 100) : 0;
          return { label: st, percent: pct, displayValue: `${count}`, color: 'bg-purple-500' };
        });
        return { title: 'Session Report', headers: ['Session', 'Batch', 'Facilitator', 'Date', 'Time', 'Status', 'Platform'], rows, chart };
      }
      case 'resource': {
        const rows = resources.filter((r) => inRange(r.uploadedAt)).map((r) => [r.title, r.category, r.uploadedBy, r.downloadCount, r.verified ? 'Verified' : 'Pending', r.uploadedAt]);
        const maxDownloads = Math.max(1, ...resources.map((r) => r.downloadCount));
        const chart = resources.slice(0, 8).map((r) => ({ label: r.title, percent: Math.round((r.downloadCount / maxDownloads) * 100), displayValue: `${r.downloadCount}`, color: 'bg-amber-500' }));
        return { title: 'Resource Usage Report', headers: ['Resource', 'Category', 'Uploaded By', 'Downloads', 'Status', 'Uploaded At'], rows, chart };
      }
      case 'audit': {
        const rows = auditEntries.filter((e) => inRange(e.date)).map((e) => [e.date, e.time, e.type, e.user, e.module, e.message]);
        const eventTypes = Array.from(new Set(auditEntries.map((e) => e.type)));
        const chart = eventTypes.slice(0, 8).map((t) => {
          const count = auditEntries.filter((e) => e.type === t).length;
          const pct = auditEntries.length > 0 ? Math.round((count / auditEntries.length) * 100) : 0;
          return { label: t, percent: pct, displayValue: `${count}`, color: 'bg-gray-500' };
        });
        return { title: 'Audit Report', headers: ['Date', 'Time', 'Type', 'User', 'Module', 'Message'], rows, chart };
      }
    }
  }

  function exportReportCsv(type: ReportType) {
    const { title, headers, rows } = buildReport(type);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadTextFile(`${title.toLowerCase().replace(/\s+/g, '-')}.csv`, csv, 'text/csv;charset=utf-8;');
    logEvent('Report', `${title} exported as CSV.`, { module: 'Reports' });
    showToast('CSV downloaded');
  }

  function exportReportPdf(type: ReportType) {
    const { title, headers, rows, chart } = buildReport(type);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow pop-ups to export the PDF');
      return;
    }
    const rowsHtml = rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('');
    const chartHtml = chart
      .map(
        (d) =>
          `<div style="display:flex;align-items:center;margin-bottom:6px;">
            <span style="width:140px;font-size:11px;color:#555;text-align:right;margin-right:8px;">${d.label}</span>
            <div style="flex:1;background:#e5e7eb;border-radius:6px;height:14px;overflow:hidden;">
              <div style="width:${Math.min(Math.max(d.percent, 0), 100)}%;background:#3b82f6;height:14px;"></div>
            </div>
            <span style="width:50px;font-size:11px;font-weight:bold;margin-left:8px;">${d.displayValue}</span>
          </div>`
      )
      .join('');
    printWindow.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px;} th{background:#f3f4f6;}</style>
      </head><body>
      <h2>${title}</h2>
      <p style="font-size:12px;color:#888;">Generated ${new Date().toLocaleString()}${reportDateFrom || reportDateTo ? ` • Range: ${reportDateFrom || 'Any'} to ${reportDateTo || 'Any'}` : ''}</p>
      ${chart.length > 0 ? `<div style="margin-top:16px;">${chartHtml}</div>` : ''}
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    logEvent('Report', `${title} exported as PDF.`, { module: 'Reports' });
    showToast('Opening print dialog for PDF export');
  }

  function addScheduledReport() {
    if (!newScheduleType) return;
    setScheduledReports((prev) => [...prev, { id: `sched-${Date.now()}`, reportType: newScheduleType, frequency: newScheduleFrequency }]);
    logEvent('Report', `Scheduled ${REPORT_DEFS.find((r) => r.id === newScheduleType)?.title} to run ${newScheduleFrequency}.`, { module: 'Reports' });
    showToast('Scheduled report added');
  }

  function removeScheduledReport(id: string) {
    setScheduledReports((prev) => prev.filter((r) => r.id !== id));
  }

  // ---- Global Resources ----
  async function uploadResource(file: File | null) {
    if (!file) {
      setResourceFormError('Please choose a file to upload.');
      return;
    }
    setResourceFormError('');
    setResourceFormSaving(true);
    try {
      const title = resourceForm.title.trim() || file.name;
      const resource = await addResource({
        title,
        category: resourceForm.category,
        batchId: resourceForm.batchId,
        file
      });
      logEvent('Resource', `"${resource.title}" was uploaded and is pending verification.`);
      showToast('Resource uploaded — pending verification');
      setResourceUploadModalOpen(false);
      setResourceForm({ title: '', category: 'PDF Guides', batchId: 'All' });
    } catch (err) {
      setResourceFormError(err instanceof Error ? err.message : 'Unable to upload resource.');
    } finally {
      setResourceFormSaving(false);
    }
  }

  async function handleVerifyResource(id: string, title: string) {
    await verifyResource(id);
    logEvent('Resource', `"${title}" was verified and is now visible to trainees.`);
    showToast('Resource verified');
  }

  function toggleResourceSelected(id: string) {
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkVerifyResources() {
    await Promise.all(Array.from(selectedResourceIds).map((id) => verifyResource(id)));
    logEvent('Resource', `${selectedResourceIds.size} resource(s) verified.`, { module: 'Global Resources' });
    showToast(`${selectedResourceIds.size} resource(s) verified`);
    setSelectedResourceIds(new Set());
  }

  async function bulkDeleteResources() {
    await Promise.all(Array.from(selectedResourceIds).map((id) => deleteResource(id)));
    logEvent('Resource', `${selectedResourceIds.size} resource(s) deleted.`, { module: 'Global Resources' });
    showToast(`${selectedResourceIds.size} resource(s) deleted`);
    setSelectedResourceIds(new Set());
    setBulkDeleteResourcesConfirmOpen(false);
  }

  const pocOptions = Array.from(new Set(batches.map((b) => b.poc)));
  const startMonthOptions = Array.from(new Set(batches.map((b) => b.startMonth)));
  const filteredBatches = useMemo(
    () =>
      batches.filter((b) => {
        const q = batchSearch.trim().toLowerCase();
        const matchesSearch = q === '' || b.name.toLowerCase().includes(q) || b.poc.toLowerCase().includes(q) || b.program.toLowerCase().includes(q);
        const matchesType = batchTypeFilter === 'All Types' || b.program === batchTypeFilter;
        const matchesStatus = batchStatusFilter === 'All Statuses' || b.status === batchStatusFilter;
        const matchesPoc = batchPocFilter === 'All POCs' || b.poc === batchPocFilter;
        const matchesMonth = batchMonthFilter === 'All Months' || b.startMonth === batchMonthFilter;
        const matchesCompletion = b.completion === null || b.completion >= batchMinCompletion;
        return matchesSearch && matchesType && matchesStatus && matchesPoc && matchesMonth && matchesCompletion;
      }),
    [batches, batchSearch, batchTypeFilter, batchStatusFilter, batchPocFilter, batchMonthFilter, batchMinCompletion]
  );
  const programsInOrder = Array.from(new Set(filteredBatches.map((b) => b.program)));
  const sortedBatchesFlat = useMemo(
    () =>
      [...filteredBatches].sort((a, b) => {
        switch (batchSort) {
          case 'name': return a.name.localeCompare(b.name);
          case 'trainees': return b.traineeCount - a.traineeCount;
          case 'score': return (b.avgScore ?? -1) - (a.avgScore ?? -1);
          case 'completion': return (b.completion ?? -1) - (a.completion ?? -1);
          default: return 0;
        }
      }),
    [filteredBatches, batchSort]
  );

  function toggleBatchSelected(id: string) {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllBatches(visibleBatches: Batch[]) {
    setSelectedBatchIds((prev) =>
      prev.size === visibleBatches.length && visibleBatches.length > 0 ? new Set() : new Set(visibleBatches.map((b) => b.id))
    );
  }

  function exportSelectedBatchesCsv() {
    const selected = batches.filter((b) => selectedBatchIds.has(b.id));
    const header = 'Batch Name,Program,POC,Trainees,Avg Score,Completion,Status';
    const rows = selected.map((b) => [b.name, b.program, b.poc, b.traineeCount, b.avgScore ?? '', b.completion ?? '', b.status].join(','));
    downloadTextFile('selected-batches.csv', [header, ...rows].join('\n'), 'text/csv;charset=utf-8;');
    logEvent('Batch', `${selected.length} batch(es) exported as CSV.`, { module: 'Batch Management' });
    showToast(`${selected.length} batch(es) exported`);
  }

  async function bulkSetBatchStatus(status: Batch['status']) {
    await Promise.all(Array.from(selectedBatchIds).map((id) => updateBatch(id, { status })));
    logEvent('Batch', `${selectedBatchIds.size} batch(es) marked ${status}.`, { module: 'Batch Management', newValue: status });
    showToast(`${selectedBatchIds.size} batch(es) updated`);
    setSelectedBatchIds(new Set());
  }
  const filteredResources = resources
    .filter((r) => r.title.toLowerCase().includes(resourceSearch.trim().toLowerCase()))
    .filter((r) => resourceCategoryFilter === 'All Categories' || r.category === resourceCategoryFilter)
    .slice()
    .sort((a, b) => {
      if (resourceSort === 'downloads') return b.downloadCount - a.downloadCount;
      if (resourceSort === 'name') return a.title.localeCompare(b.title);
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });
  const filteredFeedback = feedback
    .filter((f) => {
      const q = feedbackSearch.trim().toLowerCase();
      const matchesSearch = q === '' || f.trainee.toLowerCase().includes(q) || f.facilitator.toLowerCase().includes(q);
      const matchesCategory = feedbackCategory === 'All Categories' || f.category === feedbackCategory;
      return matchesSearch && matchesCategory;
    })
    .slice()
    .sort((a, b) => (feedbackSort === 'rating' ? b.rating - a.rating : new Date(b.date).getTime() - new Date(a.date).getTime() || 0));

  const traineeToFacilitatorFeedback = filteredFeedback.filter((f) => f.direction === 'TraineeToFacilitator');
  const facilitatorToTraineeFeedback = filteredFeedback.filter((f) => f.direction !== 'TraineeToFacilitator');
  const feedbackAvgRating = feedback.length > 0 ? Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length) * 10) / 10 : null;
  const feedbackByFacilitator = Array.from(new Set(feedback.map((f) => f.facilitator))).map((name) => {
    const entries = feedback.filter((f) => f.facilitator === name);
    return { name, avg: entries.reduce((sum, f) => sum + f.rating, 0) / entries.length };
  });
  const topFacilitator = feedbackByFacilitator.slice().sort((a, b) => b.avg - a.avg)[0] ?? null;
  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => {
    const count = feedback.filter((f) => Math.round(f.rating) === star).length;
    return {
      label: `${star} ★`,
      percent: feedback.length > 0 ? (count / feedback.length) * 100 : 0,
      displayValue: `${count}`,
      color: 'bg-amber-400'
    };
  });
  function isNewFeedback(dateStr: string): boolean {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
  }
  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) => {
        const batch = batches.find((b) => b.id === s.batchId);
        const matchesBatch = sessionBatchFilter === 'All Batches' || batch?.name === sessionBatchFilter;
        const matchesStatus = sessionStatusFilter === 'All Statuses' || s.status === sessionStatusFilter;
        return matchesBatch && matchesStatus;
      }),
    [sessions, batches, sessionBatchFilter, sessionStatusFilter]
  );
  const auditEventTypes = Array.from(new Set(auditEntries.map((e) => e.type)));
  const filteredAuditEntries = useMemo(
    () =>
      auditEntries.filter((entry) => {
        const matchesType = logTypeFilter === 'All Event Types' || entry.type === logTypeFilter;
        const matchesDate = logDateFilter === '' || entry.date === logDateFilter;
        const q = logSearch.trim().toLowerCase();
        const matchesSearch = q === '' || entry.message.toLowerCase().includes(q) || entry.user.toLowerCase().includes(q) || entry.module.toLowerCase().includes(q);
        return matchesType && matchesDate && matchesSearch;
      }),
    [auditEntries, logTypeFilter, logDateFilter, logSearch]
  );
  const LOG_PAGE_SIZE = 8;
  const logPageCount = Math.max(1, Math.ceil(filteredAuditEntries.length / LOG_PAGE_SIZE));
  const pagedAuditEntries = paginate(filteredAuditEntries, logPage, LOG_PAGE_SIZE);
  const globalSearchItems: SearchItem[] = useMemo(() => {
    const facilitatorNames = Array.from(new Set(batches.map((b) => b.poc).filter(Boolean)));
    const traineeNames = Array.from(new Set(batches.flatMap((b) => b.members)));
    return [
      ...batches.map((b): SearchItem => ({ id: b.id, category: 'Batch', title: b.name, subtitle: `${b.poc} • ${b.status}` })),
      ...trainingPlans.map((p): SearchItem => ({ id: p.id, category: 'Training Plan', title: p.name, subtitle: `${p.durationMonths} month${p.durationMonths === 1 ? '' : 's'} • ${p.counts.batches} batches` })),
      ...assignments.map((a): SearchItem => ({ id: a.id, category: 'Assignment', title: a.title, subtitle: `Due ${formatDateTime(a.deadline)}` })),
      ...resources.map((r): SearchItem => ({ id: r.id, category: 'Resource', title: r.title, subtitle: r.category })),
      ...announcements.map((a): SearchItem => ({ id: a.id, category: 'Announcement', title: a.title, subtitle: a.audience })),
      ...sessions.map((s): SearchItem => ({ id: s.id, category: 'Session', title: s.title, subtitle: `${s.date} • ${s.time}` })),
      ...facilitatorNames.map((name): SearchItem => ({ id: name, category: 'Facilitator', title: name, subtitle: 'Facilitator / POC' })),
      ...traineeNames.map((name): SearchItem => ({ id: name, category: 'Trainee', title: name, subtitle: 'Trainee' }))
    ];
  }, [batches, trainingPlans, assignments, resources, announcements, sessions]);

  function handleGlobalSearchSelect(item: SearchItem) {
    if (item.category === 'Trainee') {
      navigate(ROUTES.ADMIN_TRAINEE_PROFILE(item.title));
      return;
    }
    if (item.category === 'Training Plan') {
      navigate(ROUTES.ADMIN_TRAINING_PLAN_DETAIL(item.id));
      return;
    }
    const tabMap: Record<string, TabId> = {
      Batch: 'batches',
      Assignment: 'assignments',
      Resource: 'resources',
      Announcement: 'announcements',
      Session: 'sessions',
      Facilitator: 'batches'
    };
    setActiveTab(tabMap[item.category] ?? 'analytics');
  }

  const globalAvgScore = average(batches.map((b) => b.avgScore));
  const globalCompletion = average(batches.map((b) => b.completion));

  const announcementAudiences = Array.from(new Set(announcements.map((a) => a.audience)));
  const filteredAnnouncements = useMemo(
    () =>
      announcements
        .filter((a) => announcementPriorityFilter === 'All Priorities' || a.priority === announcementPriorityFilter)
        .filter((a) => announcementAudienceFilter === 'All Audiences' || a.audience === announcementAudienceFilter)
        .slice()
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [announcements, announcementPriorityFilter, announcementAudienceFilter]
  );
  const totalAudienceReached = announcements.reduce((sum, a) => sum + a.audienceCount, 0);
  const totalRead = announcements.reduce((sum, a) => sum + a.readByCount, 0);
  const totalUnread = Math.max(0, totalAudienceReached - totalRead);

  const filteredAssignments = useMemo(
    () =>
      assignments.filter((a) => {
        const q = assignmentSearch.trim().toLowerCase();
        const matchesSearch = q === '' || a.title.toLowerCase().includes(q);
        const matchesStatus = assignmentStatusFilter === 'All Statuses' || effectiveStatus(a) === assignmentStatusFilter;
        const matchesBatch = assignmentBatchFilter === 'All Batches' || a.batches.some((b) => b.name === assignmentBatchFilter);
        return matchesSearch && matchesStatus && matchesBatch;
      }),
    [assignments, assignmentSearch, assignmentStatusFilter, assignmentBatchFilter]
  );
  const ASSIGNMENT_PAGE_SIZE = 6;
  const assignmentPageCount = Math.max(1, Math.ceil(filteredAssignments.length / ASSIGNMENT_PAGE_SIZE));
  const pagedAssignments = paginate(filteredAssignments, assignmentPage, ASSIGNMENT_PAGE_SIZE);

  function toggleAssignmentSelected(id: string) {
    setSelectedAssignmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllAssignments() {
    setSelectedAssignmentIds((prev) =>
      prev.size === pagedAssignments.length ? new Set() : new Set(pagedAssignments.map((a) => a.id))
    );
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedAssignmentIds);
    try {
      await bulkDelete(ids);
      logEvent('Assignment', `${ids.length} assignment(s) deleted in bulk.`, { module: 'Assignments' });
      showToast(`${ids.length} assignment(s) deleted`);
      setSelectedAssignmentIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete assignments.', 'error');
    }
  }

  async function handleBulkClose() {
    const ids = Array.from(selectedAssignmentIds);
    try {
      await bulkClose(ids);
      logEvent('Assignment', `${ids.length} assignment(s) closed in bulk.`, { module: 'Assignments', newValue: 'Closed' });
      showToast(`${ids.length} assignment(s) closed`);
      setSelectedAssignmentIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to close assignments.', 'error');
    }
  }

  function handleBulkReminder() {
    const ids = Array.from(selectedAssignmentIds);
    ids.forEach((id) => {
      const a = assignments.find((x) => x.id === id);
      if (a) logEvent('Reminder', `Reminder sent to all pending trainees for "${a.title}".`, { module: 'Assignments' });
    });
    showToast(`Reminder sent for ${ids.length} assignment(s)`);
    setSelectedAssignmentIds(new Set());
  }

  async function handleBulkDuplicate() {
    const ids = Array.from(selectedAssignmentIds);
    try {
      await Promise.all(ids.map((id) => duplicateAssignment(id)));
      logEvent('Assignment', `${ids.length} assignment(s) duplicated.`, { module: 'Assignments' });
      showToast(`${ids.length} assignment(s) duplicated`);
      setSelectedAssignmentIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to duplicate assignments.', 'error');
    }
  }

  function openExtendDeadlineModal() {
    setExtendDeadlineDraft('');
    setExtendDeadlineModalOpen(true);
  }

  async function confirmBulkExtendDeadline() {
    if (!extendDeadlineDraft) return;
    const ids = Array.from(selectedAssignmentIds);
    const formatted = isoToDateStr(extendDeadlineDraft);
    try {
      await bulkExtendDeadline(ids, formatted);
      logEvent('Assignment', `Deadline extended to ${formatted} for ${ids.length} assignment(s).`, { module: 'Assignments', newValue: formatted });
      showToast(`Deadline extended for ${ids.length} assignment(s)`);
      setSelectedAssignmentIds(new Set());
      setExtendDeadlineModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to extend deadlines.', 'error');
    }
  }

  return (
    <DashboardLayout
      brandLabel={ADMIN_BRAND_LABEL}
      navItems={ADMIN_NAV_ITEMS}
      navGroups={ADMIN_NAV_GROUPS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={() => setLogoutConfirmOpen(true)}
      headerTitle={HEADER_TITLES[activeTab]}
      headerTitleClassName="text-xl font-bold text-gray-800 tracking-tight"
      headerExtra={
        <button
          onClick={() => setGlobalSearchOpen(true)}
          aria-label="Global search"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
          Search
          <kbd className="text-[10px] font-bold border border-gray-300 rounded px-1">Ctrl K</kbd>
        </button>
      }
      headerRight={
        <>
          <div className="relative" ref={notificationMenuRef}>
            <button
              onClick={toggleNotificationMenu}
              className="relative text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={notificationOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{unreadCount}</span>
              )}
            </button>
            <div className={`${notificationOpen ? '' : 'hidden'} absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden`}>
              <NotificationPanel
                entries={auditEntries}
                readIds={readLogIds}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onViewAll={() => { setActiveTab('logs'); setNotificationOpen(false); }}
              />
            </div>
          </div>

          <ProfileDropdown
            role="admin"
            onSignOut={() => setLogoutConfirmOpen(true)}
            forceClose={notificationOpen}
            onOpenChange={(open) => { if (open) setNotificationOpen(false); }}
          />
        </>
      }
    >
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {tabLoading && (
            <div className="absolute inset-0 bg-slate-50 z-10 p-8 overflow-hidden">
              <SkeletonCards count={4} />
              <div className="mt-6 bg-white border border-gray-200 rounded-xl">
                <SkeletonRows rows={5} />
              </div>
            </div>
          )}

          {/* Admin Dashboard Home -- control-center landing page; detailed analytics live in Reports */}
          <div className={hiddenUnless('analytics')}>
            <AdminDashboardHome
              batches={batches}
              sessions={sessions}
              assignments={assignments}
              auditEntries={auditEntries}
              reassignmentRequests={reassignmentRequests}
              dashboardLoadTime={dashboardLoadTime}
              onNavigateTab={setActiveTab}
              onOpenCreateBatch={() => setBulkUploadModalOpen(true)}
              onOpenInviteTrainee={() => { setActiveTab('batches'); setInviteModalOpen(true); }}
              onOpenBatch={(batchId) => { setActiveTab('batches'); setExpandedBatchId(batchId); }}
            />
          </div>

          {/* Batch Management Tab */}
          <div className={hiddenUnless('batches')}>
            <Breadcrumbs trail={['Admin', 'Batch Management']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Batch Management Dashboard</h2>
              <div className="flex gap-3">
                <button onClick={() => setInviteModalOpen(true)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm hover:-translate-y-0.5">
                  + Invite Trainee
                </button>
                <button onClick={() => setBulkUploadModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-md hover:-translate-y-0.5">
                  + Create Batch
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Search batches..."
                  className="px-4 py-2 border border-gray-300 rounded-lg outline-none w-56 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <select value={batchTypeFilter} onChange={(e) => setBatchTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All Types</option>
                  {Array.from(new Set(batches.map((b) => b.program))).map((p) => <option key={p}>{p}</option>)}
                </select>
                <select value={batchStatusFilter} onChange={(e) => setBatchStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All Statuses</option>
                  <option>Active</option>
                  <option>Upcoming</option>
                </select>
                <select value={batchPocFilter} onChange={(e) => setBatchPocFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All POCs</option>
                  {pocOptions.map((p) => <option key={p}>{p}</option>)}
                </select>
                <select value={batchMonthFilter} onChange={(e) => setBatchMonthFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All Months</option>
                  {startMonthOptions.map((m) => <option key={m}>{m}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  Min Completion: <span className="font-bold text-gray-700">{batchMinCompletion}%</span>
                  <input type="range" min={0} max={100} step={5} value={batchMinCompletion} onChange={(e) => setBatchMinCompletion(Number(e.target.value))} className="accent-blue-600 w-28" />
                </label>
                <select value={batchSort} onChange={(e) => setBatchSort(e.target.value as typeof batchSort)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white ml-auto">
                  <option value="program">Group by Program</option>
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="trainees">Sort: Most Trainees</option>
                  <option value="score">Sort: Highest Score</option>
                  <option value="completion">Sort: Highest Completion</option>
                </select>
              </div>

              {selectedBatchIds.size > 0 && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{selectedBatchIds.size} selected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={exportSelectedBatchesCsv} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">Export Selected</button>
                    <button onClick={() => bulkSetBatchStatus('Active')} className="text-xs font-bold text-green-700 bg-white border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">Mark Active</button>
                    <button onClick={() => bulkSetBatchStatus('Upcoming')} className="text-xs font-bold text-amber-700 bg-white border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">Mark Upcoming</button>
                  </div>
                </div>
              )}

              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-4 font-bold w-8">
                      <input type="checkbox" checked={filteredBatches.length > 0 && selectedBatchIds.size === filteredBatches.length} onChange={() => toggleSelectAllBatches(filteredBatches)} aria-label="Select all batches" />
                    </th>
                    <th className="px-6 py-4 font-bold w-8"></th>
                    <th className="px-6 py-4 font-bold">Batch Name</th>
                    <th className="px-6 py-4 font-bold">Batch Type</th>
                    <th className="px-6 py-4 font-bold">Facilitator Team</th>
                    <th className="px-6 py-4 font-bold">Analytics summary</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredBatches.length === 0 && (
                    <tr><td colSpan={8}><EmptyState title="No batches match these filters" message="Try widening your search or resetting a filter." icon="search" /></td></tr>
                  )}
                  {batchSort !== 'program'
                    ? sortedBatchesFlat.map((b) => (
                        <BatchRow
                          key={b.id}
                          batch={b}
                          facilitatorTeam={facilitatorAssignments.filter((a) => a.batchId === b.id && a.status !== 'Removed')}
                          isExpanded={expandedBatchId === b.id}
                          isSelected={selectedBatchIds.has(b.id)}
                          onToggleExpand={() => setExpandedBatchId(expandedBatchId === b.id ? null : b.id)}
                          onToggleSelect={() => toggleBatchSelected(b.id)}
                          onManage={() => openBatchManage(b.id)}
                          onManageFacilitators={() => setFacilitatorDrawerBatch({ id: b.id, name: b.name })}
                          onSelectTrainee={(name) => openTraineeProfile(b.id, name)}
                        />
                      ))
                    : programsInOrder.map((program) => (
                        <Fragment key={program}>
                          <tr className={PROGRAM_COLORS[program] ?? 'bg-gray-50'}>
                            <td colSpan={8} className="px-6 py-3 font-bold text-xs uppercase tracking-wider">{program}</td>
                          </tr>
                          {filteredBatches
                            .filter((b) => b.program === program)
                            .map((b) => (
                              <BatchRow
                                key={b.id}
                                batch={b}
                                facilitatorTeam={facilitatorAssignments.filter((a) => a.batchId === b.id && a.status !== 'Removed')}
                                isExpanded={expandedBatchId === b.id}
                                isSelected={selectedBatchIds.has(b.id)}
                                onToggleExpand={() => setExpandedBatchId(expandedBatchId === b.id ? null : b.id)}
                                onToggleSelect={() => toggleBatchSelected(b.id)}
                                onManage={() => openBatchManage(b.id)}
                                onManageFacilitators={() => setFacilitatorDrawerBatch({ id: b.id, name: b.name })}
                                onSelectTrainee={(name) => openTraineeProfile(b.id, name)}
                              />
                            ))}
                        </Fragment>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Training Plans Tab */}
          <div className={hiddenUnless('trainingPlans')}>
            <TrainingPlansPanel />
          </div>

          {/* Automated Report Generation Tab */}
          <div className={hiddenUnless('reports')}>
            <Breadcrumbs trail={['Admin', 'Reports']} />

            <h2 className="text-lg font-bold tracking-tight text-gray-800 mb-3">Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Global Avg Score</div>
                <div className="text-3xl font-extrabold text-blue-600 mt-1">{globalAvgScore !== null ? `${globalAvgScore}%` : '—'}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Across {batches.length} active batches</span>
                  <TrendIndicator current={globalAvgScore} baseline={baselineAvgScore} />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Completion Rate</div>
                <div className="text-3xl font-extrabold text-gray-800 mt-1">{globalCompletion !== null ? `${globalCompletion}%` : '—'}</div>
                <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${globalCompletion ?? 0}%` }}></div>
                </div>
                <div className="mt-2">
                  <TrendIndicator current={globalCompletion} baseline={baselineCompletion} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-800">Batch Performance Comparison</h3>
                <select value={chartParameter} onChange={(e) => setChartParameter(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500">
                  <option value="completion">Completion Rate</option>
                  <option value="avgscore">Average Score</option>
                  <option value="attendance">Attendance Rate</option>
                  <option value="submissions">Assignment Submissions</option>
                  <option value="feedback">Feedback Rating</option>
                </select>
              </div>
              <div className="h-80 w-full bg-gray-50 border border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <div className="text-sm font-medium text-gray-500 mb-4">{CHART_LABEL_MAP[chartParameter]} - All {batches.length} Active Batches</div>
                <div className="w-full max-w-2xl space-y-3">
                  {batches.map((b, i) => {
                    const { percent, label } = getChartBarValue(b, chartParameter);
                    return (
                      <div className="flex items-center gap-3" key={b.id}>
                        <span className="w-36 text-xs text-gray-600 text-right">{b.name}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-4">
                          <div className={`${CHART_BAR_COLORS[i % CHART_BAR_COLORS.length]} h-4 rounded-full transition-all duration-300`} style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-12">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <h2 className="text-lg font-bold tracking-tight text-gray-800 mb-3">Automated Report Generation</h2>

            <div className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
              <div>
                <label htmlFor="admin-report-date-from" className="block text-xs font-bold text-gray-500 uppercase mb-1">From</label>
                <input id="admin-report-date-from" type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label htmlFor="admin-report-date-to" className="block text-xs font-bold text-gray-500 uppercase mb-1">To</label>
                <input id="admin-report-date-to" type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none" />
              </div>
              {(reportDateFrom || reportDateTo) && (
                <button onClick={() => { setReportDateFrom(''); setReportDateTo(''); }} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-2">Clear range</button>
              )}
              <span className="text-xs text-gray-400 ml-auto">Applies to reports with a date field (attendance, assignment, feedback, session, resource, audit).</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {REPORT_DEFS.map((def) => (
                <div key={def.id} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{def.title}</h3>
                  <p className="text-sm text-gray-500 mb-6">{def.description}</p>
                  <div className="flex gap-2">
                    <button onClick={() => exportReportCsv(def.id)} className="flex-1 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm">
                      CSV
                    </button>
                    <button onClick={() => exportReportPdf(def.id)} className="flex-1 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm">
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-1">Scheduled Reports</h3>
              <p className="text-xs text-gray-400 mb-4">Configuration only — this demo environment has no backend job runner, so scheduled reports are recorded here rather than actually firing.</p>
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <select value={newScheduleType} onChange={(e) => setNewScheduleType(e.target.value as ReportType)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                  {REPORT_DEFS.map((def) => <option key={def.id} value={def.id}>{def.title}</option>)}
                </select>
                <select value={newScheduleFrequency} onChange={(e) => setNewScheduleFrequency(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
                <button onClick={addScheduledReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm">+ Add Schedule</button>
              </div>
              {scheduledReports.length === 0 ? (
                <EmptyState title="No scheduled reports yet" icon="calendar" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {scheduledReports.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-700">{REPORT_DEFS.find((def) => def.id === s.reportType)?.title} — <span className="font-bold">{s.frequency}</span></span>
                      <button onClick={() => removeScheduledReport(s.id)} className="text-xs text-red-500 hover:underline font-medium">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Global Resource Library Tab */}
          <div className={hiddenUnless('resources')}>
            <Breadcrumbs trail={['Admin', 'Global Resources']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Global Content Repository</h2>
              <button onClick={() => setResourceUploadModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-md hover:-translate-y-0.5">
                + Upload Master Resource
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {['All Categories', ...RESOURCE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setResourceCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    resourceCategoryFilter === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm text-gray-500">Content posted here by Admin or Facilitators becomes visible to trainees once verified.</span>
                <div className="flex items-center gap-3">
                  <select value={resourceSort} onChange={(e) => setResourceSort(e.target.value as typeof resourceSort)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                    <option value="newest">Sort: Newest</option>
                    <option value="downloads">Sort: Most Downloads</option>
                    <option value="name">Sort: Name (A-Z)</option>
                  </select>
                  <input
                    type="text"
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    placeholder="Search resources..."
                    className="px-3 py-2 border border-gray-300 rounded-lg outline-none w-56 text-sm focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                  />
                </div>
              </div>
              {selectedResourceIds.size > 0 && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{selectedResourceIds.size} selected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={bulkVerifyResources} className="text-xs font-bold text-green-700 bg-white border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors">Verify Selected</button>
                    <button onClick={() => setBulkDeleteResourcesConfirmOpen(true)} className="text-xs font-bold text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Delete Selected</button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {filteredResources.length === 0 && (
                  <EmptyState title="No resources match these filters" icon="search" />
                )}
                {filteredResources.map((r) => (
                  <div key={r.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={selectedResourceIds.has(r.id)} onChange={() => toggleResourceSelected(r.id)} aria-label={`Select ${r.title}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        {r.title} <span className="text-gray-400 font-normal text-xs">{r.version}</span>
                        {isRecentlyUpdated(r.lastUpdated) && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">Recently Updated</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {r.category} • Uploaded by {r.uploadedBy} • Last updated {r.lastUpdated} • {r.fileSize}
                        {r.batchId !== 'All' && <> • {batches.find((b) => b.id === r.batchId)?.name ?? r.batchId}</>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{r.downloadCount} downloads</div>
                    </div>
                    {r.verified ? (
                      <StatusBadge status="Verified" />
                    ) : (
                      <button onClick={() => handleVerifyResource(r.id, r.title)} className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-full font-bold hover:bg-amber-100 flex-shrink-0">
                        Verify
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs & Global System Notifications */}
          <div className={hiddenUnless('logs')}>
            <Breadcrumbs trail={['Admin', 'Audit Logs']} />
            <h2 className="text-2xl font-bold tracking-tight mb-6">System Audit Logs & Notifications</h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4">
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search logs by message, user, module..."
                  className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white w-64"
                />
                <select value={logTypeFilter} onChange={(e) => setLogTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All Event Types</option>
                  {auditEventTypes.map((t) => <option key={t}>{t}</option>)}
                </select>
                <input type="date" value={logDateFilter} onChange={(e) => setLogDateFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Module</th>
                      <th className="px-4 py-3 font-medium">Message</th>
                      <th className="px-4 py-3 font-medium">Previous</th>
                      <th className="px-4 py-3 font-medium">New</th>
                      <th className="px-4 py-3 font-medium">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {pagedAuditEntries.length === 0 && (
                      <tr><td colSpan={8}><EmptyState title="No events match these filters" icon="search" /></td></tr>
                    )}
                    {pagedAuditEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{entry.time}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase whitespace-nowrap">{entry.type}</span></td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{entry.user}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{entry.module}</td>
                        <td className="px-4 py-3 text-gray-700 min-w-[240px]">{entry.message}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{entry.previousValue || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs font-medium">{entry.newValue || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{entry.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={logPage} pageCount={logPageCount} onPageChange={setLogPage} totalItems={filteredAuditEntries.length} pageSize={LOG_PAGE_SIZE} />
            </div>
          </div>

          {/* Assignments Tab (Global View) */}
          <div className={hiddenUnless('assignments')}>
            <Breadcrumbs trail={['Admin', 'Assignments']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Global Assignments Overview</h2>
              <button onClick={() => setCreateAssignmentModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-150">+ Create Assignment</button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  placeholder="Search assignments..."
                  className="px-4 py-2 border border-gray-300 rounded-lg outline-none w-56 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <select value={assignmentStatusFilter} onChange={(e) => setAssignmentStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All Statuses</option>
                  <option>Draft</option>
                  <option>Open</option>
                  <option>Closed</option>
                  <option>Overdue</option>
                </select>
                <select value={assignmentBatchFilter} onChange={(e) => setAssignmentBatchFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm bg-white">
                  <option>All Batches</option>
                  {batches.map((b) => <option key={b.id}>{b.name}</option>)}
                </select>
              </div>

              {selectedAssignmentIds.size > 0 && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{selectedAssignmentIds.size} selected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={handleBulkReminder} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">Send Reminder</button>
                    <button onClick={handleBulkDuplicate} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">Duplicate</button>
                    <button onClick={openExtendDeadlineModal} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">Extend Deadline</button>
                    <button onClick={handleBulkClose} className="text-xs font-bold text-amber-700 bg-white border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">Close</button>
                    <button onClick={handleBulkDelete} className="text-xs font-bold text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                  </div>
                </div>
              )}

              <Table
                columns={[
                  {
                    key: 'select',
                    className: 'w-8',
                    label: (
                      <input
                        type="checkbox"
                        checked={pagedAssignments.length > 0 && selectedAssignmentIds.size === pagedAssignments.length}
                        onChange={toggleSelectAllAssignments}
                        aria-label="Select all assignments"
                      />
                    )
                  },
                  { key: 'title', label: 'Title' },
                  { key: 'batch', label: 'Batch' },
                  { key: 'session', label: 'Related Session' },
                  { key: 'deadline', label: 'Deadline' },
                  { key: 'status', label: 'Status' },
                  { key: 'progress', label: 'Submitted / Pending / Late' },
                  { key: 'file', label: 'Assignment File' }
                ]}
              >
                {pagedAssignments.length === 0 && (
                  <tr><td colSpan={8}><EmptyState title="No assignments match these filters" icon="search" /></td></tr>
                )}
                {pagedAssignments.map((a) => {
                    const submitted = a.submissions.filter((s) => s.status === 'Completed').length;
                    const late = a.submissions.filter((s) => s.status === 'Late').length;
                    const pending = a.submissions.length - submitted - late;
                    const submittedPercent = a.submissions.length > 0 ? Math.round((submitted / a.submissions.length) * 100) : 0;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input type="checkbox" checked={selectedAssignmentIds.has(a.id)} onChange={() => toggleAssignmentSelected(a.id)} />
                        </td>
                        <td className="px-6 py-4 font-medium">
                          <AssignmentTitleLink id={a.id} title={a.title} />
                        </td>
                        <td className="px-6 py-4 text-gray-600"><AssignmentBatchesCell batches={a.batches} /></td>
                        <td className="px-6 py-4 text-gray-600">{a.sessionTitle ?? '—'}</td>
                        <td className="px-6 py-4 text-gray-600">{formatDate(a.deadline)}</td>
                        <td className="px-6 py-4"><StatusBadge status={effectiveStatus(a)} /></td>
                        <td className="px-6 py-4 w-56">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 font-bold mb-1">
                            <span className="text-green-600">{submitted} submitted</span>
                            <span className="text-gray-400">{pending} pending</span>
                            {late > 0 && <span className="text-red-500">{late} late</span>}
                          </div>
                          <ProgressBar value={submittedPercent} color="bg-green-500" size="sm" />
                        </td>
                        <td className="px-6 py-4">
                          <FileViewButton url={a.attachmentFilename ? assignmentAttachmentUrl(a.id) : null} fileName={a.attachmentFilename ?? undefined} label="View Assignment File" />
                        </td>
                      </tr>
                    );
                  })}
              </Table>
              <Pagination page={assignmentPage} pageCount={assignmentPageCount} onPageChange={setAssignmentPage} totalItems={filteredAssignments.length} pageSize={ASSIGNMENT_PAGE_SIZE} />
            </div>
          </div>

          {/* Announcements Tab (Global) */}
          <div className={hiddenUnless('announcements')}>
            <Breadcrumbs trail={['Admin', 'Announcements']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Global Announcements</h2>
              <button onClick={() => setCreateAnnouncementModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-150">+ Broadcast Announcement</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Audience Reached</div>
                <div className="text-2xl font-extrabold text-gray-800 mt-1">{totalAudienceReached}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Read</div>
                <div className="text-2xl font-extrabold text-green-600 mt-1">{totalRead}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unread</div>
                <div className="text-2xl font-extrabold text-amber-600 mt-1">{totalUnread}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <select value={announcementPriorityFilter} onChange={(e) => setAnnouncementPriorityFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                <option>All Priorities</option>
                <option>Critical</option>
                <option>Important</option>
                <option>Normal</option>
              </select>
              <select value={announcementAudienceFilter} onChange={(e) => setAnnouncementAudienceFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                <option>All Audiences</option>
                {announcementAudiences.map((aud) => <option key={aud}>{aud}</option>)}
              </select>
            </div>

            <div className="space-y-4">
              {filteredAnnouncements.length === 0 && (
                <EmptyState title="No announcements match these filters" icon="search" />
              )}
              {filteredAnnouncements.map((a) => (
                <div key={a.id} className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-l-4 hover:shadow-md transition-shadow duration-150 ${PRIORITY_STYLES[a.priority].border}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      {a.pinned && <span title="Pinned" className="text-amber-500">📌</span>}
                      {a.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${PRIORITY_STYLES[a.priority].badge}`}>{a.priority}</span>
                      <span className="text-sm text-gray-400 bg-gray-100 px-2 py-1 rounded">{a.audience}</span>
                    </div>
                  </div>
                  <p className="text-gray-600">{a.message}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-gray-400">
                      {a.author} • {a.date}
                      {a.scheduledFor && <span className="ml-2 text-blue-500">• Scheduled for {a.scheduledFor}</span>}
                      {a.expiresAt && <span className="ml-2 text-red-400">• Expires {a.expiresAt}</span>}
                    </div>
                    <div className="text-xs text-gray-400 font-medium">{a.readByCount}/{a.audienceCount} read</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions Tab (Global) */}
          <div className={hiddenUnless('sessions')}>
            <Breadcrumbs trail={['Admin', 'Sessions']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Sessions & Calendar — All Batches</h2>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
                  <button onClick={() => setSessionViewMode('list')} className={`px-3 py-2 transition-colors ${sessionViewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>List</button>
                  <button onClick={() => setSessionViewMode('calendar')} className={`px-3 py-2 transition-colors ${sessionViewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Calendar</button>
                </div>
                <button onClick={() => setCreateSessionModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-150">+ Schedule Session</button>
              </div>
            </div>

            {reassignmentRequests.filter((r) => r.status === 'Pending').length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
                <h3 className="font-bold text-gray-800 mb-3">Reassignment Requests</h3>
                <div className="space-y-2">
                  {reassignmentRequests
                    .filter((r) => r.status === 'Pending')
                    .map((r) => {
                      const rSession = sessions.find((s) => s.id === r.sessionId);
                      return (
                        <div key={r.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{rSession?.title ?? r.sessionId}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={async () => {
                                await reviewReassignmentRequest(r.id, { status: 'Approved' });
                                showToast('Reassignment approved');
                              }}
                              className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                await reviewReassignmentRequest(r.id, { status: 'Rejected' });
                                showToast('Reassignment rejected');
                              }}
                              className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {sessionViewMode === 'calendar' ? (
              <SessionsCalendarView />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex flex-wrap gap-4">
                  <select value={sessionBatchFilter} onChange={(e) => setSessionBatchFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                    <option>All Batches</option>
                    {batches.map((b) => <option key={b.id}>{b.name}</option>)}
                  </select>
                  <select value={sessionStatusFilter} onChange={(e) => setSessionStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                    <option>All Statuses</option>
                    <option>Upcoming</option>
                    <option>Live</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                    <option>Rescheduled</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
                    <input type="checkbox" checked={filteredSessions.length > 0 && selectedSessionIds.size === filteredSessions.length} onChange={() => toggleSelectAllSessions(filteredSessions)} />
                    Select all
                  </label>
                </div>
                {selectedSessionIds.size > 0 && (
                  <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-800">{selectedSessionIds.size} selected</span>
                    <button
                      onClick={() => setAssignTrainerTarget(filteredSessions.filter((s) => selectedSessionIds.has(s.id)))}
                      className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Assign Trainer to Selected
                    </button>
                  </div>
                )}
                <div className="p-6 space-y-4">
                  {filteredSessions.length === 0 && (
                    <EmptyState title="No sessions match these filters" icon="calendar" />
                  )}
                  {filteredSessions.map((s) => {
                    const batch = batches.find((b) => b.id === s.batchId);
                    const isEditing = sessionEditingId === s.id;
                    const isEditingAttendance = attendanceEditingId === s.id;
                    const totalAttendance = (s.presentCount ?? 0) + (s.absentCount ?? 0);
                    const attendancePercent = totalAttendance > 0 ? Math.round(((s.presentCount ?? 0) / totalAttendance) * 100) : null;
                    return (
                      <div key={s.id} className="flex items-start p-4 border rounded-lg hover:bg-gray-50 hover:shadow-sm transition-all duration-150">
                        <input
                          type="checkbox"
                          checked={selectedSessionIds.has(s.id)}
                          onChange={() => toggleSessionSelected(s.id)}
                          aria-label={`Select ${s.title}`}
                          className="mt-1.5 mr-3 flex-shrink-0"
                        />
                        <div className={`p-2 rounded-lg text-center border mr-4 w-16 flex-shrink-0 ${s.status === 'Upcoming' ? 'bg-blue-50 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
                          <div className={`text-xs font-bold uppercase ${s.status === 'Upcoming' ? 'text-blue-600' : 'text-gray-500'}`}>{s.date.split(' ')[0]}</div>
                          <div className={`text-xl font-bold ${s.status === 'Upcoming' ? 'text-blue-800' : 'text-gray-600'}`}>{s.date.split(' ')[1]?.replace(',', '')}</div>
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{s.title} — {batch?.name ?? s.batchId}</div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>{s.time}</span>
                            <span>•</span>
                            {s.guestTrainer ? (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">Guest: {s.guestTrainer.name}</span>
                            ) : s.primaryTrainerName ? (
                              <span>Trainer: {s.primaryTrainerName}</span>
                            ) : (
                              <span className="text-amber-600 font-bold">No trainer assigned</span>
                            )}
                            {s.coTrainers.length > 0 && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                +{s.coTrainers.length} co-trainer{s.coTrainers.length === 1 ? '' : 's'}
                              </span>
                            )}
                            {s.trainerAssignmentStatus === 'Reassignment Requested' && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">Reassignment requested</span>
                            )}
                            <button onClick={() => setAssignTrainerTarget([s])} className="text-[11px] font-bold text-blue-600 hover:underline">
                              Assign Trainer
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{s.platform}</span>
                            {s.link ? (
                              <a href={s.link} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-600 hover:underline">Join via {s.platform}</a>
                            ) : (
                              <span className="text-[11px] text-gray-400">No link set</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                            <span>Assignment: {s.relatedAssignmentTitle ?? '—'}</span>
                            <SessionFeedbackCell
                              session={s}
                              canManage
                              onChange={(sessionId, feedbackForm) => updateSession(sessionId, { feedbackForm })}
                            />
                          </div>
                          {(attendancePercent !== null || isEditingAttendance) && (
                            <div className="mt-2 flex items-center gap-3 text-xs">
                              {!isEditingAttendance ? (
                                <>
                                  <span className="text-green-600 font-bold">{s.presentCount ?? 0} present</span>
                                  <span className="text-red-500 font-bold">{s.absentCount ?? 0} absent</span>
                                  <span className="text-gray-500 font-bold">{attendancePercent}% attendance</span>
                                  <button
                                    onClick={() => startEditAttendance(s)}
                                    className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all duration-150 hover:scale-105 active:scale-95"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Edit
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                          {isEditingAttendance && (
                            <div className="mt-2 flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <div>
                                <label htmlFor="admin-attendance-present" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Present</label>
                                <input
                                  id="admin-attendance-present"
                                  type="number"
                                  min={0}
                                  value={attendanceDraft.present}
                                  onChange={(e) => setAttendanceDraft({ ...attendanceDraft, present: e.target.value })}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm outline-none"
                                />
                              </div>
                              <div>
                                <label htmlFor="admin-attendance-absent" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Absent</label>
                                <input
                                  id="admin-attendance-absent"
                                  type="number"
                                  min={0}
                                  value={attendanceDraft.absent}
                                  onChange={(e) => setAttendanceDraft({ ...attendanceDraft, absent: e.target.value })}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm outline-none"
                                />
                              </div>
                              <button onClick={() => setAttendanceEditingId(null)} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5">Cancel</button>
                              <button onClick={() => saveAttendance(s)} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Save</button>
                            </div>
                          )}
                          {attendancePercent === null && !isEditingAttendance && (
                            <button
                              onClick={() => startEditAttendance(s)}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-all duration-150 hover:scale-105 active:scale-95"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Record Attendance
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 relative" ref={isEditing ? sessionEditPopoverRef : undefined}>
                          <StatusBadge status={s.status} />
                          <button
                            onClick={() => (isEditing ? setSessionEditingId(null) : startEditSession(s))}
                            className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-150 hover:scale-105 active:scale-95 ${
                              isEditing ? 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100' : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
                            }`}
                          >
                            {isEditing ? 'Close' : 'Edit timing'}
                          </button>
                          {isEditing && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4">
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Reschedule Session</div>
                              <div className="space-y-4">
                                <div>
                                  <label htmlFor="admin-session-edit-date" className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                                  <input
                                    id="admin-session-edit-date"
                                    type="date"
                                    value={sessionEditDraft.dateIso}
                                    onChange={(e) => setSessionEditDraft({ ...sessionEditDraft, dateIso: e.target.value })}
                                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="flex justify-between text-[11px] font-bold text-gray-500 mb-1 uppercase">
                                    <span>Start Time</span>
                                    <span className="text-blue-600 normal-case">{minutesToLabel(sessionEditDraft.startMin)}</span>
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={1425}
                                    step={15}
                                    value={sessionEditDraft.startMin}
                                    onChange={(e) => setSessionEditDraft({ ...sessionEditDraft, startMin: Number(e.target.value) })}
                                    className="w-full accent-blue-600"
                                  />
                                </div>
                                <div>
                                  <label className="flex justify-between text-[11px] font-bold text-gray-500 mb-1 uppercase">
                                    <span>End Time</span>
                                    <span className="text-blue-600 normal-case">{minutesToLabel(sessionEditDraft.endMin)}</span>
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={1439}
                                    step={15}
                                    value={sessionEditDraft.endMin}
                                    onChange={(e) => setSessionEditDraft({ ...sessionEditDraft, endMin: Number(e.target.value) })}
                                    className="w-full accent-blue-600"
                                  />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button onClick={() => setSessionEditingId(null)} className="text-xs font-medium text-gray-500 px-2 py-1.5 hover:text-gray-700">Cancel</button>
                                  <button onClick={() => saveSessionEdit(s)} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-transform duration-150 hover:scale-105 active:scale-95">
                                    Save
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Feedback Forms Tab -- attach/edit each session's external feedback-form link */}
          <div className={hiddenUnless('feedbackForms')}>
            <Breadcrumbs trail={['Admin', 'Feedback Forms']} />
            <h2 className="text-2xl font-bold mb-1">Session Feedback Forms</h2>
            <p className="text-gray-500 text-sm mb-6">Attach, copy, and edit each session's external feedback-form link, and track submissions.</p>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-10">
              {sessions.length === 0 ? (
                <EmptyState title="No sessions yet" icon="calendar" />
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => {
                    const batch = batches.find((b) => b.id === s.batchId);
                    return (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{s.title}</div>
                          <div className="text-xs text-gray-400">{batch?.name ?? s.batchId}</div>
                        </div>
                        <SessionFeedbackCell session={s} canManage onChange={(sessionId, feedbackForm) => updateSession(sessionId, { feedbackForm })} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Feedback Overview Tab (Global Read View) -- ratings/reviews, unrelated to the form links above */}
          <div className={hiddenUnless('feedbackOverview')}>
            <Breadcrumbs trail={['Admin', 'Feedback Overview']} />
            <h2 className="text-2xl font-bold mb-1">Facilitator Performance Feedback</h2>
            <p className="text-gray-500 text-sm mb-6">Trainee/facilitator ratings and reviews across the org.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average Rating</div>
                <div className="text-3xl font-extrabold text-green-600 mt-1">{feedbackAvgRating !== null ? `${feedbackAvgRating}/5` : '—'}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Reviews</div>
                <div className="text-3xl font-extrabold text-gray-800 mt-1">{feedback.length}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Highest Rated Facilitator</div>
                <div className="text-xl font-extrabold text-gray-800 mt-1">{topFacilitator ? topFacilitator.name : '—'}</div>
                {topFacilitator && <div className="text-xs text-green-600 font-bold mt-0.5">{Math.round(topFacilitator.avg * 10) / 10}/5 avg</div>}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
              <h3 className="font-bold text-gray-800 mb-4">Rating Distribution</h3>
              <BarChartComponent data={ratingDistribution} labelWidth="w-14" />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4">
              <input
                type="text"
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
                placeholder="Search by trainee or facilitator..."
                className="px-3 py-2 border rounded-lg text-sm outline-none w-64"
              />
              <select value={feedbackCategory} onChange={(e) => setFeedbackCategory(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                <option>All Categories</option>
                <option>BA</option>
                <option>Data Engineering</option>
                <option>AI ML</option>
                <option>UI/UX</option>
                <option>Trainer Feedback</option>
              </select>
              <select value={feedbackSort} onChange={(e) => setFeedbackSort(e.target.value as 'rating' | 'date')} className="px-3 py-2 border rounded-lg text-sm outline-none bg-white">
                <option value="date">Sort: Newest First</option>
                <option value="rating">Sort: Highest Rating</option>
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-4">Trainee Feedback on Facilitators</h3>
                {traineeToFacilitatorFeedback.length === 0 ? (
                  <EmptyState title="No trainee feedback yet" icon="inbox" />
                ) : (
                  <div className="space-y-3">
                    {traineeToFacilitatorFeedback.map((f) => (
                      <FeedbackCard key={f.id} entry={f} isNew={isNewFeedback(f.date)} batchName={batches.find((b) => b.id === f.batchId)?.name} />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">Facilitator Feedback on Trainees</h3>
                </div>
                {facilitatorToTraineeFeedback.length === 0 ? (
                  <EmptyState title="No facilitator feedback yet" icon="inbox" />
                ) : (
                  <div className="space-y-3">
                    {facilitatorToTraineeFeedback.map((f) => (
                      <div key={f.id}>
                        <FeedbackCard entry={f} isNew={isNewFeedback(f.date)} batchName={batches.find((b) => b.id === f.batchId)?.name} />
                        <button
                          onClick={() => openSubmitFeedback(f.facilitator, f.batchId)}
                          className="mt-1.5 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Submit Feedback
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      {/* Modals */}

      {/* Create Batch (with optional CSV roster upload / auto-invitations) */}
      <div className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm ${bulkUploadModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setBulkUploadModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setBulkUploadModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-label="Close"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>

          <h2 className="text-2xl font-black text-gray-900 mb-2">Create Batch</h2>
          <p className="text-gray-500 text-sm mb-6">
            Name it, pick a Training Plan, and set a start date — the full ~2-month schedule (sessions, assignments, resources, announcements, feedback links) is generated automatically.
          </p>

          <div className="space-y-5">
            <div>
              <label htmlFor="admin-new-batch-name" className="block text-sm font-bold text-gray-700 mb-1">Batch Name</label>
              <input
                id="admin-new-batch-name"
                type="text"
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                placeholder="e.g. BA BTech - July 2026"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-new-batch-plan" className="block text-sm font-bold text-gray-700 mb-1">Training Plan</label>
                <select
                  id="admin-new-batch-plan"
                  value={newBatchTrainingPlanId}
                  onChange={(e) => setNewBatchTrainingPlanId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {trainingPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="admin-new-batch-start-date" className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                <input
                  id="admin-new-batch-start-date"
                  type="date"
                  value={newBatchStartDate}
                  onChange={(e) => setNewBatchStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>
            <div>
              <label htmlFor="admin-new-batch-poc" className="block text-sm font-bold text-gray-700 mb-1">Assign POC / Trainer (optional)</label>
              <select
                id="admin-new-batch-poc"
                value={newBatchPoc}
                onChange={(e) => setNewBatchPoc(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">No trainer assigned yet</option>
                {pocOptions.map((poc) => <option key={poc}>{poc}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">Upload Trainee Roster (CSV, optional)</label>
              <label className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors">
                <svg className="w-10 h-10 text-blue-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <span className="font-bold text-blue-700">{csvFileName || 'Click to upload CSV'}</span>
                <span className="text-xs text-gray-500 mt-1">{csvRowCount !== null ? `${csvRowCount} rows parsed` : 'Must contain columns: Name, Email'}</span>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={executeOnboarding}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transition-colors flex justify-center items-center"
            >
              Create Batch
            </button>
          </div>
        </div>
      </div>

      {/* Create Assignment Modal */}
      <Modal
        open={createAssignmentModalOpen}
        onClose={() => { setCreateAssignmentModalOpen(false); setAssignmentFormError(''); }}
        title="Create Global Assignment"
        maxWidth="md"
      >
          <div className="space-y-4">
            {assignmentFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignmentFormError}</div>
            )}
            <div>
              <label htmlFor="admin-assignment-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="admin-assignment-title" type="text" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="admin-assignment-agenda" className="block text-sm font-medium text-gray-700 mb-1">Agenda / Objective</label>
              <input
                id="admin-assignment-agenda"
                type="text"
                value={assignmentForm.agenda}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, agenda: e.target.value })}
                placeholder="e.g. Requirement Gathering, SQL Basics"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <BatchMultiSelect
              batches={batches}
              selectedIds={assignmentForm.batchIds}
              onChange={(batchIds) => setAssignmentForm({ ...assignmentForm, batchIds })}
            />
            <div>
              <label htmlFor="admin-assignment-session" className="block text-sm font-medium text-gray-700 mb-1">Related Session (optional)</label>
              <select id="admin-assignment-session" value={assignmentForm.sessionId} onChange={(e) => setAssignmentForm({ ...assignmentForm, sessionId: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option value="">No related session</option>
                {sessions.filter((s) => assignmentForm.batchIds.includes(s.batchId)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="admin-assignment-deadline" className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input id="admin-assignment-deadline" type="text" value={assignmentForm.deadline} onChange={(e) => setAssignmentForm({ ...assignmentForm, deadline: e.target.value })} placeholder="e.g. 20 Jul 2026" className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-assignment-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea id="admin-assignment-description" value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none h-20"></textarea>
            </div>
            <div>
              <label htmlFor="admin-assignment-file" className="block text-sm font-medium text-gray-700 mb-1">Instructions File (optional)</label>
              <input
                id="admin-assignment-file"
                type="file"
                onChange={(e) => setAssignmentFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
              />
              {assignmentFile && <p className="text-xs text-gray-500 mt-1">{assignmentFile.name}</p>}
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setCreateAssignmentModalOpen(false); setAssignmentFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={createNewAssignment} isSaving={assignmentFormSaving} label="Create" />
          </div>
      </Modal>

      {/* Bulk Extend Deadline Modal */}
      <Modal
        open={extendDeadlineModalOpen}
        onClose={() => setExtendDeadlineModalOpen(false)}
        title="Extend Deadline"
        subtitle={`New deadline for ${selectedAssignmentIds.size} selected assignment(s).`}
        maxWidth="sm"
      >
          <input
            type="date"
            value={extendDeadlineDraft}
            onChange={(e) => setExtendDeadlineDraft(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setExtendDeadlineModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={confirmBulkExtendDeadline} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Apply</button>
          </div>
      </Modal>

      {/* Broadcast Announcement Modal */}
      <Modal
        open={createAnnouncementModalOpen}
        onClose={() => { setCreateAnnouncementModalOpen(false); setAnnouncementFormError(''); }}
        title="Broadcast Announcement"
        maxWidth="md"
      >
          <div className="space-y-4">
            {announcementFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{announcementFormError}</div>
            )}
            <div>
              <label htmlFor="admin-announcement-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="admin-announcement-title" type="text" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-announcement-priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select id="admin-announcement-priority" value={announcementForm.priority} onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value as Announcement['priority'] })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option>Normal</option>
                <option>Important</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-announcement-audience" className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
              <select id="admin-announcement-audience" value={announcementForm.audience} onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option>All Users</option>
                <option>All Active Batches</option>
                {batches.map((b) => <option key={b.id}>{b.name}</option>)}
                <option>Facilitators Only</option>
                <option>Trainees Only</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-announcement-message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea id="admin-announcement-message" value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none h-24"></textarea>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-announcement-scheduled-for" className="block text-sm font-medium text-gray-700 mb-1">Schedule For (optional)</label>
                <input id="admin-announcement-scheduled-for" type="date" value={announcementForm.scheduledFor} onChange={(e) => setAnnouncementForm({ ...announcementForm, scheduledFor: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label htmlFor="admin-announcement-expires-at" className="block text-sm font-medium text-gray-700 mb-1">Expires On (optional)</label>
                <input id="admin-announcement-expires-at" type="date" value={announcementForm.expiresAt} onChange={(e) => setAnnouncementForm({ ...announcementForm, expiresAt: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={announcementForm.pinned} onChange={(e) => setAnnouncementForm({ ...announcementForm, pinned: e.target.checked })} />
              Pin this announcement to the top
            </label>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setCreateAnnouncementModalOpen(false); setAnnouncementFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={postNewAnnouncement} isSaving={announcementFormSaving} label="Post" className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700" />
          </div>
      </Modal>

      {/* Schedule Session Modal */}
      <Modal
        open={createSessionModalOpen}
        onClose={() => { setCreateSessionModalOpen(false); setSessionFormError(''); }}
        title="Schedule Session"
        maxWidth="md"
      >
          <div className="space-y-4">
            {sessionFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sessionFormError}</div>
            )}
            <div>
              <label htmlFor="admin-session-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="admin-session-title" type="text" value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-session-batch" className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select id="admin-session-batch" value={sessionForm.batchId} onChange={(e) => setSessionForm({ ...sessionForm, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-session-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input id="admin-session-date" type="text" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} placeholder="e.g. Jul 20, 2026" className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label htmlFor="admin-session-time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input id="admin-session-time" type="text" value={sessionForm.time} onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })} placeholder="e.g. 10:00 AM - 11:00 AM" className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
            <div>
              <label htmlFor="admin-session-platform" className="block text-sm font-medium text-gray-700 mb-1">Meeting Platform</label>
              <select id="admin-session-platform" value={sessionForm.platform} onChange={(e) => setSessionForm({ ...sessionForm, platform: e.target.value as MeetingPlatform })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option>Google Meet</option>
                <option>Microsoft Teams</option>
                <option>Zoom</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setCreateSessionModalOpen(false); setSessionFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={createNewSession} isSaving={sessionFormSaving} label="Schedule" />
          </div>
      </Modal>

      {/* Batch Manage Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${batchManageModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setBatchManageModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Manage Batch</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedBatch?.name}</p>
            </div>
            <button onClick={() => setBatchManageModalOpen(false)} className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-3">
            <button onClick={openReschedule} className="w-full text-left px-4 py-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100">Reschedule batch session</button>
            <button onClick={openEditBatch} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50">Edit batch details</button>
            <button onClick={openDeleteBatch} className="w-full text-left px-4 py-3 rounded-lg border border-red-100 bg-red-50 text-red-700 font-bold hover:bg-red-100">Delete batch record</button>
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      <Modal open={rescheduleModalOpen} onClose={() => setRescheduleModalOpen(false)} title="Reschedule Batch Session" maxWidth="sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-reschedule-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input id="admin-reschedule-date" type="text" value={rescheduleForm.date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} placeholder="e.g. Jul 20, 2026" className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-reschedule-time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input id="admin-reschedule-time" type="text" value={rescheduleForm.time} onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })} placeholder="e.g. 10:00 AM - 11:00 AM" className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setRescheduleModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={saveReschedule} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Save</button>
          </div>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal open={editBatchModalOpen} onClose={() => setEditBatchModalOpen(false)} title="Edit Batch Details" maxWidth="sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-edit-batch-poc" className="block text-sm font-medium text-gray-700 mb-1">POC</label>
              <input id="admin-edit-batch-poc" type="text" value={editBatchForm.poc} onChange={(e) => setEditBatchForm({ ...editBatchForm, poc: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-edit-batch-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select id="admin-edit-batch-status" value={editBatchForm.status} onChange={(e) => setEditBatchForm({ ...editBatchForm, status: e.target.value as Batch['status'] })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option>Active</option>
                <option>Upcoming</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-edit-batch-avg-score" className="block text-sm font-medium text-gray-700 mb-1">Avg Score (%)</label>
                <input id="admin-edit-batch-avg-score" type="number" value={editBatchForm.avgScore} onChange={(e) => setEditBatchForm({ ...editBatchForm, avgScore: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label htmlFor="admin-edit-batch-completion" className="block text-sm font-medium text-gray-700 mb-1">Completion (%)</label>
                <input id="admin-edit-batch-completion" type="number" value={editBatchForm.completion} onChange={(e) => setEditBatchForm({ ...editBatchForm, completion: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setEditBatchModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={saveEditBatch} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Save</button>
          </div>
      </Modal>

      {/* Submit Feedback Modal */}
      <Modal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title="Submit Trainer Feedback"
        subtitle={`Rating: ${feedbackTarget?.facilitator}`}
        maxWidth="sm"
      >
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-feedback-trainee" className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input id="admin-feedback-trainee" type="text" value={feedbackForm.trainee} onChange={(e) => setFeedbackForm({ ...feedbackForm, trainee: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-feedback-rating" className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
              <input id="admin-feedback-rating" type="number" min={1} max={5} value={feedbackForm.rating} onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="admin-feedback-comment" className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea id="admin-feedback-comment" value={feedbackForm.comment} onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none h-20"></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setFeedbackModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={saveSubmitFeedback} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Submit</button>
          </div>
      </Modal>

      {/* Resource Upload Modal */}
      <Modal
        open={resourceUploadModalOpen}
        onClose={() => { setResourceUploadModalOpen(false); setResourceFormError(''); }}
        title="Upload Master Resource"
        maxWidth="sm"
      >
          <div className="space-y-4">
            {resourceFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resourceFormError}</div>
            )}
            <div>
              <label htmlFor="admin-resource-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="admin-resource-title" type="text" value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" placeholder="Leave blank to use file name" />
              <p className="text-xs text-gray-400 mt-1">Leave blank to use the uploaded file's name.</p>
            </div>
            <div>
              <label htmlFor="admin-resource-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select id="admin-resource-category" value={resourceForm.category} onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option>PDF Guides</option>
                <option>Presentations</option>
                <option>Video Recordings</option>
              </select>
            </div>
            <div>
              <label htmlFor="admin-resource-batch" className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select id="admin-resource-batch" value={resourceForm.batchId} onChange={(e) => setResourceForm({ ...resourceForm, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                <option value="All">All Batches</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="admin-resource-file" className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                id="admin-resource-file"
                type="file"
                onChange={(e) => uploadResource(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 border rounded-lg outline-none file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setResourceUploadModalOpen(false); setResourceFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={() => uploadResource(null)} isSaving={resourceFormSaving} label="Upload" />
          </div>
      </Modal>

      <ConfirmDialog
        open={bulkDeleteResourcesConfirmOpen}
        title="Delete selected resources?"
        message={`This will permanently remove ${selectedResourceIds.size} resource(s). This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={bulkDeleteResources}
        onCancel={() => setBulkDeleteResourcesConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteBatchConfirmOpen}
        title="Delete batch record?"
        message={`This will permanently remove ${selectedBatch?.name ?? 'this batch'} from Batch Management. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteBatch}
        onCancel={() => setDeleteBatchConfirmOpen(false)}
      />

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        danger
        onConfirm={() => {
          logout().finally(() => {
            clearSession();
            navigate(ROUTES.LOGIN);
          });
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      {/* Invite Trainee Modal */}
      <Modal open={inviteModalOpen} onClose={closeInviteModal} title="Invite Trainee" maxWidth="sm">
          {!inviteLink && !inviteSentTo ? (
            <>
              <div className="space-y-4">
                {inviteError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</div>
                )}
                <div>
                  <label htmlFor="admin-invite-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input id="admin-invite-name" type="text" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                </div>
                <div>
                  <label htmlFor="admin-invite-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input id="admin-invite-email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" placeholder="trainee@company.com" />
                </div>
                <div>
                  <label htmlFor="admin-invite-batch" className="block text-sm font-medium text-gray-700 mb-1">Add to Batch (optional)</label>
                  <select id="admin-invite-batch" value={inviteForm.batchId} onChange={(e) => setInviteForm({ ...inviteForm, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                    <option value="">No batch</option>
                    {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={closeInviteModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button onClick={sendInvite} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Create Invite</button>
              </div>
            </>
          ) : inviteSentTo ? (
            <>
              <p className="text-sm text-gray-600 mb-4">An invite email will be sent to <span className="font-medium text-gray-800">{inviteSentTo}</span> to activate their account.</p>
              <div className="flex justify-end">
                <button onClick={closeInviteModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Done</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">Share this link with the trainee to activate their account:</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono break-all mb-4">{inviteLink}</div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(inviteLink!);
                    showToast('Invite link copied');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Copy Link
                </button>
                <button onClick={closeInviteModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Done</button>
              </div>
            </>
          )}
      </Modal>

      <GlobalSearch
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        items={globalSearchItems}
        onSelect={handleGlobalSearchSelect}
      />

      {facilitatorDrawerBatch && (
        <FacilitatorTeamDrawer
          open={!!facilitatorDrawerBatch}
          onClose={() => setFacilitatorDrawerBatch(null)}
          batchId={facilitatorDrawerBatch.id}
          batchName={facilitatorDrawerBatch.name}
        />
      )}

      {assignTrainerTarget && (
        <TrainerAssignmentModal
          open={!!assignTrainerTarget}
          onClose={() => setAssignTrainerTarget(null)}
          targetSessions={assignTrainerTarget}
          candidates={trainerCandidatesFor(assignTrainerTarget)}
          allSessions={sessions}
          onSave={handleAssignTrainerSave}
        />
      )}
    </DashboardLayout>
  );
}
