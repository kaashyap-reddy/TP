import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResourcesStore } from '../store/resourcesStore';
import { Session, useSessionsStore } from '../store/sessionsStore';
import { useToastStore } from '../store/toastStore';
import { useAnnouncementsStore } from '../store/announcementsStore';
import { effectiveStatus, isOverdue, useAssignmentsStore } from '../store/assignmentsStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useBatchesStore } from '../store/batchesStore';
import { useAuthStore } from '../store/authStore';
import { logout } from '../services/api/authService';
import { assignmentAttachmentUrl } from '../services/api/assignmentService';
import { submissionAttachmentUrl } from '../services/api/submissionService';
import { findFacilitatorContactByName } from '../services/api/userService';
import { getTeamsContactLink, openTeamsContact } from '../utils/teamsContact';
import * as sessionFeedbackService from '../services/api/sessionFeedbackService';
import * as assignmentFeedbackService from '../services/api/assignmentFeedbackService';
import { formatDate, formatDateTime, isRecentlyUpdated } from '../utils/dateUtils';
import { average } from '../utils/mathUtils';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useNotifications } from '../hooks/useNotifications';
import { useBaseline } from '../hooks/useBaseline';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import NotificationPanel from '../components/NotificationPanel';
import ProfileDropdown from '../components/ProfileDropdown';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import TrendIndicator from '../components/TrendIndicator';
import BarChart, { BarChartDatum } from '../components/BarChart';
import HighlightMatch from '../components/HighlightMatch';
import SavingButton from '../components/SavingButton';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import SearchInput from '../components/SearchInput';
import Table from '../components/Table';
import FileViewButton from '../components/FileViewButton';
import FeedbackCard from '../components/FeedbackCard';
import TraineeBatchFeedbackList from '../components/TraineeBatchFeedbackList';
import SessionsCalendarView from '../components/SessionsCalendarView';
import DashboardLayout from '../layouts/DashboardLayout';
import Breadcrumbs from '../components/Breadcrumbs';
import type { TraineeTabId } from '../constants/navigation';
import { TRAINEE_HEADER_TITLES, TRAINEE_BRAND_LABEL, TRAINEE_NAV_ITEMS } from '../constants/navigation';
import { PRIORITY_STYLES } from '../constants/announcements';
import { ROUTES } from '../constants/routes';

type TabId = TraineeTabId;
const HEADER_TITLES = TRAINEE_HEADER_TITLES;

