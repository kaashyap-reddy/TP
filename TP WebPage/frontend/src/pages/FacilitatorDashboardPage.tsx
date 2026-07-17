import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBatchesStore } from '../store/batchesStore';
import { effectiveStatus, SubmissionStatus, useAssignmentsStore } from '../store/assignmentsStore';
import { MeetingPlatform, Session, useSessionsStore } from '../store/sessionsStore';
import { useResourcesStore } from '../store/resourcesStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useToastStore } from '../store/toastStore';
import { Announcement, useAnnouncementsStore } from '../store/announcementsStore';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/authStore';
import { logout } from '../services/api/authService';
import { assignmentAttachmentUrl } from '../services/api/assignmentService';
import { findUserEmailByName } from '../services/api/userService';
import * as sessionFeedbackService from '../services/api/sessionFeedbackService';
import { dateStrToIso, formatTimeRange, isoToDateStr, minutesToLabel, parseTimeRange } from '../utils/sessionTime';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useNotifications } from '../hooks/useNotifications';
import { downloadTextFile } from '../utils/downloadFile';
import TrendIndicator from '../components/TrendIndicator';
import { average } from '../utils/mathUtils';
import EmptyState from '../components/EmptyState';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import Pagination, { paginate } from '../components/Pagination';
import Breadcrumbs from '../components/Breadcrumbs';
import NotificationPanel from '../components/NotificationPanel';
import ProfileDropdown from '../components/ProfileDropdown';
import SavingButton from '../components/SavingButton';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import Table from '../components/Table';
import BatchMultiSelect from '../components/BatchMultiSelect';
import AssignmentBatchesCell from '../components/AssignmentBatchesCell';
import AssignmentTitleLink from '../components/AssignmentTitleLink';
import FileViewButton from '../components/FileViewButton';
import FeedbackCard from '../components/FeedbackCard';
import SessionFeedbackCell from '../components/SessionFeedbackCell';
import SessionsCalendarView from '../components/SessionsCalendarView';
import DashboardLayout from '../layouts/DashboardLayout';
import type { FacilitatorTabId } from '../constants/navigation';
import { FACILITATOR_HEADER_TITLES, FACILITATOR_BRAND_LABEL, FACILITATOR_NAV_ITEMS } from '../constants/navigation';
import { PRIORITY_STYLES } from '../constants/announcements';
import { ROUTES } from '../constants/routes';
import { facilitatorTraineeProfileNavArgs } from '../utils/facilitatorProfileNav';

type TabId = FacilitatorTabId;
const HEADER_TITLES = FACILITATOR_HEADER_TITLES;

