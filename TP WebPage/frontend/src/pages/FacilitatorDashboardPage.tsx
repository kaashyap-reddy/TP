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
import { useDiscussionsStore } from '../store/discussionsStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthStore } from '../store/authStore';
import { clearSessionStorage } from '../utils/authSession';
import { dateStrToIso, formatTimeRange, isoToDateStr, minutesToLabel, parseTimeRange } from '../utils/sessionTime';
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
import type { FacilitatorTabId } from '../constants/navigation';
import { FACILITATOR_HEADER_TITLES } from '../constants/navigation';
import { PRIORITY_STYLES } from '../constants/announcements';
import { ROUTES } from '../constants/routes';

type TabId = FacilitatorTabId;
const HEADER_TITLES = FACILITATOR_HEADER_TITLES;

const navItemClass = (active: boolean) =>
  active
    ? 'flex items-center px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-medium'
    : 'flex items-center px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg font-medium';

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

  const batches = useBatchesStore((s) => s.batches);
  const assignments = useAssignmentsStore((s) => s.assignments);
  const createAssignment = useAssignmentsStore((s) => s.createAssignment);
  const updateSubmission = useAssignmentsStore((s) => s.updateSubmission);
  const bulkDeleteAssignments = useAssignmentsStore((s) => s.bulkDelete);
  const bulkCloseAssignments = useAssignmentsStore((s) => s.bulkClose);
  const bulkExtendAssignmentDeadline = useAssignmentsStore((s) => s.bulkExtendDeadline);
  const duplicateAssignment = useAssignmentsStore((s) => s.duplicateAssignment);
  const sessions = useSessionsStore((s) => s.sessions);
  const createSession = useSessionsStore((s) => s.createSession);
  const updateSession = useSessionsStore((s) => s.updateSession);
  const resources = useResourcesStore((s) => s.resources);
  const addResource = useResourcesStore((s) => s.addResource);
  const verifyResource = useResourcesStore((s) => s.verifyResource);
  const feedback = useFeedbackStore((s) => s.feedback);
  const submitFeedback = useFeedbackStore((s) => s.submitFeedback);
  const auditEntries = useAuditLogStore((s) => s.entries);
  const logEvent = useAuditLogStore((s) => s.logEvent);
  const showToast = useToastStore((s) => s.showToast);
  const announcements = useAnnouncementsStore((s) => s.announcements);
  const markAnnouncementRead = useAnnouncementsStore((s) => s.markRead);
  const postAnnouncement = useAnnouncementsStore((s) => s.postAnnouncement);
  const threads = useDiscussionsStore((s) => s.threads);
  const createThread = useDiscussionsStore((s) => s.createThread);
  const addMessage = useDiscussionsStore((s) => s.addMessage);
  const deleteThread = useDiscussionsStore((s) => s.deleteThread);
  const { displayName, clearSession } = useAuthStore();

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
  const { readLogIds, notificationEntries, unreadCount, markNotificationRead, markAllNotificationsRead } = useNotifications(auditEntries);
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

  // Discussions tab state
  const [threadSearch, setThreadSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threads[0]?.id ?? null);
  const [replyText, setReplyText] = useState('');
  const [newThreadModalOpen, setNewThreadModalOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');
  const [deleteThreadConfirmOpen, setDeleteThreadConfirmOpen] = useState(false);
  const [threadMenuOpenId, setThreadMenuOpenId] = useState<string | null>(null);

  // Quick Action menu
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const quickActionMenuRef = useRef<HTMLDivElement>(null);
  const threadMenuRef = useRef<HTMLDivElement>(null);
  const sessionEditPopoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(notificationMenuRef, () => setNotificationOpen(false), notificationOpen);
  useClickOutside(quickActionMenuRef, () => setQuickActionOpen(false), quickActionOpen);
  useClickOutside(threadMenuRef, () => setThreadMenuOpenId(null), threadMenuOpenId !== null);
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

  // Assignments tab state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentBatchId, setNewAssignmentBatchId] = useState('');
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
  const [feedbackTrainee, setFeedbackTrainee] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('Technical Skills');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');

  useEscapeKey(() => { setAnnouncementModalOpen(false); setAnnouncementFormError(''); }, announcementModalOpen);
  useEscapeKey(() => { setSessionModalOpen(false); setSessionFormError(''); }, sessionModalOpen);
  useEscapeKey(() => { setAssignmentModalOpen(false); setAssignmentFormError(''); }, assignmentModalOpen);
  useEscapeKey(() => setResourceModalOpen(false), resourceModalOpen);
  useEscapeKey(() => setNewThreadModalOpen(false), newThreadModalOpen);
  useEscapeKey(() => setExtendDeadlineModalOpen(false), extendDeadlineModalOpen);
  useEscapeKey(() => setQuickActionOpen(false), quickActionOpen);
  useEscapeKey(() => setThreadMenuOpenId(null), threadMenuOpenId !== null);
  useEscapeKey(() => setNotificationOpen(false), notificationOpen);

  function hiddenUnless(tab: TabId) {
    return activeTab === tab ? '' : 'hidden';
  }

  const facilitatorAssignments = useMemo(() => assignments.filter((a) => a.facilitator === FACILITATOR_NAME), [assignments]);
  const facilitatorFeedback = useMemo(
    () =>
      feedback.filter((f) => f.facilitator === FACILITATOR_NAME).filter((f) => {
        const q = feedbackSearch.trim().toLowerCase();
        return q === '' || f.trainee.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      }),
    [feedback, feedbackSearch]
  );
  const aimlBatch = batches.find((b) => b.id === 'aiml-btech');
  const filteredResources = useMemo(
    () =>
      resources.filter((r) => {
        const matchesSearch = r.title.toLowerCase().includes(resourceSearch.trim().toLowerCase());
        const matchesCategory = resourceCategory === 'All Files' || r.category === resourceCategory;
        return matchesSearch && matchesCategory;
      }),
    [resources, resourceSearch, resourceCategory]
  );
  const filteredThreads = useMemo(
    () => threads.filter((t) => t.title.toLowerCase().includes(threadSearch.trim().toLowerCase())),
    [threads, threadSearch]
  );
  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const sessionsByDate = useMemo(
    () =>
      sessions.reduce<Record<string, Session[]>>((acc, s) => {
        acc[s.date] = acc[s.date] ? [...acc[s.date], s] : [s];
        return acc;
      }, {}),
    [sessions]
  );
  const calendarDates = useMemo(
    () => Object.keys(sessionsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [sessionsByDate]
  );

  const myBatches = useMemo(() => batches.filter((b) => b.poc === FACILITATOR_NAME), [batches]);
  const traineeContacts = useMemo(
    () =>
      Array.from(new Set(myBatches.flatMap((b) => b.members))).map((name) => {
        const batch = myBatches.find((b) => b.members.includes(name));
        const pendingCount = facilitatorAssignments.reduce(
          (sum, a) => sum + a.submissions.filter((s) => s.traineeName === name && s.status !== 'Completed').length,
          0
        );
        return { name, batchName: batch?.name ?? 'Unassigned', pendingCount };
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
        const batch = batches.find((b) => b.id === a.batchId);
        const matchesBatch = assignmentBatchFilter === 'All Batches' || batch?.name === assignmentBatchFilter;
        return matchesSearch && matchesStatus && matchesBatch;
      }),
    [facilitatorAssignments, assignmentSearch, assignmentStatusFilter, assignmentBatchFilter, batches]
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

  function handleBulkDeleteAssignments() {
    const ids = Array.from(selectedAssignmentIds);
    bulkDeleteAssignments(ids);
    logEvent('Assignment', `${ids.length} assignment(s) deleted in bulk.`, { module: 'Assignments' });
    showToast(`${ids.length} assignment(s) deleted`);
    setSelectedAssignmentIds(new Set());
  }

  function handleBulkCloseAssignments() {
    const ids = Array.from(selectedAssignmentIds);
    bulkCloseAssignments(ids);
    logEvent('Assignment', `${ids.length} assignment(s) closed in bulk.`, { module: 'Assignments' });
    showToast(`${ids.length} assignment(s) closed`);
    setSelectedAssignmentIds(new Set());
  }

  function handleBulkDuplicateAssignments() {
    const ids = Array.from(selectedAssignmentIds);
    ids.forEach((id) => duplicateAssignment(id));
    logEvent('Assignment', `${ids.length} assignment(s) duplicated.`, { module: 'Assignments' });
    showToast(`${ids.length} assignment(s) duplicated`);
    setSelectedAssignmentIds(new Set());
  }

  function confirmBulkExtendAssignmentDeadline() {
    if (!extendDeadlineDraft) return;
    const ids = Array.from(selectedAssignmentIds);
    const formatted = isoToDateStr(extendDeadlineDraft);
    bulkExtendAssignmentDeadline(ids, formatted);
    logEvent('Assignment', `Deadline extended to ${formatted} for ${ids.length} assignment(s).`, { module: 'Assignments' });
    showToast(`Deadline extended for ${ids.length} assignment(s)`);
    setSelectedAssignmentIds(new Set());
    setExtendDeadlineModalOpen(false);
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

  function saveQuickGrade() {
    if (!quickGradeTarget) return;
    const grade = quickGradeScore.trim() === '' ? null : Number(quickGradeScore);
    updateSubmission(quickGradeTarget.assignmentId, quickGradeTarget.traineeName, { grade, status: quickGradeStatus });
    logEvent('Grading', `${quickGradeTarget.traineeName} was quick-graded ${grade ?? '—'}/100.`, { module: 'Assignments' });
    showToast('Grade saved');
    setQuickGradeTarget(null);
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

  function handleContactTrainee(name: string) {
    const batch = myBatches.find((b) => b.members.includes(name));
    const thread = createThread({
      title: `Note for ${name}`,
      batchId: batch?.id ?? batches[0]?.id ?? '',
      author: FACILITATOR_NAME,
      role: 'facilitator',
      message: `Hi ${name}, wanted to reach out regarding your progress.`
    });
    setSelectedThreadId(thread.id);
    setActiveTab('discussions');
    showToast(`Discussion started with ${name}`);
  }

  function handleCreateThread() {
    if (!newThreadTitle.trim()) return;
    const thread = createThread({
      title: newThreadTitle.trim(),
      batchId: aimlBatch?.id ?? batches[0]?.id ?? '',
      author: FACILITATOR_NAME,
      role: 'facilitator',
      message: newThreadMessage
    });
    setSelectedThreadId(thread.id);
    setNewThreadModalOpen(false);
    setNewThreadTitle('');
    setNewThreadMessage('');
    showToast('Discussion created');
  }

  function handleSendReply() {
    if (!selectedThread || !replyText.trim()) return;
    addMessage(selectedThread.id, { author: FACILITATOR_NAME, role: 'facilitator', text: replyText.trim() });
    setReplyText('');
  }

  function handleAttachFile(file: File | null) {
    if (!file) return;
    setReplyText((prev) => `${prev}${prev ? ' ' : ''}📎 ${file.name}`);
  }

  function confirmDeleteThread() {
    if (!selectedThread) return;
    deleteThread(selectedThread.id);
    setDeleteThreadConfirmOpen(false);
    setThreadMenuOpenId(null);
    setSelectedThreadId(null);
    showToast('Discussion deleted');
  }

  function handlePostAnnouncement() {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setAnnouncementFormError('Please enter both a title and a message.');
      return;
    }
    setAnnouncementFormError('');
    setAnnouncementFormSaving(true);
    setTimeout(() => {
      postAnnouncement({
        title: announcementTitle,
        message: announcementMessage,
        priority: announcementPriority,
        audience: 'All Active Batches',
        author: `${FACILITATOR_NAME} (Facilitator)`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        pinned: false,
        scheduledFor: null,
        expiresAt: null,
        audienceCount: batches.reduce((sum, b) => sum + b.traineeCount, 0)
      });
      logEvent('Announcement', `"${announcementTitle}" was posted by ${FACILITATOR_NAME}.`);
      showToast('Announcement Posted!');
      setAnnouncementModalOpen(false);
      setAnnouncementTitle('');
      setAnnouncementPriority('Normal');
      setAnnouncementMessage('');
      setAnnouncementFormSaving(false);
    }, 400);
  }

  function startEditSession(sessionId: string, date: string, time: string) {
    setEditingSessionId(sessionId);
    setEditDateIso(dateStrToIso(date));
    const { start, end } = parseTimeRange(time);
    setEditStartMin(start);
    setEditEndMin(end);
  }

  function saveSessionEdit(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    const date = isoToDateStr(editDateIso);
    const time = formatTimeRange(editStartMin, editEndMin);
    updateSession(sessionId, { date, time });
    showToast('Session updated');
    logEvent('Session', `Updated schedule for "${session?.title ?? sessionId}".`);
    setEditingSessionId(null);
  }

  function startEditAttendance(session: Session) {
    setAttendanceEditingId(session.id);
    setAttendanceDraft({ present: String(session.presentCount ?? 0), absent: String(session.absentCount ?? 0) });
  }

  function saveAttendance(session: Session) {
    const presentCount = Number(attendanceDraft.present) || 0;
    const absentCount = Number(attendanceDraft.absent) || 0;
    updateSession(session.id, { presentCount, absentCount });
    logEvent('Session', `Attendance recorded for "${session.title}": ${presentCount} present, ${absentCount} absent.`, { module: 'Sessions' });
    showToast('Attendance saved');
    setAttendanceEditingId(null);
  }

  function handleCreateSession() {
    if (!newSessionTitle.trim() || !newSessionDate.trim() || !newSessionTime.trim()) {
      setSessionFormError('Please fill in the title, date, and time.');
      return;
    }
    setSessionFormError('');
    setSessionFormSaving(true);
    setTimeout(() => {
      const title = newSessionTitle.trim() || 'Untitled Session';
      createSession({
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
      setSessionFormSaving(false);
    }, 400);
  }

  function handleCreateAssignment() {
    if (!newAssignmentTitle.trim() || !newAssignmentDeadline.trim()) {
      setAssignmentFormError('Please enter a title and a deadline.');
      return;
    }
    setAssignmentFormError('');
    setAssignmentFormSaving(true);
    setTimeout(() => {
      const title = newAssignmentTitle.trim() || 'Untitled Assignment';
      createAssignment({
        title,
        batchId: newAssignmentBatchId || batches[0]?.id || '',
        facilitator: FACILITATOR_NAME,
        deadline: newAssignmentDeadline,
        description: newAssignmentDescription
      });
      setAssignmentModalOpen(false);
      setNewAssignmentTitle('');
      setNewAssignmentBatchId('');
      setNewAssignmentDeadline('');
      setNewAssignmentDescription('');
      showToast('Assignment created');
      logEvent('Assignment', `Created assignment "${title}".`);
      setAssignmentFormSaving(false);
    }, 400);
  }

  function handleUploadResource() {
    const title = newResourceTitle.trim() || newResourceFile?.name || 'Untitled Resource';
    addResource({
      title,
      category: newResourceCategory,
      batchId: newResourceBatchId,
      uploadedBy: FACILITATOR_NAME,
      uploadedAt: new Date().toLocaleDateString()
    });
    setResourceModalOpen(false);
    setNewResourceTitle('');
    setNewResourceFile(null);
    showToast('Resource uploaded — pending verification');
    logEvent('Resource', `Uploaded "${title}".`);
  }

  function handleSaveFeedback() {
    if (!feedbackTrainee) return;
    submitFeedback({
      trainee: feedbackTrainee,
      facilitator: FACILITATOR_NAME,
      batchId: 'aiml-btech',
      category: feedbackCategory,
      rating: Number(feedbackRating) || 0,
      comment: feedbackComment,
      date: new Date().toLocaleDateString()
    });
    showToast('Feedback saved');
    logEvent('Feedback', `Submitted feedback for ${feedbackTrainee}.`);
    setFeedbackTrainee('');
    setFeedbackCategory('Technical Skills');
    setFeedbackRating('');
    setFeedbackComment('');
  }

  return (
    <div className="flex h-screen overflow-hidden text-gray-800" style={{ backgroundColor: '#f8fafc' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-lg font-bold text-blue-600">Facilitator Portal</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }} className={navItemClass(activeTab === 'dashboard')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('batches'); }} className={navItemClass(activeTab === 'batches')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Batches
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('assignments'); }} className={navItemClass(activeTab === 'assignments')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            Assignments
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('discussions'); }} className={navItemClass(activeTab === 'discussions')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            Discussions
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('resources'); }} className={navItemClass(activeTab === 'resources')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Resource Library
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('sessions'); }} className={navItemClass(activeTab === 'sessions')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Sessions
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('calendar'); }} className={navItemClass(activeTab === 'calendar')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Calendar & Events
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('announcements'); }} className={navItemClass(activeTab === 'announcements')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            Announcements
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('feedback'); }} className={navItemClass(activeTab === 'feedback')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Feedback & Reports
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('trainees'); }} className={navItemClass(activeTab === 'trainees')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 100-8 4 4 0 000 8zm8 0a4 4 0 100-8 4 4 0 000 8z" /></svg>
            Trainees
          </a>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button onClick={() => setLogoutConfirmOpen(true)} className="flex items-center px-4 py-2 text-gray-600 hover:text-red-600 transition-colors w-full text-left">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <h1 className="text-xl font-semibold">{HEADER_TITLES[activeTab]}</h1>
          <div className="flex items-center space-x-6">
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
          </div>
        </header>

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
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Average Score</div>
                <div className="text-4xl font-bold mt-2 text-gray-800">{facilitatorAvgScore !== null ? `${facilitatorAvgScore}%` : '—'}</div>
                <div className="mt-2"><TrendIndicator current={facilitatorAvgScore} baseline={baselineAvgScore} /></div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Pending Reviews</div>
                <div className="text-4xl font-bold mt-2 text-gray-800">{facilitatorPendingReviews}</div>
                <div className="text-yellow-500 text-sm mt-2 font-medium">{facilitatorPendingReviews > 0 ? 'Needs grading' : 'All caught up'}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Attendance</div>
                <div className="text-4xl font-bold mt-2 text-gray-800">{facilitatorAttendance !== null ? `${facilitatorAttendance}%` : '—'}</div>
                <div className="mt-2"><TrendIndicator current={facilitatorAttendance} baseline={baselineAttendance} /></div>
              </div>
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
                          onClick={() => navigate(ROUTES.FACILITATOR_TRAINEE_PROFILE(t.name))}
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
                              {submission.traineeName} • {submission.submittedOn}
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
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Score (0-100)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={quickGradeScore}
                                onChange={(e) => setQuickGradeScore(e.target.value)}
                                className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status</label>
                              <select value={quickGradeStatus} onChange={(e) => setQuickGradeStatus(e.target.value as SubmissionStatus)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none bg-white">
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

          {/* Threaded Discussions Tab */}
          <div className={`${hiddenUnless('discussions')} flex h-full border border-gray-200 rounded-xl shadow-sm bg-white overflow-hidden`}>
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <button onClick={() => setNewThreadModalOpen(true)} className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700">+ New Discussion</button>
                <input
                  type="text"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search threads..."
                  className="w-full mt-3 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {filteredThreads.length === 0 && (
                  <EmptyState title="No discussions found" message="Try a different search term." icon="search" />
                )}
                {filteredThreads.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`p-4 cursor-pointer ${t.id === selectedThreadId ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'}`}
                  >
                    <h4 className="font-bold text-gray-800 text-sm">{t.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.messages[0]?.text ?? 'No messages yet.'}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>{t.author}</span>
                      <span>{t.messages.length} {t.messages.length === 1 ? 'reply' : 'replies'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-2/3 flex flex-col bg-white">
              {!selectedThread ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a discussion to view the conversation.</div>
              ) : (
                <>
                  <div className="p-6 border-b border-gray-200 shadow-sm z-10 flex justify-between items-center relative" ref={threadMenuRef}>
                    <div>
                      <h3 className="text-xl font-bold">{selectedThread.title}</h3>
                      <div className="text-sm text-gray-500 mt-1">Started by {selectedThread.author} • {selectedThread.createdAt}</div>
                    </div>
                    <button
                      onClick={() => setThreadMenuOpenId(threadMenuOpenId === selectedThread.id ? null : selectedThread.id)}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      aria-label="Thread options"
                      aria-haspopup="true"
                      aria-expanded={threadMenuOpenId === selectedThread.id}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                    </button>
                    {threadMenuOpenId === selectedThread.id && (
                      <div className="absolute right-6 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1">
                        <button
                          onClick={() => { setThreadMenuOpenId(null); setDeleteThreadConfirmOpen(true); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete discussion
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                    {selectedThread.messages.map((m) => (
                      <div className="flex space-x-4" key={m.id}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${m.role === 'facilitator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {m.author.charAt(0).toUpperCase()}
                        </div>
                        <div className={`p-4 rounded-xl border shadow-sm flex-1 ${m.role === 'facilitator' ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200'}`}>
                          <div className="font-medium text-sm text-gray-800 mb-2">
                            {m.author}{m.role === 'facilitator' ? ' (Facilitator)' : ''} <span className="text-xs text-gray-400 font-normal ml-2">{m.at}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{m.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-center space-x-2">
                      <label className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        <input type="file" className="hidden" onChange={(e) => handleAttachFile(e.target.files?.[0] ?? null)} />
                      </label>
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                        placeholder="Type your reply... use @ to mention"
                        className="flex-1 px-4 py-2 bg-gray-100 border-transparent rounded-full focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      />
                      <button onClick={handleSendReply} className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
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
                          onClick={() => { verifyResource(resource.id); showToast('Resource verified'); }}
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
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Batches</div>
                <div className="text-3xl font-bold mt-2 text-gray-800">{myBatches.length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Trainees</div>
                <div className="text-3xl font-bold mt-2 text-gray-800">{myBatches.reduce((sum, b) => sum + b.traineeCount, 0)}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Avg Completion</div>
                <div className="text-3xl font-bold mt-2 text-gray-800">{average(myBatches.map((b) => b.completion)) ?? '—'}{average(myBatches.map((b) => b.completion)) !== null ? '%' : ''}</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {myBatches.length === 0 ? (
                <EmptyState title="No batches assigned yet" message="Batches you're the point of contact for will show up here." icon="inbox" />
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Batch</th>
                      <th className="px-6 py-3 font-medium">Program</th>
                      <th className="px-6 py-3 font-medium">Trainees</th>
                      <th className="px-6 py-3 font-medium">Avg Score</th>
                      <th className="px-6 py-3 font-medium">Completion</th>
                      <th className="px-6 py-3 font-medium">Attendance</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {myBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setActiveTab('trainees')}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-800">{b.name}</div>
                          <div className="text-xs text-gray-500 mt-1">Started {b.startMonth}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-medium">{b.program} • {b.track}</td>
                        <td className="px-6 py-4 text-gray-600 font-medium">{b.traineeCount}</td>
                        <td className="px-6 py-4 text-gray-600 font-medium">{b.avgScore !== null ? `${b.avgScore}/100` : '—'}</td>
                        <td className="px-6 py-4 w-40"><ProgressBar value={b.completion} /></td>
                        <td className="px-6 py-4 text-gray-600 font-medium">{b.attendanceRate !== null ? `${b.attendanceRate}%` : '—'}</td>
                        <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-medium w-8">
                      <input type="checkbox" checked={pagedFacilitatorAssignments.length > 0 && selectedAssignmentIds.size === pagedFacilitatorAssignments.length} onChange={toggleSelectAllAssignments} aria-label="Select all assignments" />
                    </th>
                    <th className="px-6 py-3 font-medium">Assignment</th>
                    <th className="px-6 py-3 font-medium">Batch</th>
                    <th className="px-6 py-3 font-medium">Deadline</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Grading Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {pagedFacilitatorAssignments.length === 0 && (
                    <tr><td colSpan={6}><EmptyState title="No assignments match these filters" icon="search" /></td></tr>
                  )}
                  {pagedFacilitatorAssignments.map((a) => {
                    const batch = batches.find((b) => b.id === a.batchId);
                    const gradedCount = a.submissions.filter((s) => s.status === 'Completed').length;
                    const gradedPercent = a.submissions.length > 0 ? Math.round((gradedCount / a.submissions.length) * 100) : 0;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <input type="checkbox" checked={selectedAssignmentIds.has(a.id)} onChange={() => toggleAssignmentSelected(a.id)} aria-label={`Select ${a.title}`} />
                        </td>
                        <td className="px-6 py-4 font-medium">
                          <Link
                            to={`/assignments/${a.id}`}
                            className="inline-block text-blue-600 font-medium px-2 py-1 -mx-2 rounded-full border border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors duration-150"
                          >
                            {a.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{batch?.name ?? a.batchId}</td>
                        <td className="px-6 py-4 text-gray-500">{a.deadline}</td>
                        <td className="px-6 py-4"><StatusBadge status={effectiveStatus(a)} /></td>
                        <td className="px-6 py-4 w-48">
                          <div className="text-[11px] text-gray-500 font-bold mb-1">{gradedCount}/{a.submissions.length} graded</div>
                          <ProgressBar value={gradedPercent} color="bg-blue-500" size="sm" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={assignmentPage} pageCount={assignmentPageCount} onPageChange={setAssignmentPage} totalItems={filteredFacilitatorAssignments.length} pageSize={ASSIGNMENT_PAGE_SIZE} />
            </div>
          </div>

          {/* Sessions Tab */}
          <div className={hiddenUnless('sessions')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Sessions</h2>
              <button onClick={() => setSessionModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">+ Schedule Session</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
              {sessions.map((session) => {
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
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Present</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={attendanceDraft.present}
                                    onChange={(e) => setAttendanceDraft({ ...attendanceDraft, present: e.target.value })}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Absent</label>
                                  <input
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
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase">Date</label>
                              <input
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
          </div>

          {/* Calendar Tab */}
          <div className={hiddenUnless('calendar')}>
            <h2 className="text-2xl font-bold mb-6">Session Calendar</h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {calendarDates.length === 0 ? (
                <EmptyState title="No scheduled sessions yet" message="Sessions you schedule will show up here." icon="calendar" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {calendarDates.map((date) => (
                    <div key={date} className="p-5 flex gap-6">
                      <div className="w-28 flex-shrink-0 text-sm font-bold text-gray-500">{date}</div>
                      <div className="flex-1 space-y-2">
                        {sessionsByDate[date].map((s) => {
                          const batch = batches.find((b) => b.id === s.batchId);
                          return (
                            <div key={s.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors">
                              <div>
                                <div className="font-medium text-gray-800 text-sm">{s.title} — {batch?.name ?? s.batchId}</div>
                                <div className="text-xs text-gray-500">{s.time} • {s.facilitator}</div>
                              </div>
                              <StatusBadge status={s.status} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            <h2 className="text-2xl font-bold mb-6">Feedback Management</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-1 bg-white border border-gray-200 p-6 rounded-xl shadow-sm h-fit">
                <h3 className="font-bold text-lg mb-4">Create Feedback Form</h3>
                <div className="space-y-4">
                  <select value={feedbackTrainee} onChange={(e) => setFeedbackTrainee(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none">
                    <option value="">Select Trainee</option>
                    {(aimlBatch?.members ?? []).map((name) => (
                      <option key={name} value={name}>{name}</option>
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
                  <button onClick={handleSaveFeedback} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold">Save Permanently</button>
                </div>
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
                <div className="space-y-4 divide-y">
                  {facilitatorFeedback.length === 0 && (
                    <EmptyState title="No feedback found" message="Try a different search term." icon="search" />
                  )}
                  {facilitatorFeedback.map((f) => (
                    <div key={f.id} className="pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-gray-800">{f.trainee}</span>
                        <span className="text-sm text-gray-500">{f.date} • {f.category}</span>
                      </div>
                      <div className="flex items-center mb-2">
                        <span className="text-yellow-400">{'★'.repeat(Math.round(f.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(f.rating)))}</span>
                      </div>
                      <p className="text-sm text-gray-600">{f.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Trainee Directory Tab */}
          <div className={hiddenUnless('trainees')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Trainee Directory</h2>
              <input
                type="text"
                value={traineeSearch}
                onChange={(e) => setTraineeSearch(e.target.value)}
                placeholder="Search trainees..."
                className="px-4 py-2 border rounded-lg outline-none w-64 shadow-sm"
              />
            </div>
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
                      onClick={() => navigate(ROUTES.FACILITATOR_TRAINEE_PROFILE(t.name))}
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
      </main>

      {/* Create Announcement Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${announcementModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => { setAnnouncementModalOpen(false); setAnnouncementFormError(''); }}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Create Announcement</h2>
          <div className="space-y-4">
            {announcementFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{announcementFormError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={announcementPriority} onChange={(e) => setAnnouncementPriority(e.target.value as Announcement['priority'])} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option>Normal</option>
                <option>Important</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setAnnouncementModalOpen(false); setAnnouncementFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handlePostAnnouncement} isSaving={announcementFormSaving} label="Post" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium" />
          </div>
        </div>
      </div>

      {/* Schedule Session Modal (repurposed Schedule Meeting modal) */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${sessionModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => { setSessionModalOpen(false); setSessionFormError(''); }}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Schedule Meeting</h2>
          <div className="space-y-4">
            {sessionFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sessionFormError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select
                value={newSessionBatchId || batches[0]?.id || ''}
                onChange={(e) => setNewSessionBatchId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
              <input
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
        </div>
      </div>

      {/* Create Assignment Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${assignmentModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => { setAssignmentModalOpen(false); setAssignmentFormError(''); }}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Create Assignment</h2>
          <div className="space-y-4">
            {assignmentFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{assignmentFormError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={newAssignmentTitle} onChange={(e) => setNewAssignmentTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select
                value={newAssignmentBatchId || batches[0]?.id || ''}
                onChange={(e) => setNewAssignmentBatchId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input
                type="text"
                value={newAssignmentDeadline}
                onChange={(e) => setNewAssignmentDeadline(e.target.value)}
                placeholder="e.g. Jul 20, 2026"
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newAssignmentDescription}
                onChange={(e) => setNewAssignmentDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none h-24"
              ></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setAssignmentModalOpen(false); setAssignmentFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handleCreateAssignment} isSaving={assignmentFormSaving} label="Create" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" />
          </div>
        </div>
      </div>

      {/* Upload Resource Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${resourceModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setResourceModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Upload Resource</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={newResourceTitle}
                onChange={(e) => setNewResourceTitle(e.target.value)}
                placeholder="Leave blank to use file name"
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
              <select
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
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
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
        </div>
      </div>

      {/* New Discussion Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${newThreadModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setNewThreadModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">New Discussion</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={newThreadTitle} onChange={(e) => setNewThreadTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea value={newThreadMessage} onChange={(e) => setNewThreadMessage(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none h-24"></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setNewThreadModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={handleCreateThread} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Create</button>
          </div>
        </div>
      </div>

      {/* Bulk Extend Deadline Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${extendDeadlineModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setExtendDeadlineModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold mb-1">Extend Deadline</h2>
          <p className="text-sm text-gray-500 mb-4">New deadline for {selectedAssignmentIds.size} selected assignment(s).</p>
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
        </div>
      </div>


      <ConfirmDialog
        open={deleteThreadConfirmOpen}
        title="Delete discussion?"
        message={`This will permanently remove "${selectedThread?.title ?? 'this discussion'}". This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteThread}
        onCancel={() => setDeleteThreadConfirmOpen(false)}
      />

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        danger
        onConfirm={() => {
          clearSession();
          clearSessionStorage();
          navigate(ROUTES.LOGIN);
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

    </div>
  );
}