export default function TraineeDashboardPage() {
  const navigate = useNavigate();
  const dashboardLoadTime = useRef(new Date()).current;
  const { id: currentUserId, displayName, clearSession } = useAuthStore();
  const { resources, fetchResources, downloadResource } = useResourcesStore();
  useEffect(() => {
    fetchResources();
  }, [fetchResources]);
  const { sessions, fetchSessions } = useSessionsStore();
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  const { showToast } = useToastStore();
  const { announcements, fetchAnnouncements, markRead } = useAnnouncementsStore();
  const { batches, fetchBatches } = useBatchesStore();
  useEffect(() => {
    // Scoped to the trainee's own batch(es) — a trainee must not see other batches' rosters.
    if (currentUserId) fetchBatches({ traineeId: currentUserId });
  }, [fetchBatches, currentUserId]);
  useEffect(() => {
    fetchAnnouncements(batches);
  }, [fetchAnnouncements, batches]);
  const { assignments, fetchAssignments, submitOwnAssignment, uploadSubmissionAttachment } = useAssignmentsStore();
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);
  const { feedback, fetchFeedback, submitFeedbackAboutFacilitator } = useFeedbackStore();
  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);
  const auditEntries = useAuditLogStore((s) => s.entries);
  const logEvent = useAuditLogStore((s) => s.logEvent);

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const markedReadRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab !== 'announcements') return;
    announcements.forEach((a) => {
      if (!markedReadRef.current.has(a.id)) {
        markedReadRef.current.add(a.id);
        markRead(a.id);
      }
    });
  }, [activeTab, announcements, markRead]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(notificationMenuRef, () => setNotificationOpen(false), notificationOpen);
  const { readLogIds, unreadCount, markNotificationRead, markAllNotificationsRead } = useNotifications(auditEntries);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Assignments / submission
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<{ assignmentId: string; batchId: string; isResubmit: boolean } | null>(null);
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitComment, setSubmitComment] = useState('');
  const [submitFormError, setSubmitFormError] = useState('');
  const [submitFormSaving, setSubmitFormSaving] = useState(false);

  // Facilitators / resources / feedback search
  const [facilitatorSearch, setFacilitatorSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceSort, setResourceSort] = useState<'newest' | 'oldest' | 'downloads' | 'alpha'>('newest');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [resourcePreview, setResourcePreview] = useState<{ title: string; category: string; uploadedBy: string; uploadedAt: string } | null>(null);

  // Give-feedback form (trainee -> facilitator)
  const [feedbackGiveFacilitatorId, setFeedbackGiveFacilitatorId] = useState('');
  const [feedbackGiveCategory, setFeedbackGiveCategory] = useState('Teaching Quality');
  const [feedbackGiveRating, setFeedbackGiveRating] = useState('');
  const [feedbackGiveComment, setFeedbackGiveComment] = useState('');
  const [feedbackGiveSaving, setFeedbackGiveSaving] = useState(false);

  // Assignments search/filter
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'All' | 'Open' | 'Closed' | 'Overdue' | 'Draft'>('All');

  // Sessions & Calendar
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'calendar'>('list');

  useEscapeKey(() => setNotificationOpen(false), notificationOpen);

  function hiddenUnless(tab: TabId) {
    return activeTab === tab ? '' : 'hidden';
  }

  const avgCompletion = average(batches.map((b) => b.completion));
  const avgScoreAll = average(batches.map((b) => b.avgScore));
  const avgAttendance = average(batches.map((b) => b.attendanceRate));
  const pendingCount = assignments.reduce((sum, a) => sum + a.submissions.filter((s) => s.status === 'Not Started').length, 0);

  const baselineCompletion = useBaseline(avgCompletion);
  const baselineScore = useBaseline(avgScoreAll);
  const baselineAttendance = useBaseline(avgAttendance);

  const batchScoreChartData: BarChartDatum[] = useMemo(
    () =>
      batches
        .filter((b) => b.avgScore !== null)
        .map((b) => ({ label: b.name, percent: b.avgScore as number, displayValue: `${b.avgScore}/100` })),
    [batches]
  );

  const filteredResources = useMemo(() => {
    const list = resources.filter((r) => r.verified && r.title.toLowerCase().includes(resourceSearch.trim().toLowerCase()));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (resourceSort === 'alpha') return a.title.localeCompare(b.title);
      if (resourceSort === 'downloads') return b.downloadCount - a.downloadCount;
      const aTime = new Date(a.uploadedAt).getTime();
      const bTime = new Date(b.uploadedAt).getTime();
      return resourceSort === 'oldest' ? aTime - bTime : bTime - aTime;
    });
    return sorted;
  }, [resources, resourceSearch, resourceSort]);

  const filteredAssignments = useMemo(() => {
    const q = assignmentSearch.trim().toLowerCase();
    return assignments.filter((a) => {
      const matchesSearch = q === '' || a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q);
      const matchesStatus = assignmentStatusFilter === 'All' || effectiveStatus(a) === assignmentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assignments, assignmentSearch, assignmentStatusFilter]);

  const filteredFeedback = useMemo(
    () =>
      feedback.filter((f) => {
        const q = feedbackSearch.trim().toLowerCase();
        return q === '' || f.trainee.toLowerCase().includes(q) || f.facilitator.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      }),
    [feedback, feedbackSearch]
  );
  // The backend already restricts a trainee's feedback list to entries where they're the
  // trainee party (either direction) — split here purely for the two display sections.
  const feedbackReceived = useMemo(() => filteredFeedback.filter((f) => f.direction !== 'TraineeToFacilitator'), [filteredFeedback]);
  const feedbackGiven = useMemo(() => filteredFeedback.filter((f) => f.direction === 'TraineeToFacilitator'), [filteredFeedback]);

  const facilitatorContacts = useMemo(
    () =>
      Array.from(new Set(batches.map((b) => b.poc).filter((name): name is string => name.trim() !== ''))).map((name) => {
        const theirBatches = batches.filter((b) => b.poc === name);
        const lastSession = sessions.filter((s) => s.facilitator === name).slice(-1)[0];
        return {
          name,
          programs: Array.from(new Set(theirBatches.map((b) => b.program))).join(', '),
          lastSession: lastSession?.title ?? 'No sessions yet'
        };
      }),
    [batches, sessions]
  );
  const filteredFacilitators = useMemo(
    () => facilitatorContacts.filter((f) => f.name.toLowerCase().includes(facilitatorSearch.trim().toLowerCase())),
    [facilitatorContacts, facilitatorSearch]
  );

  // The facilitator(s) assigned to this trainee's own batch(es) — the only people they're
  // allowed to give feedback about.
  const myFacilitators = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; batchId: string }>();
    for (const b of batches) {
      if (b.pocId && !seen.has(b.pocId)) seen.set(b.pocId, { id: b.pocId, name: b.poc, batchId: b.id });
    }
    return Array.from(seen.values());
  }, [batches]);

  const mySessions = useMemo(() => {
    const myBatchIds = new Set(batches.map((b) => b.id));
    return sessions.filter((s) => myBatchIds.has(s.batchId));
  }, [sessions, batches]);

  // Which of my completed sessions' feedback forms I've already submitted — fetched once per
  // session that has a form attached, so the "Submit Session Feedback" button can hide itself.
  const [mySubmittedFormSessionIds, setMySubmittedFormSessionIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sessionsWithForms = mySessions.filter((s) => s.status === 'Completed' && s.feedbackForm);
    Promise.all(
      sessionsWithForms.map((s) =>
        sessionFeedbackService.getSessionFeedbackForm(s.id).then((form) => (form?.mySubmitted ? s.id : null))
      )
    ).then((ids) => setMySubmittedFormSessionIds(new Set(ids.filter((id): id is string => id !== null))));
  }, [mySessions]);

  async function handleSubmitSessionFeedback(session: Session) {
    if (!session.feedbackForm) return;
    window.open(session.feedbackForm.formUrl, '_blank', 'noopener,noreferrer');
    try {
      await sessionFeedbackService.submitSessionFeedback(session.id);
      setMySubmittedFormSessionIds((prev) => new Set(prev).add(session.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to record feedback submission.', 'error');
    }
  }

  // Which of my assignments' feedback forms I've already submitted — same pattern as session
  // feedback above, but keyed by assignment id since these forms attach directly to assignments.
  const [mySubmittedFormAssignmentIds, setMySubmittedFormAssignmentIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const assignmentsWithForms = assignments.filter((a) => a.feedbackForm);
    Promise.all(
      assignmentsWithForms.map((a) =>
        assignmentFeedbackService.getAssignmentFeedbackForm(a.id).then((form) => (form?.mySubmitted ? a.id : null))
      )
    ).then((ids) => setMySubmittedFormAssignmentIds(new Set(ids.filter((id): id is string => id !== null))));
  }, [assignments]);

  async function handleSubmitAssignmentFeedback(assignment: { id: string; feedbackForm: { formUrl: string } | null }) {
    if (!assignment.feedbackForm) return;
    window.open(assignment.feedbackForm.formUrl, '_blank', 'noopener,noreferrer');
    try {
      await assignmentFeedbackService.submitAssignmentFeedback(assignment.id);
      setMySubmittedFormAssignmentIds((prev) => new Set(prev).add(assignment.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to record feedback submission.', 'error');
    }
  }

  function openSubmitModal(assignmentId: string, batchId: string, isResubmit: boolean) {
    setSubmitTarget({ assignmentId, batchId, isResubmit });
    setSubmitFile(null);
    setSubmitComment('');
    setSubmitFormError('');
    setSubmitModalOpen(true);
  }

  async function handleSubmitAssignment() {
    if (!submitTarget || submitFormSaving) return; // guards against a double-click firing two submissions
    if (!submitFile) {
      setSubmitFormError('Please choose a file to submit.');
      return;
    }
    setSubmitFormError('');
    setSubmitFormSaving(true);
    try {
      const assignment = assignments.find((a) => a.id === submitTarget.assignmentId);
      const submission = await submitOwnAssignment(submitTarget.assignmentId, submitComment || undefined);
      if (submission.id) {
        await uploadSubmissionAttachment(submitTarget.assignmentId, submission.id, submitFile);
      }
      logEvent('Submission', `${displayName ?? 'A trainee'} ${submitTarget.isResubmit ? 'resubmitted' : 'submitted'} "${assignment?.title ?? submitTarget.assignmentId}" (${submitFile.name}).`);
      showToast(submitTarget.isResubmit ? 'Submission replaced successfully!' : 'Assignment submitted successfully!');
      setSubmitModalOpen(false);
      setSubmitTarget(null);
    } catch (err) {
      setSubmitFormError(err instanceof Error ? err.message : 'Unable to submit assignment.');
    } finally {
      setSubmitFormSaving(false);
    }
  }

  // The trainee's primary Contact action -- opens Microsoft Teams, never Outlook or a mailto:
  // link (see Prompt 3, Phase 12/13). Shared by the Facilitator Contacts tab, the batch POC, and
  // every session's primary/co-trainer contact button, so behavior stays identical everywhere.
  async function handleContactViaTeams(name: string) {
    const contact = await findFacilitatorContactByName(name);
    const link = getTeamsContactLink(contact ?? { name });
    if (!link.available) {
      showToast(link.disabledReason ?? `Teams contact is not available for ${name}.`, 'error');
      return;
    }
    if (!openTeamsContact(link)) {
      showToast('Unable to open Microsoft Teams — your browser may have blocked the new tab.', 'error');
    }
  }

  async function handleGiveFeedback() {
    const facilitator = myFacilitators.find((f) => f.id === feedbackGiveFacilitatorId);
    if (!facilitator || !feedbackGiveRating) return;
    setFeedbackGiveSaving(true);
    try {
      await submitFeedbackAboutFacilitator({
        batchId: facilitator.batchId,
        facilitatorId: facilitator.id,
        category: feedbackGiveCategory,
        rating: Number(feedbackGiveRating) || 0,
        comment: feedbackGiveComment || undefined
      });
      showToast('Feedback submitted');
      logEvent('Feedback', `Submitted feedback for ${facilitator.name}.`);
      setFeedbackGiveFacilitatorId('');
      setFeedbackGiveCategory('Teaching Quality');
      setFeedbackGiveRating('');
      setFeedbackGiveComment('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit feedback.', 'error');
    } finally {
      setFeedbackGiveSaving(false);
    }
  }

  function handleJoinMeeting(session: Session) {
    if (session.link) {
      window.open(session.link, '_blank');
    } else {
      showToast('No meeting link provided yet.');
    }
  }

  return (
    <DashboardLayout
      brandLabel={TRAINEE_BRAND_LABEL}
      navItems={TRAINEE_NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={() => setLogoutConfirmOpen(true)}
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

          <ProfileDropdown role="trainee" onSignOut={() => setLogoutConfirmOpen(true)} />
        </>
      }
    >
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {/* Individual Trainee Progress Dashboard */}
          <div className={hiddenUnless('dashboard')}>
            <Breadcrumbs trail={['Trainee', 'Dashboard']} />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400 font-medium">
                Last updated {dashboardLoadTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-6">Hello, {displayName ?? 'Trainee'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-2">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path className="text-gray-200" strokeWidth={3} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-blue-600" strokeDasharray={`${avgCompletion ?? 0}, 100`} strokeWidth={3} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">{avgCompletion !== null ? `${avgCompletion}%` : '—'}</div>
                </div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Completion Rate</div>
                <div className="mt-1"><TrendIndicator current={avgCompletion} baseline={baselineCompletion} /></div>
              </div>

              <StatCard
                label="Average Score"
                value={avgScoreAll ?? '—'}
                valueSuffix={<span className="text-xl text-gray-400">/100</span>}
                trend={<TrendIndicator current={avgScoreAll} baseline={baselineScore} suffix=" pts" />}
              />

              <StatCard
                label="Pending Tasks"
                value={pendingCount}
                actionText="View Assignments"
                onClick={() => setActiveTab('assignments')}
                hoverClassName="hover:shadow-md transition"
              />

              <StatCard
                label="Attendance"
                value={avgAttendance !== null ? `${avgAttendance}%` : '—'}
                trend={<TrendIndicator current={avgAttendance} baseline={baselineAttendance} />}
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">Average Score by Batch</h3>
              {batchScoreChartData.length === 0 ? (
                <EmptyState title="No batch data yet" message="Scores will appear here once your batches have graded work." icon="inbox" />
              ) : (
                <BarChart data={batchScoreChartData} />
              )}
            </div>
          </div>

          {/* Assignments Tab */}
          <div className={hiddenUnless('assignments')}>
            <Breadcrumbs trail={['Trainee', 'Assignments']} />
            <PageHeader title="Online Assignment Tracking">
              <div className="flex items-center gap-3">
                <SearchInput value={assignmentSearch} onChange={setAssignmentSearch} placeholder="Search assignments..." ariaLabel="Search assignments" clearable />
                <select
                  value={assignmentStatusFilter}
                  onChange={(e) => setAssignmentStatusFilter(e.target.value as typeof assignmentStatusFilter)}
                  className="px-3 py-2 border rounded-lg outline-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Closed">Closed</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </PageHeader>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {filteredAssignments.length === 0 ? (
                <EmptyState title="No assignments found" message="Try adjusting your search or status filter." icon="search" />
              ) : (
                <Table
                  columns={[
                    { key: 'assignment', label: 'Assignment' },
                    { key: 'batch', label: 'Batch' },
                    { key: 'status', label: 'Status' },
                    { key: 'deadline', label: 'Deadline' },
                    { key: 'mysubmission', label: 'My Submission' },
                    { key: 'action', label: 'Action' }
                  ]}
                >
                  {filteredAssignments.map((a) => {
                    const batch = batches.find((b) => b.id === a.batchId);
                    const mySubmission = a.submissions.find((s) => s.traineeId === currentUserId);
                    const hasFile = !!mySubmission?.attachmentId;
                    const deadlinePassed = isOverdue(a);
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-800"><HighlightMatch text={a.title} query={assignmentSearch} /></div>
                          {a.description && <div className="text-xs text-gray-500 mt-1">{a.description}</div>}
                          <div className="mt-1">
                            <FileViewButton
                              url={a.attachmentFilename ? assignmentAttachmentUrl(a.id) : null}
                              fileName={a.attachmentFilename ?? undefined}
                              label="View Assignment File"
                              className="text-xs font-bold text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                            />
                          </div>
                          {a.feedbackForm && (
                            <div className="mt-1.5">
                              {mySubmittedFormAssignmentIds.has(a.id) ? (
                                <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">Feedback Submitted</span>
                              ) : (
                                <button
                                  onClick={() => handleSubmitAssignmentFeedback(a)}
                                  className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                  Submit Assignment Feedback
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-medium">{batch?.name ?? a.batchId}</td>
                        <td className="px-6 py-4"><StatusBadge status={effectiveStatus(a)} /></td>
                        <td className="px-6 py-4 text-gray-600 font-medium">
                          {formatDateTime(a.deadline)}
                          {deadlinePassed && <div className="text-[11px] text-red-500 font-bold mt-0.5">Deadline passed</div>}
                        </td>
                        <td className="px-6 py-4">
                          {hasFile ? (
                            <div>
                              <div className="text-sm text-gray-700 font-medium truncate max-w-[10rem]">{mySubmission!.attachmentFilename}</div>
                              <div className="text-xs text-gray-400">{mySubmission!.submittedOn ? formatDateTime(mySubmission!.submittedOn) : ''}</div>
                              <StatusBadge status={mySubmission!.status} />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Not submitted</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            {hasFile && (
                              <FileViewButton
                                url={submissionAttachmentUrl(mySubmission!.id!, mySubmission!.attachmentId!)}
                                fileName={mySubmission!.attachmentFilename}
                                label="View Submission"
                                className="text-xs font-bold text-blue-600 hover:underline"
                              />
                            )}
                            <button
                              onClick={() => openSubmitModal(a.id, a.batchId, hasFile)}
                              disabled={hasFile && deadlinePassed}
                              title={hasFile && deadlinePassed ? 'The deadline has passed — this submission can no longer be replaced.' : undefined}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                            >
                              {hasFile ? 'Resubmit' : 'Submit Work'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              )}
            </div>
          </div>

          {/* Batches Tab */}
          <div className={hiddenUnless('batches')}>
            <Breadcrumbs trail={['Trainee', 'My Batch']} />
            <h2 className="text-2xl font-bold mb-6">My Batch</h2>
            {batches.length === 0 ? (
              <EmptyState title="You're not enrolled in a batch yet" message="Once you're added to a batch, it will show up here." icon="inbox" />
            ) : (
              <div className="space-y-8">
                {batches.map((b, index) => {
                  // No backend concept of a "primary batch" exists yet when a trainee is enrolled
                  // in more than one — the scoped fetch above returns this trainee's original/
                  // earliest enrollment first, so that's used as the current-batch signal here.
                  const isCurrent = index === 0;
                  return (
                  <div
                    key={b.id}
                    className={
                      isCurrent
                        ? 'bg-blue-50/60 border-2 border-blue-200 rounded-xl shadow-md overflow-hidden'
                        : 'bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden'
                    }
                  >
                    <div className={`p-6 border-b flex items-start justify-between flex-wrap gap-3 ${isCurrent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div>
                        {isCurrent && (
                          <span className="inline-block mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                            My Current Batch
                          </span>
                        )}
                        <h3 className="text-xl font-bold text-gray-800">{b.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{b.program} • {b.track}</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-gray-100">
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Facilitator</div>
                        <div className="text-gray-800 font-medium mt-1">{b.poc || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Start Date</div>
                        <div className="text-gray-800 font-medium mt-1">{b.startDate ? formatDate(b.startDate) : b.startMonth || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">End Date</div>
                        <div className="text-gray-800 font-medium mt-1">{b.endDate ? formatDate(b.endDate) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Completion</div>
                        <div className="text-gray-800 font-medium mt-1">{b.completion !== null ? `${b.completion}%` : '—'}</div>
                      </div>
                    </div>
                    <TraineeBatchFeedbackList batchId={b.id} />
                    <div className="p-6">
                      <h4 className="text-sm font-bold text-gray-700 mb-3">Other Trainees in This Batch ({b.members.length})</h4>
                      {b.members.length === 0 ? (
                        <p className="text-sm text-gray-400">No other trainees enrolled yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {b.members.map((name) => (
                            <div key={name} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm text-gray-700 truncate">{name}</span>
                            </div>
                          ))}
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
            <Breadcrumbs trail={['Trainee', 'Announcements']} />
            <h2 className="text-2xl font-bold mb-6">Announcements</h2>
            <div className="space-y-4">
              {announcements.length === 0 && (
                <EmptyState title="No announcements yet" message="Announcements from your facilitator will show up here." icon="inbox" />
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

          {/* Sessions & Calendar Tab */}
          <div className={hiddenUnless('sessions')}>
            <Breadcrumbs trail={['Trainee', 'Sessions & Calendar']} />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Sessions & Calendar</h2>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
                <button onClick={() => setSessionViewMode('list')} className={`px-3 py-2 transition-colors ${sessionViewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>List</button>
                <button onClick={() => setSessionViewMode('calendar')} className={`px-3 py-2 transition-colors ${sessionViewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Calendar</button>
              </div>
            </div>
            {sessionViewMode === 'calendar' ? (
              <SessionsCalendarView />
            ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {mySessions.length === 0 ? (
                <EmptyState title="No sessions scheduled" message="Sessions your facilitator schedules will show up here." icon="calendar" />
              ) : (
                <div className="p-6 space-y-4">
                  {mySessions.map((session) => {
                    const isUpcoming = session.status === 'Upcoming';
                    const [month, day] = session.date.split(' ');
                    const dayNumber = (day || '').replace(',', '');
                    return (
                      <div
                        key={session.id}
                        className={
                          isUpcoming
                            ? 'flex items-start p-4 border border-l-4 border-l-blue-500 rounded-lg bg-blue-50/50 hover:shadow-sm transition-shadow'
                            : 'flex items-start p-4 border rounded-lg hover:bg-gray-50 transition-colors'
                        }
                      >
                        <div
                          className={
                            isUpcoming
                              ? 'bg-white p-2 rounded-lg text-center shadow-sm border border-gray-100 mr-4 w-16 flex-shrink-0'
                              : 'bg-gray-100 p-2 rounded-lg text-center border border-gray-200 mr-4 w-16 flex-shrink-0'
                          }
                        >
                          <div className={isUpcoming ? 'text-xs font-bold text-gray-500 uppercase' : 'text-xs font-bold text-gray-400 uppercase'}>{month}</div>
                          <div className={isUpcoming ? 'text-xl font-bold text-gray-800' : 'text-xl font-bold text-gray-500'}>{dayNumber}</div>
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{session.title}</div>
                          <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>{session.time} • Facilitator: {(session.primaryTrainerName ?? session.facilitator) || '—'}</span>
                            {session.guestTrainer || !(session.primaryTrainerName ?? session.facilitator) ? (
                              <span
                                title={session.guestTrainer ? 'Teams contact is not available for this trainer.' : 'No trainer assigned to this session yet.'}
                                className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5 select-none"
                              >
                                Contact unavailable
                              </span>
                            ) : (
                              <button
                                onClick={() => handleContactViaTeams(session.primaryTrainerName ?? session.facilitator)}
                                title="Opens Microsoft Teams"
                                className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded px-2 py-0.5"
                              >
                                Contact
                              </button>
                            )}
                            {session.coTrainers.map((ct) => (
                              <button
                                key={ct.id}
                                onClick={() => handleContactViaTeams(ct.name)}
                                title={`Opens Microsoft Teams — co-trainer ${ct.name}`}
                                className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded px-2 py-0.5"
                              >
                                Contact {ct.name.split(' ')[0]} (co-trainer)
                              </button>
                            ))}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Assignment: {session.relatedAssignmentTitle ?? '—'}</div>
                          {isUpcoming && (
                            <button onClick={() => handleJoinMeeting(session)} className="mt-2 text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">Join Meeting</button>
                          )}
                          {session.status === 'Completed' && (
                            session.feedbackForm ? (
                              mySubmittedFormSessionIds.has(session.id) ? (
                                <span className="mt-2 inline-block text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">Feedback Submitted</span>
                              ) : (
                                <button
                                  onClick={() => handleSubmitSessionFeedback(session)}
                                  className="mt-2 text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  Submit Session Feedback
                                </button>
                              )
                            ) : (
                              <span className="mt-2 inline-block text-xs text-gray-400">Session Feedback: Not available</span>
                            )
                          )}
                        </div>
                        <StatusBadge status={session.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Facilitators Directory Tab */}
          <div className={hiddenUnless('facilitators')}>
            <Breadcrumbs trail={['Trainee', 'Facilitators']} />
            <PageHeader title="Facilitator Contacts" wrap={false}>
              <SearchInput value={facilitatorSearch} onChange={setFacilitatorSearch} placeholder="Search facilitators..." />
            </PageHeader>
            {filteredFacilitators.length === 0 && (
              <EmptyState title="No facilitators found" message="Try a different search term." icon="search" />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {filteredFacilitators.map((f) => (
                <div key={f.name} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
                  <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold mb-4">
                    {f.name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-bold text-gray-800">{f.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{f.programs}</p>
                  <p className="text-xs text-gray-400 mt-2">Last session: {f.lastSession}</p>
                  <button
                    onClick={() => handleContactViaTeams(f.name)}
                    title="Opens Microsoft Teams"
                    className="mt-4 w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Contact on Teams
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Resource Library Tab */}
          <div className={hiddenUnless('resources')}>
            <Breadcrumbs trail={['Trainee', 'Resources']} />
            <PageHeader title="Learning Repository">
              <div className="flex items-center gap-3">
                <SearchInput value={resourceSearch} onChange={setResourceSearch} placeholder="Search materials..." ariaLabel="Search materials" clearable />
                <select
                  value={resourceSort}
                  onChange={(e) => setResourceSort(e.target.value as typeof resourceSort)}
                  aria-label="Sort resources"
                  className="px-3 py-2 border rounded-lg outline-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="downloads">Most Downloaded</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </div>
            </PageHeader>
            {filteredResources.length === 0 ? (
              <EmptyState title="No resources found" message="Try a different search term." icon="search" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredResources.map((resource) => {
                  const isVideo = resource.category.includes('Video');
                  return (
                    <div key={resource.id} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-4">
                        <div className={isVideo ? 'w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center' : 'w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center'}>
                          {isVideo ? (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                          ) : (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                          )}
                        </div>
                        {isRecentlyUpdated(resource.lastUpdated) && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">Recently Updated</span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1"><HighlightMatch text={resource.title} query={resourceSearch} /></h3>
                      <p className="text-xs text-gray-500 mb-1">Uploaded by {resource.uploadedBy} • {resource.uploadedAt}</p>
                      <p className="text-xs text-gray-400 mb-4">{resource.fileSize} • {resource.downloadCount} downloads</p>
                      <button
                        onClick={() => { downloadResource(resource.id); setResourcePreview(resource); }}
                        className="w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        {isVideo ? 'Watch Now' : 'Download'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grades & Feedback Tab */}
          <div className={hiddenUnless('grades')}>
            <Breadcrumbs trail={['Trainee', 'My Session Feedback']} />
            <PageHeader title="My Session Feedback" wrap={false} />

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-10">
              <div className="p-6 space-y-3">
                {mySessions.filter((s) => s.feedbackForm).length === 0 ? (
                  <EmptyState title="No session feedback forms yet" message="Forms appear here once your facilitator attaches them to a session." icon="inbox" />
                ) : (
                  mySessions
                    .filter((s) => s.feedbackForm)
                    .map((s) => {
                      const submitted = mySubmittedFormSessionIds.has(s.id);
                      return (
                        <div key={s.id} className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-800">{s.title}</div>
                            <div className="text-xs text-gray-400">{s.date}</div>
                          </div>
                          {submitted ? (
                            <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">Submitted</span>
                          ) : (
                            <button
                              onClick={() => handleSubmitSessionFeedback(s)}
                              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Open Feedback Form
                            </button>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-500 mb-1">Facilitator Feedback</h2>
            <p className="text-gray-400 text-sm mb-6">Ratings about/from your facilitator — unrelated to Session Feedback above.</p>
            <SearchInput value={feedbackSearch} onChange={setFeedbackSearch} placeholder="Search feedback..." />

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8 mt-4">
              <h3 className="font-bold text-lg mb-4">Give Feedback to Facilitator</h3>
              {myFacilitators.length === 0 ? (
                <EmptyState title="No facilitator assigned yet" message="You'll be able to give feedback once you're enrolled in a batch." icon="inbox" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={feedbackGiveFacilitatorId}
                    onChange={(e) => setFeedbackGiveFacilitatorId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
                  >
                    <option value="">Select Facilitator</option>
                    {myFacilitators.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <select value={feedbackGiveCategory} onChange={(e) => setFeedbackGiveCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                    <option value="Teaching Quality">Category: Teaching Quality</option>
                    <option value="Responsiveness">Category: Responsiveness</option>
                    <option value="Overall Experience">Category: Overall Experience</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={feedbackGiveRating}
                    onChange={(e) => setFeedbackGiveRating(e.target.value)}
                    placeholder="Rating 1-5"
                    className="w-full px-3 py-2 border rounded-lg outline-none"
                  />
                  <div className="md:col-span-2">
                    <textarea
                      value={feedbackGiveComment}
                      onChange={(e) => setFeedbackGiveComment(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg outline-none h-24"
                      placeholder="Share your experience..."
                    ></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <SavingButton
                      onClick={handleGiveFeedback}
                      isSaving={feedbackGiveSaving}
                      disabled={!feedbackGiveFacilitatorId || !feedbackGiveRating}
                      label="Submit Feedback"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-bold text-lg">Feedback You Submitted</h3>
                </div>
                <div className="p-6 space-y-3">
                  {feedbackGiven.length === 0 ? (
                    <EmptyState title="No feedback submitted yet" icon="inbox" />
                  ) : (
                    feedbackGiven.map((f) => <FeedbackCard key={f.id} entry={f} />)
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-bold text-lg">Feedback Received</h3>
                </div>
                <div className="p-6 space-y-3">
                  {feedbackReceived.length === 0 ? (
                    <EmptyState title="No feedback found" message="Try a different search term." icon="search" />
                  ) : (
                    feedbackReceived.map((f) => <FeedbackCard key={f.id} entry={f} />)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Submit Assignment Modal */}
      <Modal
        open={submitModalOpen}
        onClose={() => { setSubmitModalOpen(false); setSubmitFormError(''); }}
        title={submitTarget?.isResubmit ? 'Replace Submission' : 'Submit Assignment'}
        subtitle="You can replace your submission before the deadline."
        maxWidth="md"
      >
          <div className="space-y-4">
            {submitFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitFormError}</div>
            )}
            <div>
              <label htmlFor="trainee-submit-file" className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
              <input
                id="trainee-submit-file"
                type="file"
                onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {submitFile && <p className="text-xs text-gray-500 mt-1">{submitFile.name}</p>}
            </div>
            <div>
              <label htmlFor="trainee-submit-comment" className="block text-sm font-medium text-gray-700 mb-1">Comments (Optional)</label>
              <textarea
                id="trainee-submit-comment"
                value={submitComment}
                onChange={(e) => setSubmitComment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                placeholder="Any notes for the facilitator?"
              ></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setSubmitModalOpen(false); setSubmitFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handleSubmitAssignment} isSaving={submitFormSaving} label={submitTarget?.isResubmit ? 'Replace Submission' : 'Submit'} />
          </div>
      </Modal>

      {/* Resource Preview Modal */}
      <Modal open={resourcePreview !== null} onClose={() => setResourcePreview(null)} maxWidth="sm">
          <h2 className="text-lg font-bold mb-2">{resourcePreview?.title}</h2>
          <div className="text-sm text-gray-600 space-y-1 mb-4">
            <div>Category: {resourcePreview?.category}</div>
            <div>Uploaded by: {resourcePreview?.uploadedBy}</div>
            <div>Uploaded on: {resourcePreview?.uploadedAt}</div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            File storage isn't connected in this environment, so this resource can't be downloaded yet.
          </p>
          <div className="flex justify-end">
            <button onClick={() => setResourcePreview(null)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Close</button>
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