function resourceIconStyle(category: string) {
  switch (category) {
    case 'PDF Guides':
      return 'bg-red-100 text-red-600';
    case 'Video Recordings':
      return 'bg-purple-100 text-purple-600';
    case 'Presentations':
      return 'bg-blue-100 text-blue-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

const FACILITATOR_NAME = 'Junaid Mohammed';

export default function FacilitatorDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (location.state as { tab?: TabId } | null)?.tab;

  const { id: currentUserId, displayName, clearSession } = useAuthStore();

  const batches = useBatchesStore((s) => s.batches);
  const fetchBatches = useBatchesStore((s) => s.fetchBatches);
  useEffect(() => {
    if (currentUserId) fetchBatches({ facilitatorId: currentUserId });
  }, [fetchBatches, currentUserId]);
  const assignments = useAssignmentsStore((s) => s.assignments);
  const fetchAssignments = useAssignmentsStore((s) => s.fetchAssignments);
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);
  const createAssignment = useAssignmentsStore((s) => s.createAssignment);
  const updateSubmission = useAssignmentsStore((s) => s.updateSubmission);
  const bulkDeleteAssignments = useAssignmentsStore((s) => s.bulkDelete);
  const bulkCloseAssignments = useAssignmentsStore((s) => s.bulkClose);
  const bulkExtendAssignmentDeadline = useAssignmentsStore((s) => s.bulkExtendDeadline);
  const duplicateAssignment = useAssignmentsStore((s) => s.duplicateAssignment);
  const sessions = useSessionsStore((s) => s.sessions);
  const fetchSessions = useSessionsStore((s) => s.fetchSessions);
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  const createSession = useSessionsStore((s) => s.createSession);
  const updateSession = useSessionsStore((s) => s.updateSession);
  const resources = useResourcesStore((s) => s.resources);
  const fetchResources = useResourcesStore((s) => s.fetchResources);
  useEffect(() => {
    fetchResources();
  }, [fetchResources]);
  const addResource = useResourcesStore((s) => s.addResource);
  const verifyResource = useResourcesStore((s) => s.verifyResource);
  const feedback = useFeedbackStore((s) => s.feedback);
  const fetchFeedback = useFeedbackStore((s) => s.fetchFeedback);
  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);
  const submitFeedback = useFeedbackStore((s) => s.submitFeedback);
  const auditEntries = useAuditLogStore((s) => s.entries);
  const logEvent = useAuditLogStore((s) => s.logEvent);
  const showToast = useToastStore((s) => s.showToast);
  const announcements = useAnnouncementsStore((s) => s.announcements);
  const fetchAnnouncements = useAnnouncementsStore((s) => s.fetchAnnouncements);
  const markAnnouncementRead = useAnnouncementsStore((s) => s.markRead);
  const postAnnouncement = useAnnouncementsStore((s) => s.postAnnouncement);
  useEffect(() => {
    fetchAnnouncements(batches);
  }, [fetchAnnouncements, batches]);

  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'dashboard');
  const markedAnnouncementsReadRef = useRef<Set<string>>(new Set());
  const [quickGradeTarget, setQuickGradeTarget] = useState<{ assignmentId: string; traineeName: string } | null>(null);
  const [quickGradeScore, setQuickGradeScore] = useState('');
  const [quickGradeStatus, setQuickGradeStatus] = useState<SubmissionStatus>('Completed');

  useEffect(() => {
    if (activeTab !== 'announcements') return;
    announcements.forEach((a) => {
      if (!markedAnnouncementsReadRef.current.has(a.id)) {
        markedAnnouncementsReadRef.current.add(a.id);
        markAnnouncementRead(a.id);
      }
    });
  }, [activeTab, announcements, markAnnouncementRead]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { readLogIds, unreadCount, markNotificationRead, markAllNotificationsRead } = useNotifications(auditEntries);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [traineeSearch, setTraineeSearch] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('All Statuses');
  const [assignmentBatchFilter, setAssignmentBatchFilter] = useState('All Batches');
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [extendDeadlineModalOpen, setExtendDeadlineModalOpen] = useState(false);
  const [extendDeadlineDraft, setExtendDeadlineDraft] = useState('');
  const [resourceCategory, setResourceCategory] = useState('All Files');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackSelectedTrainee, setFeedbackSelectedTrainee] = useState<{ name: string; batchId: string } | null>(null);

  // Quick Action menu
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const quickActionMenuRef = useRef<HTMLDivElement>(null);
  const sessionEditPopoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(notificationMenuRef, () => setNotificationOpen(false), notificationOpen);
  useClickOutside(quickActionMenuRef, () => setQuickActionOpen(false), quickActionOpen);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<Announcement['priority']>('Normal');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementFormError, setAnnouncementFormError] = useState('');
  const [announcementFormSaving, setAnnouncementFormSaving] = useState(false);

  // Sessions tab state
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionBatchId, setNewSessionBatchId] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('');
  const [newSessionLink, setNewSessionLink] = useState('');
  const [newSessionPlatform, setNewSessionPlatform] = useState<MeetingPlatform>('Google Meet');
  const [sessionFormError, setSessionFormError] = useState('');
  const [sessionFormSaving, setSessionFormSaving] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  useClickOutside(sessionEditPopoverRef, () => setEditingSessionId(null), editingSessionId !== null);
  const [editDateIso, setEditDateIso] = useState('');
  const [editStartMin, setEditStartMin] = useState(9 * 60);
  const [editEndMin, setEditEndMin] = useState(10 * 60);
  const [attendanceEditingId, setAttendanceEditingId] = useState<string | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState({ present: '0', absent: '0' });
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'calendar'>('list');

  // Assignments tab state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentAgenda, setNewAssignmentAgenda] = useState('');
  const [newAssignmentBatchIds, setNewAssignmentBatchIds] = useState<string[]>([]);
  const [newAssignmentFile, setNewAssignmentFile] = useState<File | null>(null);
  const [newAssignmentDeadline, setNewAssignmentDeadline] = useState('');
  const [newAssignmentDescription, setNewAssignmentDescription] = useState('');
  const [assignmentFormError, setAssignmentFormError] = useState('');
  const [assignmentFormSaving, setAssignmentFormSaving] = useState(false);

  // Resources tab state
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceCategory, setNewResourceCategory] = useState('PDF Guides');
  const [newResourceBatchId, setNewResourceBatchId] = useState('All');
  const [newResourceFile, setNewResourceFile] = useState<File | null>(null);

  // Feedback tab state
  const [feedbackCategory, setFeedbackCategory] = useState('Technical Skills');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');

  useEscapeKey(() => setQuickActionOpen(false), quickActionOpen);
  useEscapeKey(() => setNotificationOpen(false), notificationOpen);

  function hiddenUnless(tab: TabId) {
    return activeTab === tab ? '' : 'hidden';
  }

  // Assignments belong to a Training Plan, not an individual facilitator (see the schema change) —
  // scope to "my assignments" via this facilitator's own batches (batches is already scoped by
  // fetchBatches({ facilitatorId }) above) instead of a facilitator-name match.
  const facilitatorAssignments = useMemo(() => {
    const myBatchIds = new Set(batches.map((b) => b.id));
    return assignments.filter((a) => a.batches.some((b) => myBatchIds.has(b.id)));
  }, [assignments, batches]);
  const facilitatorFeedback = useMemo(
    () =>
      feedback.filter((f) => f.facilitator === FACILITATOR_NAME).filter((f) => {
        const q = feedbackSearch.trim().toLowerCase();
        return q === '' || f.trainee.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      }),
    [feedback, feedbackSearch]
  );
  // Batches are already scoped to this facilitator by the fetchBatches({ facilitatorId }) call above.
  const aimlBatch = batches[0];
  const filteredResources = useMemo(
    () =>
      resources.filter((r) => {
        const matchesSearch = r.title.toLowerCase().includes(resourceSearch.trim().toLowerCase());
        const matchesCategory = resourceCategory === 'All Files' || r.category === resourceCategory;
        return matchesSearch && matchesCategory;
      }),
    [resources, resourceSearch, resourceCategory]
  );
  // `batches` is already scoped to this facilitator by the fetchBatches({ facilitatorId }) call
  // above — re-filtering by name here would silently break for any facilitator but the one whose
  // name happens to match FACILITATOR_NAME.
  const myBatches = batches;
  // `sessions` is fetched unfiltered (no batch param); scope the list view to this facilitator's
  // own batches so they only see their own sessions, not every batch's.
  const mySessions = useMemo(() => {
    const myBatchIds = new Set(myBatches.map((b) => b.id));
    return sessions.filter((s) => myBatchIds.has(s.batchId));
  }, [sessions, myBatches]);

  // Which of my completed sessions' Facilitator/Both-audience feedback forms I've already
  // submitted my own response to — mirrors the trainee dashboard's equivalent tracking, since a
  // form can target facilitators too, not just be something they manage.
  const [mySubmittedFeedbackSessionIds, setMySubmittedFeedbackSessionIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sessionsWithRespondableForms = mySessions.filter(
      (s) => s.status === 'Completed' && s.feedbackForm && s.feedbackForm.audience !== 'Trainees'
    );
    Promise.all(
      sessionsWithRespondableForms.map((s) =>
        sessionFeedbackService.getSessionFeedbackForm(s.id).then((form) => (form?.mySubmitted ? s.id : null))
      )
    ).then((ids) => setMySubmittedFeedbackSessionIds(new Set(ids.filter((id): id is string => id !== null))));
  }, [mySessions]);

  async function handleGiveSessionFeedback(session: Session) {
    if (!session.feedbackForm) return;
    window.open(session.feedbackForm.formUrl, '_blank', 'noopener,noreferrer');
    try {
      await sessionFeedbackService.submitSessionFeedback(session.id);
      setMySubmittedFeedbackSessionIds((prev) => new Set(prev).add(session.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to record feedback submission.', 'error');
    }
  }
  const traineeContacts = useMemo(
    () =>
      Array.from(new Set(myBatches.flatMap((b) => b.members))).map((name) => {
        const batch = myBatches.find((b) => b.members.includes(name));
        const pendingCount = facilitatorAssignments.reduce(
          (sum, a) => sum + a.submissions.filter((s) => s.traineeName === name && s.status !== 'Completed').length,
          0
        );
        return { name, batchId: batch?.id ?? '', batchName: batch?.name ?? 'Unassigned', pendingCount };
      }),
    [myBatches, facilitatorAssignments]
  );
  const filteredTrainees = useMemo(
    () => traineeContacts.filter((t) => t.name.toLowerCase().includes(traineeSearch.trim().toLowerCase())),
    [traineeContacts, traineeSearch]
  );

  const traineeStats = useMemo(
    () =>
      traineeContacts.map((t) => {
        const subs = facilitatorAssignments.flatMap((a) => a.submissions.filter((s) => s.traineeName === t.name));
        const missingCount = subs.filter((s) => s.status === 'Not Started' || s.status === 'Late').length;
        const grades = subs.filter((s) => s.grade !== null).map((s) => s.grade as number);
        const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
        return { name: t.name, batchName: t.batchName, missingCount, avgGrade };
      }),
    [traineeContacts, facilitatorAssignments]
  );
  const needsAttention = useMemo(
    () => traineeStats.filter((t) => t.missingCount >= 2 || (t.avgGrade !== null && t.avgGrade < 60)).slice(0, 4),
    [traineeStats]
  );

  const recentSubmissions = useMemo(
    () =>
      facilitatorAssignments
        .flatMap((a) => a.submissions.filter((s) => s.status !== 'Not Started').map((s) => ({ assignment: a, submission: s })))
        .sort((a, b) => Number(a.submission.grade !== null) - Number(b.submission.grade !== null))
        .slice(0, 5),
    [facilitatorAssignments]
  );

  const filteredFacilitatorAssignments = useMemo(
    () =>
      facilitatorAssignments.filter((a) => {
        const q = assignmentSearch.trim().toLowerCase();
        const matchesSearch = q === '' || a.title.toLowerCase().includes(q);
        const matchesStatus = assignmentStatusFilter === 'All Statuses' || effectiveStatus(a) === assignmentStatusFilter;
        const matchesBatch = assignmentBatchFilter === 'All Batches' || a.batches.some((b) => b.name === assignmentBatchFilter);
        return matchesSearch && matchesStatus && matchesBatch;
      }),
    [facilitatorAssignments, assignmentSearch, assignmentStatusFilter, assignmentBatchFilter]
  );
  const ASSIGNMENT_PAGE_SIZE = 6;
  const assignmentPageCount = Math.max(1, Math.ceil(filteredFacilitatorAssignments.length / ASSIGNMENT_PAGE_SIZE));
  const pagedFacilitatorAssignments = paginate(filteredFacilitatorAssignments, assignmentPage, ASSIGNMENT_PAGE_SIZE);

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
      prev.size === pagedFacilitatorAssignments.length ? new Set() : new Set(pagedFacilitatorAssignments.map((a) => a.id))
    );
  }

  async function handleBulkDeleteAssignments() {
    const ids = Array.from(selectedAssignmentIds);
    try {
      await bulkDeleteAssignments(ids);
      logEvent('Assignment', `${ids.length} assignment(s) deleted in bulk.`, { module: 'Assignments' });
      showToast(`${ids.length} assignment(s) deleted`);
      setSelectedAssignmentIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete assignments.', 'error');
    }
  }

  async function handleBulkCloseAssignments() {
    const ids = Array.from(selectedAssignmentIds);
    try {
      await bulkCloseAssignments(ids);
      logEvent('Assignment', `${ids.length} assignment(s) closed in bulk.`, { module: 'Assignments' });
      showToast(`${ids.length} assignment(s) closed`);
      setSelectedAssignmentIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to close assignments.', 'error');
    }
  }

  async function handleBulkDuplicateAssignments() {
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

  async function confirmBulkExtendAssignmentDeadline() {
    if (!extendDeadlineDraft) return;
    const ids = Array.from(selectedAssignmentIds);
    const formatted = isoToDateStr(extendDeadlineDraft);
    try {
      await bulkExtendAssignmentDeadline(ids, formatted);
      logEvent('Assignment', `Deadline extended to ${formatted} for ${ids.length} assignment(s).`, { module: 'Assignments' });
      showToast(`Deadline extended for ${ids.length} assignment(s)`);
      setSelectedAssignmentIds(new Set());
      setExtendDeadlineModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to extend deadlines.', 'error');
    }
  }

  const facilitatorAvgScore = average(facilitatorAssignments.flatMap((a) => a.submissions.filter((s) => s.grade !== null).map((s) => s.grade as number)));
  const facilitatorPendingReviews = facilitatorAssignments.reduce((sum, a) => sum + a.submissions.filter((s) => s.status === 'Under Review').length, 0);
  const facilitatorAttendance = average(myBatches.map((b) => b.attendanceRate));
  const baselineAvgScore = useRef(facilitatorAvgScore).current;
  const baselineAttendance = useRef(facilitatorAttendance).current;

  function openQuickGrade(assignmentId: string, traineeName: string, current: { grade: number | null; status: SubmissionStatus }) {
    setQuickGradeTarget({ assignmentId, traineeName });
    setQuickGradeScore(current.grade !== null ? String(current.grade) : '');
    setQuickGradeStatus(current.status === 'Not Started' ? 'Completed' : current.status);
  }

  async function saveQuickGrade() {
    if (!quickGradeTarget) return;
    const grade = quickGradeScore.trim() === '' ? null : Number(quickGradeScore);
    try {
      await updateSubmission(quickGradeTarget.assignmentId, quickGradeTarget.traineeName, { grade, status: quickGradeStatus });
      logEvent('Grading', `${quickGradeTarget.traineeName} was quick-graded ${grade ?? '—'}/100.`, { module: 'Assignments' });
      showToast('Grade saved');
      setQuickGradeTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save grade.', 'error');
    }
  }

  function handleDownloadSubmission(assignmentTitle: string, traineeName: string) {
    const content = `Submission Summary\n\nAssignment: ${assignmentTitle}\nTrainee: ${traineeName}\nDownloaded: ${new Date().toLocaleString()}\n\n(No file storage is connected in this environment — this is a placeholder export.)`;
    downloadTextFile(`${traineeName.replace(/\s+/g, '-')}-submission.txt`, content, 'text/plain;charset=utf-8;');
    logEvent('Assignment', `Downloaded submission summary for ${traineeName}.`, { module: 'Assignments' });
    showToast('Submission summary downloaded');
  }

  function handleSendReminder(traineeName: string) {
    logEvent('Reminder', `Reminder sent to ${traineeName} for pending submission.`);
    showToast(`Reminder sent to ${traineeName}`);
  }

  function handleSchedule1on1(traineeName: string) {
    const batch = myBatches.find((b) => b.members.includes(traineeName));
    setNewSessionTitle(`1:1 with ${traineeName}`);
    setNewSessionBatchId(batch?.id ?? aimlBatch?.id ?? batches[0]?.id ?? '');
    setNewSessionDate('');
    setNewSessionTime('');
    setNewSessionLink('');
    setNewSessionPlatform('Google Meet');
    setSessionFormError('');
    setSessionModalOpen(true);
  }

  async function handleContactTrainee(name: string) {
    const email = await findUserEmailByName(name, 'trainee');
    if (!email) {
      showToast(`No email on file for ${name}.`, 'error');
      return;
    }
    window.location.href = `mailto:${email}`;
  }

  async function handlePostAnnouncement() {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setAnnouncementFormError('Please enter both a title and a message.');
      return;
    }
    setAnnouncementFormError('');
    setAnnouncementFormSaving(true);
    try {
      // A real Announcement row can only target one batchId (facilitators can't post global) —
      // "All Active Batches" here means every batch this facilitator runs, so post one per batch.
      await Promise.all(
        myBatches.map((batch) =>
          postAnnouncement(
            {
              title: announcementTitle,
              message: announcementMessage,
              priority: announcementPriority,
              audience: 'All Active Batches',
              batchId: batch.id,
              pinned: false,
              scheduledFor: null,
              expiresAt: null
            },
            batches
          )
        )
      );
      logEvent('Announcement', `"${announcementTitle}" was posted by ${FACILITATOR_NAME}.`);
      showToast('Announcement Posted!');
      setAnnouncementModalOpen(false);
      setAnnouncementTitle('');
      setAnnouncementPriority('Normal');
      setAnnouncementMessage('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post announcement.', 'error');
    } finally {
      setAnnouncementFormSaving(false);
    }
  }

  function startEditSession(sessionId: string, date: string, time: string) {
    setEditingSessionId(sessionId);
    setEditDateIso(dateStrToIso(date));
    const { start, end } = parseTimeRange(time);
    setEditStartMin(start);
    setEditEndMin(end);
  }

  async function saveSessionEdit(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    const date = isoToDateStr(editDateIso);
    const time = formatTimeRange(editStartMin, editEndMin);
    try {
      await updateSession(sessionId, { date, time });
      showToast('Session updated');
      logEvent('Session', `Updated schedule for "${session?.title ?? sessionId}".`);
      setEditingSessionId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update session.', 'error');
    }
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

  async function handleCreateSession() {
    if (!newSessionTitle.trim() || !newSessionDate.trim() || !newSessionTime.trim()) {
      setSessionFormError('Please fill in the title, date, and time.');
      return;
    }
    setSessionFormError('');
    setSessionFormSaving(true);
    try {
      const title = newSessionTitle.trim() || 'Untitled Session';
      await createSession({
        title,
        batchId: newSessionBatchId || batches[0]?.id || '',
        facilitator: FACILITATOR_NAME,
        date: newSessionDate,
        time: newSessionTime,
        link: newSessionLink,
        platform: newSessionPlatform,
        status: 'Upcoming'
      });
      setSessionModalOpen(false);
      setNewSessionTitle('');
      setNewSessionBatchId('');
      setNewSessionDate('');
      setNewSessionTime('');
      setNewSessionLink('');
      showToast('Session scheduled');
      logEvent('Session', `Scheduled "${title}".`);
    } catch (err) {
      setSessionFormError(err instanceof Error ? err.message : 'Unable to schedule session.');
    } finally {
      setSessionFormSaving(false);
    }
  }

  async function handleCreateAssignment() {
    if (!newAssignmentTitle.trim() || !newAssignmentDeadline.trim() || newAssignmentBatchIds.length === 0) {
      setAssignmentFormError('Please enter a title, a deadline, and select at least one batch.');
      return;
    }
    setAssignmentFormError('');
    setAssignmentFormSaving(true);
    try {
      const title = newAssignmentTitle.trim() || 'Untitled Assignment';
      const assignment = await createAssignment({
        title,
        agenda: newAssignmentAgenda,
        batchIds: newAssignmentBatchIds,
        deadline: newAssignmentDeadline,
        description: newAssignmentDescription,
        file: newAssignmentFile
      });
      setAssignmentModalOpen(false);
      setNewAssignmentTitle('');
      setNewAssignmentAgenda('');
      setNewAssignmentBatchIds([]);
      setNewAssignmentFile(null);
      setNewAssignmentDeadline('');
      setNewAssignmentDescription('');
      showToast('Assignment created');
      logEvent('Assignment', `Created assignment "${title}" for ${assignment.batches.length} batch(es).`);
    } catch (err) {
      setAssignmentFormError(err instanceof Error ? err.message : 'Unable to create assignment.');
    } finally {
      setAssignmentFormSaving(false);
    }
  }

  async function handleUploadResource() {
    if (!newResourceFile) {
      showToast('Please choose a file to upload.', 'error');
      return;
    }
    const title = newResourceTitle.trim() || newResourceFile.name;
    try {
      await addResource({
        title,
        category: newResourceCategory,
        batchId: newResourceBatchId,
        file: newResourceFile
      });
      setResourceModalOpen(false);
      setNewResourceTitle('');
      setNewResourceFile(null);
      showToast('Resource uploaded — pending verification');
      logEvent('Resource', `Uploaded "${title}".`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to upload resource.', 'error');
    }
  }

  async function handleSaveFeedback() {
    // Use the selected trainee's actual batch — not just batches[0] — so this works correctly
    // for a facilitator who manages more than one batch.
    if (!feedbackSelectedTrainee || !feedbackSelectedTrainee.batchId) return;
    try {
      await submitFeedback({
        trainee: feedbackSelectedTrainee.name,
        facilitator: FACILITATOR_NAME,
        batchId: feedbackSelectedTrainee.batchId,
        category: feedbackCategory,
        rating: Number(feedbackRating) || 0,
        comment: feedbackComment,
        date: new Date().toLocaleDateString()
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save feedback.', 'error');
      return;
    }
    showToast('Feedback saved');
    logEvent('Feedback', `Submitted feedback for ${feedbackSelectedTrainee.name}.`);
    setFeedbackCategory('Technical Skills');
    setFeedbackRating('');
    setFeedbackComment('');
  }

  return (
    <DashboardLayout
      brandLabel={FACILITATOR_BRAND_LABEL}
      navItems={FACILITATOR_NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={() => setLogoutConfirmOpen(true)}
      logoutButtonClassName="flex items-center px-4 py-2 text-gray-600 hover:text-red-600 transition-colors w-full text-left"
      headerTitle={HEADER_TITLES[activeTab]}
      headerRight={
        <>
          <div className="relative" ref={notificationMenuRef}>
            <button
              className="relative text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
              onClick={() => setNotificationOpen(!notificationOpen)}
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={notificationOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">{unreadCount}</span>
              )}
            </button>

            <div className={`${notificationOpen ? '' : 'hidden'} absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50`}>
              <NotificationPanel
                entries={auditEntries}
                readIds={readLogIds}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onViewAll={() => setNotificationOpen(false)}
                viewAllLabel="Close"
              />
            </div>
          </div>

          <ProfileDropdown role="facilitator" onSignOut={() => setLogoutConfirmOpen(true)} />
        </>
      }
    >
        <div className="flex-1 overflow-y-auto p-8 relative">
          {/* Dashboard Tab */}
          <div className={hiddenUnless('dashboard')}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Welcome, {displayName ?? 'Junaid'}</h2>
              <div className="flex space-x-3 relative" ref={quickActionMenuRef}>
                <button
                  onClick={() => setQuickActionOpen((open) => !open)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Quick Action
                </button>
                {quickActionOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-2">
                    <button
                      onClick={() => { setActiveTab('assignments'); setAssignmentModalOpen(true); setQuickActionOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      + Create Assignment
                    </button>
                    <button
                      onClick={() => { setActiveTab('announcements'); setAnnouncementModalOpen(true); setQuickActionOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      + Post Announcement
                    </button>
                    <button
                      onClick={() => { setActiveTab('sessions'); setSessionModalOpen(true); setQuickActionOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      + Schedule Session
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <StatCard
                label="Average Score"
                value={facilitatorAvgScore !== null ? `${facilitatorAvgScore}%` : '—'}
                trend={<TrendIndicator current={facilitatorAvgScore} baseline={baselineAvgScore} />}
                hoverClassName="hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              />
              <StatCard
                label="Pending Reviews"
                value={facilitatorPendingReviews}
                actionText={facilitatorPendingReviews > 0 ? 'Needs grading' : 'All caught up'}
                hoverClassName="hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              />
              <StatCard
                label="Attendance"
                value={facilitatorAttendance !== null ? `${facilitatorAttendance}%` : '—'}
                trend={<TrendIndicator current={facilitatorAttendance} baseline={baselineAttendance} />}
                hoverClassName="hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-red-50 px-6 py-4 border-b border-red-200 flex justify-between items-center">
                  <h3 className="font-bold text-red-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Needs Attention
                  </h3>
                </div>
                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  {needsAttention.length === 0 && (
                    <EmptyState title="Everyone's on track" message="No trainees currently need attention." icon="inbox" />
                  )}
                  {needsAttention.map((t) => (
                    <div key={t.name} className={`p-3 border rounded-lg ${t.missingCount >= 2 ? 'border-red-100 bg-red-50/30' : 'border-orange-100 bg-orange-50/30'}`}>
                      <div className="font-bold text-gray-800">{t.name}</div>
                      <div className={`text-sm mt-1 ${t.missingCount >= 2 ? 'text-red-600' : 'text-orange-600'}`}>
                        {t.missingCount >= 2 ? `${t.missingCount} missing/late assignments` : `Low avg score (${t.avgGrade}%)`}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleSendReminder(t.name)} className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 transition-colors">Send Reminder</button>
                        <button onClick={() => handleSchedule1on1(t.name)} className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 transition-colors">Schedule 1:1</button>
                        <button
                          onClick={() => navigate(...facilitatorTraineeProfileNavArgs(t.name))}
                          className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Recent Submissions</h3>
                  <button onClick={() => setActiveTab('assignments')} className="text-blue-600 text-sm font-medium hover:underline">View All</button>
                </div>
                <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
                  {recentSubmissions.length === 0 && (
                    <EmptyState title="No submissions yet" icon="inbox" />
                  )}
                  {recentSubmissions.map(({ assignment, submission }) => {
                    const isQuickGrading = quickGradeTarget?.assignmentId === assignment.id && quickGradeTarget?.traineeName === submission.traineeName;
                    return (
                      <div key={`${assignment.id}-${submission.traineeName}`} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-800">{assignment.title}</div>
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-2">
                                {submission.traineeName.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()}
                              </div>
                              {submission.traineeName} • {submission.submittedOn ? formatDateTime(submission.submittedOn) : '—'}
                              {submission.status === 'Late' && <span className="text-red-500 ml-1">• Late Submission</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => (isQuickGrading ? setQuickGradeTarget(null) : openQuickGrade(assignment.id, submission.traineeName, submission))}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors text-sm"
                            >
                              {isQuickGrading ? 'Close' : 'Quick Grade'}
                            </button>
                            <Link to={`/assignments/${assignment.id}`} className="px-3 py-1.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">Open</Link>
                            <button onClick={() => handleDownloadSubmission(assignment.title, submission.traineeName)} className="px-3 py-1.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">Download</button>
                          </div>
                        </div>
                        {isQuickGrading && (
                          <div className="mt-3 flex items-end gap-3 bg-blue-50/40 border border-blue-100 rounded-lg p-3">
                            <div>
                              <label htmlFor="facilitator-quick-grade-score" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Score (0-100)</label>
                              <input
                                id="facilitator-quick-grade-score"
                                type="number"
                                min={0}
                                max={100}
                                value={quickGradeScore}
                                onChange={(e) => setQuickGradeScore(e.target.value)}
                                className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                              />
                            </div>
                            <div>
                              <label htmlFor="facilitator-quick-grade-status" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status</label>
                              <select id="facilitator-quick-grade-status" value={quickGradeStatus} onChange={(e) => setQuickGradeStatus(e.target.value as SubmissionStatus)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none bg-white">
                                <option>Under Review</option>
                                <option>Completed</option>
                                <option>Late</option>
                              </select>
                            </div>
                            <button onClick={saveQuickGrade} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700">Save Grade</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Resource Library Tab */}
          <div className={hiddenUnless('resources')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Digital Resource Library</h2>
              <button onClick={() => setResourceModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">+ Upload Resource</button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6 flex">
              <div className="p-4 border-r w-1/4">
                <h3 className="font-bold text-gray-700 mb-3 uppercase text-xs tracking-wider">Categories</h3>
                <ul className="space-y-1 text-sm">
                  {['All Files', 'Presentations', 'PDF Guides', 'Video Recordings'].map((cat) => (
                    <li
                      key={cat}
                      onClick={() => setResourceCategory(cat)}
                      className={
                        resourceCategory === cat
                          ? 'bg-blue-50 text-blue-700 font-medium px-3 py-2 rounded-lg cursor-pointer'
                          : 'text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg cursor-pointer'
                      }
                    >
                      {cat}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 p-6">
                <div className="mb-4">
                  <input
                    type="text"
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    placeholder="Search resources..."
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredResources.map((resource) => (
                    <div key={resource.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${resourceIconStyle(resource.category)}`}>
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800">{resource.title}</h4>
                          <p className="text-xs text-gray-500">Uploaded by {resource.uploadedBy} • {resource.uploadedAt}</p>
                        </div>
                      </div>
                      {resource.verified ? (
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">Verified</span>
                      ) : (
                        <button
                          onClick={() => { verifyResource(resource.id).then(() => showToast('Resource verified')); }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Batches Tab */}
          <div className={hiddenUnless('batches')}>
            <Breadcrumbs trail={['Facilitator', 'Batches']} />
            <h2 className="text-2xl font-bold mb-6">My Batches</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <StatCard label="Batches" value={myBatches.length} valueClassName="text-3xl font-bold mt-2 text-gray-800" />
              <StatCard
                label="Total Trainees"
                value={myBatches.reduce((sum, b) => sum + b.traineeCount, 0)}
                valueClassName="text-3xl font-bold mt-2 text-gray-800"
              />
              <StatCard
                label="Avg Completion"
                value={`${average(myBatches.map((b) => b.completion)) ?? '—'}${average(myBatches.map((b) => b.completion)) !== null ? '%' : ''}`}
                valueClassName="text-3xl font-bold mt-2 text-gray-800"
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {myBatches.length === 0 ? (
                <EmptyState title="No batches assigned yet" message="Batches you're the point of contact for will show up here." icon="inbox" />
              ) : (
                <Table
                  columns={[
                    { key: 'batch', label: 'Batch' },
                    { key: 'dates', label: 'Start / End' },
                    { key: 'trainees', label: 'Trainees' },
                    { key: 'avgScore', label: 'Avg Performance' },
                    { key: 'completion', label: 'Assignment Completion' },
                    { key: 'attendance', label: 'Attendance' },
                    { key: 'status', label: 'Status' }
                  ]}
                >
                  {myBatches.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(ROUTES.FACILITATOR_BATCH_DETAIL(b.id))}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{b.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{b.code} • {b.program} • {b.track}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {b.startMonth || '—'} – {b.endDate ? formatDateTime(b.endDate) : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{b.traineeCount}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{b.avgScore !== null ? `${b.avgScore}/100` : '—'}</td>
                      <td className="px-6 py-4 w-40"><ProgressBar value={b.completion} /></td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{b.attendanceRate !== null ? `${b.attendanceRate}%` : '—'}</td>
                      <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </div>

          {/* Assignments Tab */}
          <div className={hiddenUnless('assignments')}>
            <Breadcrumbs trail={['Facilitator', 'Assignments']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Assignments Dashboard</h2>
              <button onClick={() => setAssignmentModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-150">+ Create Assignment</button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
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
                    <button onClick={handleBulkDuplicateAssignments} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">Duplicate</button>
                    <button onClick={() => setExtendDeadlineModalOpen(true)} className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">Extend Deadline</button>
                    <button onClick={handleBulkCloseAssignments} className="text-xs font-bold text-amber-700 bg-white border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">Close</button>
                    <button onClick={handleBulkDeleteAssignments} className="text-xs font-bold text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                  </div>
                </div>
              )}

              <Table
                theadRowClassName="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider"
                columns={[
                  {
                    key: 'select',
                    className: 'w-8',
                    label: (
                      <input
                        type="checkbox"
                        checked={pagedFacilitatorAssignments.length > 0 && selectedAssignmentIds.size === pagedFacilitatorAssignments.length}
                        onChange={toggleSelectAllAssignments}
                        aria-label="Select all assignments"
                      />
                    )
                  },
                  { key: 'assignment', label: 'Assignment' },
                  { key: 'batch', label: 'Batch' },
                  { key: 'session', label: 'Related Session' },
                  { key: 'deadline', label: 'Deadline' },
                  { key: 'status', label: 'Status' },
                  { key: 'grading', label: 'Grading Progress' },
                  { key: 'file', label: 'Assignment File' }
                ]}
              >
                {pagedFacilitatorAssignments.length === 0 && (
                  <tr><td colSpan={8}><EmptyState title="No assignments match these filters" icon="search" /></td></tr>
                )}
                {pagedFacilitatorAssignments.map((a) => {
                  const gradedCount = a.submissions.filter((s) => s.status === 'Completed').length;
                  const gradedPercent = a.submissions.length > 0 ? Math.round((gradedCount / a.submissions.length) * 100) : 0;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <input type="checkbox" checked={selectedAssignmentIds.has(a.id)} onChange={() => toggleAssignmentSelected(a.id)} aria-label={`Select ${a.title}`} />
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <AssignmentTitleLink id={a.id} title={a.title} />
                      </td>
                      <td className="px-6 py-4 text-gray-500"><AssignmentBatchesCell batches={a.batches} /></td>
                      <td className="px-6 py-4 text-gray-500">{a.sessionTitle ?? '—'}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(a.deadline)}</td>
                      <td className="px-6 py-4"><StatusBadge status={effectiveStatus(a)} /></td>
                      <td className="px-6 py-4 w-48">
                        <div className="text-[11px] text-gray-500 font-bold mb-1">{gradedCount}/{a.submissions.length} graded</div>
                        <ProgressBar value={gradedPercent} color="bg-blue-500" size="sm" />
                      </td>
                      <td className="px-6 py-4">
                        <FileViewButton url={a.attachmentFilename ? assignmentAttachmentUrl(a.id) : null} fileName={a.attachmentFilename ?? undefined} label="View Assignment File" />
                      </td>
                    </tr>
                  );
                })}
              </Table>
              <Pagination page={assignmentPage} pageCount={assignmentPageCount} onPageChange={setAssignmentPage} totalItems={filteredFacilitatorAssignments.length} pageSize={ASSIGNMENT_PAGE_SIZE} />
            </div>
          </div>

          {/* Sessions & Calendar Tab */}
          <div className={hiddenUnless('sessions')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Sessions & Calendar</h2>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
                  <button onClick={() => setSessionViewMode('list')} className={`px-3 py-2 transition-colors ${sessionViewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>List</button>
                  <button onClick={() => setSessionViewMode('calendar')} className={`px-3 py-2 transition-colors ${sessionViewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Calendar</button>
                </div>
                <button onClick={() => setSessionModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">+ Schedule Session</button>
              </div>
            </div>
            {sessionViewMode === 'calendar' ? (
              <SessionsCalendarView />
            ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
              {mySessions.map((session) => {
                const batch = batches.find((b) => b.id === session.batchId);
                const isEditing = editingSessionId === session.id;
                return (
                  <div key={session.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">{session.title}</div>
                      <div className="text-sm text-gray-500 mt-1">{batch?.name ?? session.batchId} • {session.facilitator}</div>
                      <div className="text-sm text-gray-500 mt-1">{session.date} • {session.time}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{session.platform}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                        <span>Assignment: {session.relatedAssignmentTitle ?? '—'}</span>
                        <SessionFeedbackCell
                          session={session}
                          canManage
                          onChange={(sessionId, feedbackForm) => updateSession(sessionId, { feedbackForm })}
                        />
                      </div>
                      {(() => {
                        const total = (session.presentCount ?? 0) + (session.absentCount ?? 0);
                        const attendancePercent = total > 0 ? Math.round(((session.presentCount ?? 0) / total) * 100) : null;
                        const isEditingAttendance = attendanceEditingId === session.id;
                        return (
                          <>
                            {(attendancePercent !== null || isEditingAttendance) && !isEditingAttendance && (
                              <div className="mt-2 flex items-center gap-3 text-xs">
                                <span className="text-green-600 font-bold">{session.presentCount ?? 0} present</span>
                                <span className="text-red-500 font-bold">{session.absentCount ?? 0} absent</span>
                                <span className="text-gray-500 font-bold">{attendancePercent}% attendance</span>
                                <button onClick={() => startEditAttendance(session)} className="text-blue-600 hover:underline font-medium">Edit</button>
                              </div>
                            )}
                            {isEditingAttendance && (
                              <div className="mt-2 flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div>
                                  <label htmlFor="facilitator-attendance-present" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Present</label>
                                  <input
                                    id="facilitator-attendance-present"
                                    type="number"
                                    min={0}
                                    value={attendanceDraft.present}
                                    onChange={(e) => setAttendanceDraft({ ...attendanceDraft, present: e.target.value })}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm outline-none"
                                  />
                                </div>
                                <div>
                                  <label htmlFor="facilitator-attendance-absent" className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Absent</label>
                                  <input
                                    id="facilitator-attendance-absent"
                                    type="number"
                                    min={0}
                                    value={attendanceDraft.absent}
                                    onChange={(e) => setAttendanceDraft({ ...attendanceDraft, absent: e.target.value })}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm outline-none"
                                  />
                                </div>
                                <button onClick={() => setAttendanceEditingId(null)} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5">Cancel</button>
                                <button onClick={() => saveAttendance(session)} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Save</button>
                              </div>
                            )}
                            {attendancePercent === null && !isEditingAttendance && (
                              <button
                                onClick={() => startEditAttendance(session)}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-all duration-150 hover:scale-105 active:scale-95"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Record Attendance
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-3 relative" ref={isEditing ? sessionEditPopoverRef : undefined}>
                      <StatusBadge status={session.status} />
                      <button
                        onClick={() => (isEditing ? setEditingSessionId(null) : startEditSession(session.id, session.date, session.time))}
                        className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-150 hover:scale-105 active:scale-95 ${
                          isEditing ? 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100' : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
                        }`}
                      >
                        {isEditing ? 'Close' : 'Edit timing'}
                      </button>
                      {isEditing && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4 text-left">
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Reschedule Session</div>
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="facilitator-session-edit-date" className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                              <input
                                id="facilitator-session-edit-date"
                                type="date"
                                value={editDateIso}
                                onChange={(e) => setEditDateIso(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="flex justify-between text-[11px] font-bold text-gray-500 mb-1 uppercase">
                                <span>Start Time</span>
                                <span className="text-blue-600 normal-case">{minutesToLabel(editStartMin)}</span>
                              </label>
                              <input
                                type="range"
                                min={0}
                                max={1425}
                                step={15}
                                value={editStartMin}
                                onChange={(e) => setEditStartMin(Number(e.target.value))}
                                className="w-full accent-blue-600"
                              />
                            </div>
                            <div>
                              <label className="flex justify-between text-[11px] font-bold text-gray-500 mb-1 uppercase">
                                <span>End Time</span>
                                <span className="text-blue-600 normal-case">{minutesToLabel(editEndMin)}</span>
                              </label>
                              <input
                                type="range"
                                min={0}
                                max={1439}
                                step={15}
                                value={editEndMin}
                                onChange={(e) => setEditEndMin(Number(e.target.value))}
                                className="w-full accent-blue-600"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button onClick={() => setEditingSessionId(null)} className="text-xs font-medium text-gray-500 px-2 py-1.5 hover:text-gray-700">Cancel</button>
                              <button onClick={() => saveSessionEdit(session.id)} className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-transform duration-150 hover:scale-105 active:scale-95">
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
            )}
          </div>

          {/* Announcements Tab */}
          <div className={hiddenUnless('announcements')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Announcements</h2>
              <button onClick={() => setAnnouncementModalOpen(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">+ New Announcement</button>
            </div>
            <div className="space-y-4">
              {announcements.length === 0 && (
                <EmptyState title="No announcements yet" message="Broadcasts you post will appear here." icon="inbox" />
              )}
              {announcements.map((a) => (
                <div key={a.id} className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-l-4 ${PRIORITY_STYLES[a.priority].border}`}>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-lg text-gray-800">{a.title}</h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${PRIORITY_STYLES[a.priority].badge}`}>{a.priority}</span>
                  </div>
                  <p className="text-gray-600">{a.message}</p>
                  <div className="text-xs text-gray-400 mt-3">{a.author} • {a.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback Tab */}
          <div className={hiddenUnless('feedback')}>
            <h2 className="text-2xl font-bold mb-1">Session Feedback</h2>
            <p className="text-gray-500 text-sm mb-6">
              Attach, open, copy, or replace each session's external feedback-form link — and give your own feedback when a form targets facilitators.
            </p>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-10">
              {mySessions.length === 0 ? (
                <EmptyState title="No sessions yet" icon="calendar" />
              ) : (
                <div className="space-y-2">
                  {mySessions.map((session) => {
                    const batch = batches.find((b) => b.id === session.batchId);
                    const canGiveFeedback =
                      session.status === 'Completed' && session.feedbackForm && session.feedbackForm.audience !== 'Trainees';
                    const alreadySubmitted = mySubmittedFeedbackSessionIds.has(session.id);
                    return (
                      <div key={session.id} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-800">{session.title}</div>
                          <div className="text-xs text-gray-400">{batch?.name ?? session.batchId}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <SessionFeedbackCell
                            session={session}
                            canManage
                            onChange={(sessionId, feedbackForm) => updateSession(sessionId, { feedbackForm })}
                          />
                          {canGiveFeedback && (
                            alreadySubmitted ? (
                              <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Submitted</span>
                            ) : (
                              <button
                                onClick={() => handleGiveSessionFeedback(session)}
                                className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                              >
                                Give Feedback
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold text-gray-500 mb-1">Facilitator Performance Feedback</h2>
            <p className="text-gray-400 text-sm mb-6">Trainee/facilitator ratings — unrelated to Session Feedback above.</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="col-span-1 bg-white border border-gray-200 p-6 rounded-xl shadow-sm h-fit">
                <h3 className="font-bold text-lg mb-4">Give Feedback to a Trainee</h3>
                {myBatches.length === 0 ? (
                  <EmptyState title="No batches assigned yet" message="You'll be able to give feedback once you manage a batch." icon="inbox" />
                ) : traineeContacts.length === 0 ? (
                  <EmptyState title="No trainees in your batches yet" icon="inbox" />
                ) : (
                  <div className="space-y-4">
                    <select
                      value={feedbackSelectedTrainee ? `${feedbackSelectedTrainee.name}|${feedbackSelectedTrainee.batchId}` : ''}
                      onChange={(e) => {
                        const [name, batchId] = e.target.value.split('|');
                        setFeedbackSelectedTrainee(name ? { name, batchId } : null);
                      }}
                      className="w-full px-3 py-2 border rounded-lg outline-none"
                    >
                      <option value="">Select Trainee</option>
                      {myBatches.map((b) => (
                        <optgroup key={b.id} label={b.name}>
                          {b.members.map((name) => (
                            <option key={`${b.id}-${name}`} value={`${name}|${b.id}`}>{name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <select value={feedbackCategory} onChange={(e) => setFeedbackCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none">
                      <option value="Technical Skills">Category: Technical Skills</option>
                      <option value="Communication">Category: Communication</option>
                      <option value="Overall Performance">Category: Overall Performance</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={feedbackRating}
                      onChange={(e) => setFeedbackRating(e.target.value)}
                      placeholder="Rating 1-5"
                      className="w-full px-3 py-2 border rounded-lg outline-none"
                    />
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg outline-none h-24"
                      placeholder="Detailed feedback..."
                    ></textarea>
                    <button onClick={handleSaveFeedback} disabled={!feedbackSelectedTrainee} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                      Save Permanently
                    </button>

                    {feedbackSelectedTrainee && (
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 mt-2">Recent Feedback for {feedbackSelectedTrainee.name}</h4>
                        {facilitatorFeedback.filter((f) => f.trainee === feedbackSelectedTrainee.name).length === 0 ? (
                          <p className="text-sm text-gray-400">No previous feedback for this trainee.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {facilitatorFeedback.filter((f) => f.trainee === feedbackSelectedTrainee.name).map((f) => (
                              <FeedbackCard key={f.id} entry={f} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-2 bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">Historical Feedback Repository</h3>
                  <input
                    type="text"
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    placeholder="Search trainee or keyword..."
                    className="px-3 py-2 border rounded-lg outline-none text-sm w-64"
                  />
                </div>
                <div className="space-y-3">
                  {facilitatorFeedback.length === 0 && (
                    <EmptyState title="No feedback found" message="Try a different search term." icon="search" />
                  )}
                  {facilitatorFeedback.map((f) => (
                    <FeedbackCard key={f.id} entry={f} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Trainee Directory Tab */}
          <div className={hiddenUnless('trainees')}>
            <PageHeader title="Trainee Directory" wrap={false}>
              <SearchInput value={traineeSearch} onChange={setTraineeSearch} placeholder="Search trainees..." />
            </PageHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {filteredTrainees.length === 0 && (
                <div className="col-span-full">
                  <EmptyState title="No trainees found" message="Try a different search term." icon="search" />
                </div>
              )}
              {filteredTrainees.map((t) => (
                <div key={t.name} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col">
                  <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold mb-4">
                    {t.name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-bold text-gray-800">{t.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{t.batchName}</p>
                  <p className="text-xs text-gray-400 mt-2 mb-4">{t.pendingCount > 0 ? `${t.pendingCount} pending submission(s)` : 'All caught up'}</p>
                  <div className="mt-auto space-y-2">
                    <button
                      onClick={() => navigate(...facilitatorTraineeProfileNavArgs(t.name, { type: 'trainees' }))}
                      className="w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 text-sm"
                    >
                      View Profile
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => handleSchedule1on1(t.name)} className="flex-1 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm">
                        Schedule 1:1
                      </button>
                      <button onClick={() => handleContactTrainee(t.name)} className="flex-1 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm">
                        Contact
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      {/* Create Announcement Modal */}
      <Modal
        open={announcementModalOpen}
        onClose={() => { setAnnouncementModalOpen(false); setAnnouncementFormError(''); }}
        title="Create Announcement"
        maxWidth="md"
      >
          <div className="space-y-4">
            {announcementFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{announcementFormError}</div>
            )}
            <div>
              <label htmlFor="facilitator-announcement-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="facilitator-announcement-title" type="text" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label htmlFor="facilitator-announcement-priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select id="facilitator-announcement-priority" value={announcementPriority} onChange={(e) => setAnnouncementPriority(e.target.value as Announcement['priority'])} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option>Normal</option>
                <option>Important</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <label htmlFor="facilitator-announcement-message" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea id="facilitator-announcement-message" value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setAnnouncementModalOpen(false); setAnnouncementFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handlePostAnnouncement} isSaving={announcementFormSaving} label="Post" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium" />
          </div>
      </Modal>

      {/* Schedule Session Modal (repurposed Schedule Meeting modal) */}
      <Modal
        open={sessionModalOpen}
        onClose={() => { setSessionModalOpen(false); setSessionFormError(''); }}
        title="Schedule Meeting"
        maxWidth="md"
      >
          <div className="space-y-4">
            {sessionFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sessionFormError}</div>
            )}
            <div>
              <label htmlFor="facilitator-session-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="facilitator-session-title" type="text" value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="facilitator-session-batch" className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select
                id="facilitator-session-batch"
                value={newSessionBatchId || batches[0]?.id || ''}
                onChange={(e) => setNewSessionBatchId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="facilitator-session-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input id="facilitator-session-date" type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label htmlFor="facilitator-session-time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input id="facilitator-session-time" type="time" value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
            <div>
              <label htmlFor="facilitator-session-link" className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
              <input
                id="facilitator-session-link"
                type="url"
                value={newSessionLink}
                onChange={(e) => setNewSessionLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setSessionModalOpen(false); setSessionFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handleCreateSession} isSaving={sessionFormSaving} label="Schedule" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" />
          </div>
      </Modal>

      {/* Create Assignment Modal */}
      <Modal
        open={assignmentModalOpen}
        onClose={() => { setAssignmentModalOpen(false); setAssignmentFormError(''); }}
        title="Create Assignment"
        maxWidth="md"
      >
          <div className="space-y-4">
            {assignmentFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignmentFormError}</div>
            )}
            <div>
              <label htmlFor="facilitator-assignment-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="facilitator-assignment-title" type="text" value={newAssignmentTitle} onChange={(e) => setNewAssignmentTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label htmlFor="facilitator-assignment-agenda" className="block text-sm font-medium text-gray-700 mb-1">Agenda / Objective</label>
              <input
                id="facilitator-assignment-agenda"
                type="text"
                value={newAssignmentAgenda}
                onChange={(e) => setNewAssignmentAgenda(e.target.value)}
                placeholder="e.g. Requirement Gathering, SQL Basics"
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
            <BatchMultiSelect batches={batches} selectedIds={newAssignmentBatchIds} onChange={setNewAssignmentBatchIds} />
            <div>
              <label htmlFor="facilitator-assignment-deadline" className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input
                id="facilitator-assignment-deadline"
                type="text"
                value={newAssignmentDeadline}
                onChange={(e) => setNewAssignmentDeadline(e.target.value)}
                placeholder="e.g. Jul 20, 2026"
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
            <div>
              <label htmlFor="facilitator-assignment-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                id="facilitator-assignment-description"
                value={newAssignmentDescription}
                onChange={(e) => setNewAssignmentDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none h-24"
              ></textarea>
            </div>
            <div>
              <label htmlFor="facilitator-assignment-file" className="block text-sm font-medium text-gray-700 mb-1">Instructions File (optional)</label>
              <input
                id="facilitator-assignment-file"
                type="file"
                onChange={(e) => setNewAssignmentFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
              />
              {newAssignmentFile && <p className="text-xs text-gray-500 mt-1">{newAssignmentFile.name}</p>}
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setAssignmentModalOpen(false); setAssignmentFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handleCreateAssignment} isSaving={assignmentFormSaving} label="Create" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" />
          </div>
      </Modal>

      {/* Upload Resource Modal */}
      <Modal open={resourceModalOpen} onClose={() => setResourceModalOpen(false)} title="Upload Resource" maxWidth="md">
          <div className="space-y-4">
            <div>
              <label htmlFor="facilitator-resource-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                id="facilitator-resource-title"
                type="text"
                value={newResourceTitle}
                onChange={(e) => setNewResourceTitle(e.target.value)}
                placeholder="Leave blank to use file name"
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
            <div>
              <label htmlFor="facilitator-resource-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                id="facilitator-resource-category"
                value={newResourceCategory}
                onChange={(e) => setNewResourceCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                <option value="Presentations">Presentations</option>
                <option value="PDF Guides">PDF Guides</option>
                <option value="Video Recordings">Video Recordings</option>
              </select>
            </div>
            <div>
              <label htmlFor="facilitator-resource-batch" className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select
                id="facilitator-resource-batch"
                value={newResourceBatchId}
                onChange={(e) => setNewResourceBatchId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                <option value="All">All</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="facilitator-resource-file" className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                id="facilitator-resource-file"
                type="file"
                onChange={(e) => setNewResourceFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setResourceModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={handleUploadResource} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Upload</button>
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
            <button onClick={confirmBulkExtendAssignmentDeadline} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Apply</button>
          </div>
      </Modal>

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

    </DashboardLayout>
  );
}
