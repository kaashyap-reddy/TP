import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResourcesStore } from '../store/resourcesStore';
import { Session, useSessionsStore } from '../store/sessionsStore';
import { useToastStore } from '../store/toastStore';
import { Announcement, useAnnouncementsStore } from '../store/announcementsStore';
import { effectiveStatus, useAssignmentsStore } from '../store/assignmentsStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useBatchesStore } from '../store/batchesStore';
import { useDiscussionsStore } from '../store/discussionsStore';
import { useAuthStore } from '../store/authStore';
import { clearSessionStorage } from '../lib/authSession';
import { isRecentlyUpdated } from '../lib/dateUtils';
import { average } from '../lib/mathUtils';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useNotifications } from '../hooks/useNotifications';
import ConfirmDialog from '../components/ConfirmDialog';
import NotificationPanel from '../components/NotificationPanel';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import TrendIndicator from '../components/TrendIndicator';
import BarChart, { BarChartDatum } from '../components/BarChart';
import HighlightMatch from '../components/HighlightMatch';
import SavingButton from '../components/SavingButton';

const PRIORITY_STYLES: Record<Announcement['priority'], { border: string; badge: string }> = {
  Critical: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700' },
  Important: { border: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700' },
  Normal: { border: 'border-l-gray-300', badge: 'bg-gray-100 text-gray-600' }
};

type TabId =
  | 'dashboard'
  | 'assignments'
  | 'discussions'
  | 'resources'
  | 'calendar'
  | 'grades'
  | 'announcements'
  | 'meetings'
  | 'facilitators';

const HEADER_TITLES: Record<TabId, string> = {
  dashboard: 'My Progress & Analytics',
  assignments: 'Online Assignment Tracking',
  discussions: 'Communication Hub',
  announcements: 'Announcements',
  meetings: 'Upcoming Sessions',
  facilitators: 'Facilitator Contacts',
  resources: 'Learning Repository',
  calendar: 'Assignment Calendar',
  grades: 'Historical Feedback & Grades'
};

const navItemClass = (active: boolean) =>
  active
    ? 'flex items-center px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-medium shadow-sm'
    : 'flex items-center px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg font-medium';

export default function TraineeDashboardPage() {
  const navigate = useNavigate();
  const { resources, incrementDownloadCount } = useResourcesStore();
  const { sessions } = useSessionsStore();
  const { showToast } = useToastStore();
  const { announcements, markRead } = useAnnouncementsStore();
  const { batches } = useBatchesStore();
  const { assignments, updateSubmission } = useAssignmentsStore();
  const { feedback } = useFeedbackStore();
  const auditEntries = useAuditLogStore((s) => s.entries);
  const logEvent = useAuditLogStore((s) => s.logEvent);
  const threads = useDiscussionsStore((s) => s.threads);
  const createThread = useDiscussionsStore((s) => s.createThread);
  const addMessage = useDiscussionsStore((s) => s.addMessage);
  const { email: authEmail, displayName, updateDisplayName, clearSession } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const markedReadRef = useRef<Set<string>>(new Set());
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(displayName ?? '');

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
  useClickOutside(profileMenuRef, () => setProfileOpen(false), profileOpen);
  const { readLogIds, notificationEntries, unreadCount, markNotificationRead, markAllNotificationsRead } = useNotifications(auditEntries);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Assignments / submission
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<{ assignmentId: string; batchId: string } | null>(null);
  const [submitTraineeName, setSubmitTraineeName] = useState('');
  const [submitFileName, setSubmitFileName] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [submitFormError, setSubmitFormError] = useState('');
  const [submitFormSaving, setSubmitFormSaving] = useState(false);

  // Facilitators / resources / feedback search
  const [facilitatorSearch, setFacilitatorSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceSort, setResourceSort] = useState<'newest' | 'oldest' | 'downloads' | 'alpha'>('newest');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [resourcePreview, setResourcePreview] = useState<{ title: string; category: string; uploadedBy: string; uploadedAt: string } | null>(null);

  // Assignments search/filter
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'All' | 'Open' | 'Closed' | 'Overdue' | 'Draft'>('All');

  // Discussions
  const [threadSearch, setThreadSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threads[0]?.id ?? null);
  const [replyText, setReplyText] = useState('');
  const [newThreadModalOpen, setNewThreadModalOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');

  useEscapeKey(() => { setSubmitModalOpen(false); setSubmitFormError(''); }, submitModalOpen);
  useEscapeKey(() => setNewThreadModalOpen(false), newThreadModalOpen);
  useEscapeKey(() => setResourcePreview(null), resourcePreview !== null);
  useEscapeKey(() => setNotificationOpen(false), notificationOpen);
  useEscapeKey(() => setProfileOpen(false), profileOpen);
  useEscapeKey(() => setAccountSettingsOpen(false), accountSettingsOpen);

  function hiddenUnless(tab: TabId) {
    return activeTab === tab ? '' : 'hidden';
  }

  const avgCompletion = average(batches.map((b) => b.completion));
  const avgScoreAll = average(batches.map((b) => b.avgScore));
  const avgAttendance = average(batches.map((b) => b.attendanceRate));
  const pendingCount = assignments.reduce((sum, a) => sum + a.submissions.filter((s) => s.status === 'Not Started').length, 0);

  const baselineCompletion = useRef(avgCompletion).current;
  const baselineScore = useRef(avgScoreAll).current;
  const baselineAttendance = useRef(avgAttendance).current;

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

  const facilitatorContacts = useMemo(
    () =>
      Array.from(new Set(batches.map((b) => b.poc))).map((name) => {
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

  function saveAccountSettings() {
    if (!displayNameDraft.trim()) return;
    updateDisplayName(displayNameDraft.trim());
    showToast('Account settings updated');
    setAccountSettingsOpen(false);
  }

  function openSubmitModal(assignmentId: string, batchId: string) {
    setSubmitTarget({ assignmentId, batchId });
    setSubmitTraineeName('');
    setSubmitFileName('');
    setSubmitComment('');
    setSubmitModalOpen(true);
  }

  function handleSubmitAssignment() {
    if (!submitTarget || !submitTraineeName) {
      setSubmitFormError('Please select your name before submitting.');
      return;
    }
    setSubmitFormError('');
    setSubmitFormSaving(true);
    setTimeout(() => {
      const assignment = assignments.find((a) => a.id === submitTarget.assignmentId);
      const isLate = assignment ? new Date() > new Date(assignment.deadline) : false;
      updateSubmission(submitTarget.assignmentId, submitTraineeName, {
        status: isLate ? 'Late' : 'Under Review',
        submittedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        feedback: submitComment
      });
      logEvent('Submission', `${submitTraineeName} submitted "${assignment?.title ?? submitTarget.assignmentId}"${submitFileName ? ` (${submitFileName})` : ''}.`);
      showToast('Assignment submitted successfully!');
      setSubmitModalOpen(false);
      setSubmitFormSaving(false);
    }, 400);
  }

  function handleContactFacilitator(name: string) {
    const batch = batches.find((b) => b.poc === name);
    const thread = createThread({
      title: `Question for ${name}`,
      batchId: batch?.id ?? batches[0]?.id ?? '',
      author: displayName ?? 'Trainee',
      role: 'trainee',
      message: `Hi ${name}, I had a question and wanted to start a conversation here.`
    });
    setSelectedThreadId(thread.id);
    setActiveTab('discussions');
    showToast(`Discussion started with ${name}`);
  }

  function handleCreateThread() {
    if (!newThreadTitle.trim()) return;
    const thread = createThread({
      title: newThreadTitle.trim(),
      batchId: batches[0]?.id ?? '',
      author: displayName ?? 'Trainee',
      role: 'trainee',
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
    addMessage(selectedThread.id, { author: displayName ?? 'Trainee', role: 'trainee', text: replyText.trim() });
    setReplyText('');
  }

  function handleJoinMeeting(session: Session) {
    if (session.link) {
      window.open(session.link, '_blank');
    } else {
      showToast('No meeting link provided yet.');
    }
  }

  return (
    <div className="flex h-screen overflow-hidden text-gray-800" style={{ backgroundColor: '#f8fafc' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-lg font-bold text-blue-600">My Workspace</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }} className={navItemClass(activeTab === 'dashboard')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            My Progress
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
            Learning Repository
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('calendar'); }} className={navItemClass(activeTab === 'calendar')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Calendar & Events
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('grades'); }} className={navItemClass(activeTab === 'grades')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Feedback & Grades
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('announcements'); }} className={navItemClass(activeTab === 'announcements')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            Announcements
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('meetings'); }} className={navItemClass(activeTab === 'meetings')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Sessions
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('facilitators'); }} className={navItemClass(activeTab === 'facilitators')}>
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 100-8 4 4 0 000 8zm8 0a4 4 0 100-8 4 4 0 000 8z" /></svg>
            Facilitators
          </a>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button onClick={() => setLogoutConfirmOpen(true)} className="flex items-center px-4 py-2 text-gray-600 hover:text-red-600 transition-colors w-full">
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

            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileOpen((open) => !open)}
                className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-inner hover:ring-2 hover:ring-blue-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                {(displayName ?? 'U').charAt(0).toUpperCase()}
              </button>
              <div className={`${profileOpen ? '' : 'hidden'} absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden`}>
                <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 px-5 py-5 text-white relative overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full"></div>
                  <div className="flex items-center space-x-3 relative z-10">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold ring-2 ring-white/30">
                      {(displayName ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-base">{displayName ?? 'Trainee'}</div>
                      <div className="text-blue-100 text-xs">Trainee</div>
                      <div className="mt-1.5 inline-flex items-center gap-1 bg-white/15 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        Active now
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center gap-2 text-xs uppercase font-bold tracking-wide">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      Email
                    </span>
                    <span className="font-medium text-gray-800">{authEmail ?? 'trainee@company.com'}</span>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-1">
                  <button
                    onClick={() => {
                      setDisplayNameDraft(displayName ?? '');
                      setAccountSettingsOpen(true);
                      setProfileOpen(false);
                    }}
                    className="block w-full text-center py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                  >
                    Account Settings
                  </button>
                  <button onClick={() => setLogoutConfirmOpen(true)} className="block w-full text-center py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {/* Individual Trainee Progress Dashboard */}
          <div className={hiddenUnless('dashboard')}>
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

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Average Score</div>
                <div className="text-4xl font-bold mt-2 text-gray-800">{avgScoreAll ?? '—'}<span className="text-xl text-gray-400">/100</span></div>
                <div className="mt-2"><TrendIndicator current={avgScoreAll} baseline={baselineScore} suffix=" pts" /></div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('assignments')}>
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Pending Tasks</div>
                <div className="text-4xl font-bold mt-2 text-gray-800">{pendingCount}</div>
                <div className="text-yellow-500 text-sm mt-2 font-medium">View Assignments</div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">Attendance</div>
                <div className="text-4xl font-bold mt-2 text-gray-800">{avgAttendance !== null ? `${avgAttendance}%` : '—'}</div>
                <div className="mt-2"><TrendIndicator current={avgAttendance} baseline={baselineAttendance} /></div>
              </div>
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
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
              <h2 className="text-2xl font-bold">Online Assignment Tracking</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    placeholder="Search assignments..."
                    aria-label="Search assignments"
                    className="px-4 py-2 border rounded-lg outline-none w-64 shadow-sm focus:ring-2 focus:ring-blue-500"
                  />
                  {assignmentSearch && (
                    <button
                      onClick={() => setAssignmentSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
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
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {filteredAssignments.length === 0 ? (
                <EmptyState title="No assignments found" message="Try adjusting your search or status filter." icon="search" />
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">Assignment</th>
                      <th className="px-6 py-3 font-medium">Batch</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Deadline</th>
                      <th className="px-6 py-3 font-medium">Submissions</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {filteredAssignments.map((a) => {
                      const batch = batches.find((b) => b.id === a.batchId);
                      const completed = a.submissions.filter((s) => s.status === 'Completed').length;
                      return (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-800"><HighlightMatch text={a.title} query={assignmentSearch} /></div>
                            {a.description && <div className="text-xs text-gray-500 mt-1">{a.description}</div>}
                          </td>
                          <td className="px-6 py-4 text-gray-600 font-medium">{batch?.name ?? a.batchId}</td>
                          <td className="px-6 py-4"><StatusBadge status={effectiveStatus(a)} /></td>
                          <td className="px-6 py-4 text-gray-600 font-medium">{a.deadline}</td>
                          <td className="px-6 py-4"><span className="text-blue-600 font-medium">{completed} / {a.submissions.length}</span></td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => openSubmitModal(a.id, a.batchId)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-colors"
                            >
                              Submit Work
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Discussions Tab */}
          <div className={`${hiddenUnless('discussions')} flex h-full border border-gray-200 rounded-xl shadow-sm bg-white overflow-hidden`}>
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <button onClick={() => setNewThreadModalOpen(true)} className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700">+ New Discussion</button>
                <input
                  type="text"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search discussions..."
                  className="w-full mt-3 px-3 py-2 border rounded-lg outline-none text-sm"
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
                    <p className="text-xs text-gray-500 mt-1">{t.author} • {t.messages.length} {t.messages.length === 1 ? 'reply' : 'replies'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-2/3 flex flex-col bg-gray-50">
              {!selectedThread ? (
                <div className="flex-1 p-8 flex items-center justify-center text-gray-400">
                  Select a thread to view full conversation history.
                </div>
              ) : (
                <>
                  <div className="p-6 border-b border-gray-200 bg-white">
                    <h3 className="text-xl font-bold">{selectedThread.title}</h3>
                    <div className="text-sm text-gray-500 mt-1">Started by {selectedThread.author} • {selectedThread.createdAt}</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                        placeholder="Type your reply..."
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

          {/* Announcements Tab */}
          <div className={hiddenUnless('announcements')}>
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

          {/* Meetings Tab */}
          <div className={hiddenUnless('meetings')}>
            <h2 className="text-2xl font-bold mb-6">Upcoming Sessions</h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {sessions.length === 0 ? (
                <EmptyState title="No sessions scheduled" message="Sessions your facilitator schedules will show up here." icon="calendar" />
              ) : (
                <div className="p-6 space-y-4">
                  {sessions.map((session) => {
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
                          <div className="text-sm text-gray-500 mt-1">{session.time} • Facilitator: {session.facilitator}</div>
                          {isUpcoming && (
                            <button onClick={() => handleJoinMeeting(session)} className="mt-2 text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">Join Meeting</button>
                          )}
                        </div>
                        <StatusBadge status={session.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Facilitators Directory Tab */}
          <div className={hiddenUnless('facilitators')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Facilitator Contacts</h2>
              <input
                type="text"
                value={facilitatorSearch}
                onChange={(e) => setFacilitatorSearch(e.target.value)}
                placeholder="Search facilitators..."
                className="px-4 py-2 border rounded-lg outline-none w-64 shadow-sm"
              />
            </div>
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
                  <button onClick={() => handleContactFacilitator(f.name)} className="mt-4 w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100">Contact</button>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Resource Library Tab */}
          <div className={hiddenUnless('resources')}>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
              <h2 className="text-2xl font-bold">Learning Repository</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    placeholder="Search materials..."
                    aria-label="Search materials"
                    className="px-4 py-2 border rounded-lg outline-none w-64 shadow-sm focus:ring-2 focus:ring-blue-500"
                  />
                  {resourceSearch && (
                    <button
                      onClick={() => setResourceSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
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
            </div>
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
                        onClick={() => { incrementDownloadCount(resource.id); setResourcePreview(resource); }}
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

          {/* Calendar Tab */}
          <div className={hiddenUnless('calendar')}>
            <h2 className="text-2xl font-bold mb-6">Assignment & Event Calendar</h2>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {calendarDates.length === 0 ? (
                <EmptyState title="No scheduled sessions yet" message="Sessions your facilitator schedules will show up here." icon="calendar" />
              ) : (
                <div className="divide-y divide-gray-100">
                  {calendarDates.map((date) => (
                    <div key={date} className="p-5 flex gap-6">
                      <div className="w-28 flex-shrink-0 text-sm font-bold text-gray-500">{date}</div>
                      <div className="flex-1 space-y-2">
                        {sessionsByDate[date].map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleJoinMeeting(s)}
                            className="w-full flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 hover:bg-gray-100 hover:shadow-sm transition text-left"
                          >
                            <div>
                              <div className="font-medium text-gray-800 text-sm">{s.title}</div>
                              <div className="text-xs text-gray-500">{s.time} • {s.facilitator}</div>
                            </div>
                            <StatusBadge status={s.status} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grades & Feedback Tab */}
          <div className={hiddenUnless('grades')}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Historical Feedback & Grades</h2>
              <input
                type="text"
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
                placeholder="Search feedback..."
                className="px-4 py-2 border rounded-lg outline-none w-64 shadow-sm"
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-lg">Facilitator Feedback History</h3>
              </div>
              <div className="p-6 space-y-6">
                {filteredFeedback.length === 0 && (
                  <EmptyState title="No feedback found" message="Try a different search term." icon="search" />
                )}
                {filteredFeedback.map((f) => (
                  <div key={f.id} className="border border-gray-200 rounded-lg p-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">{f.trainee}</h4>
                        <p className="text-sm text-gray-500 mt-1">Reviewed by {f.facilitator} • {f.category}</p>
                      </div>
                      <div className="bg-green-100 text-green-800 font-bold px-4 py-2 rounded-lg text-xl">{f.rating}/5</div>
                    </div>
                    {f.comment && (
                      <div className="bg-gray-50 p-4 rounded-lg mt-3 text-sm text-gray-700 italic border border-gray-100">"{f.comment}"</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit Assignment Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${submitModalOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => { setSubmitModalOpen(false); setSubmitFormError(''); }}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-1">Submit Assignment</h2>
          <p className="text-sm text-gray-500 mb-4">You can replace your submission before the deadline.</p>
          <div className="space-y-4">
            {submitFormError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitFormError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <select
                value={submitTraineeName}
                onChange={(e) => setSubmitTraineeName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                <option value="">Select your name</option>
                {(batches.find((b) => b.id === submitTarget?.batchId)?.members ?? []).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload File (.zip, .pdf)</label>
              <input
                type="file"
                onChange={(e) => setSubmitFileName(e.target.files?.[0]?.name ?? '')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments (Optional)</label>
              <textarea
                value={submitComment}
                onChange={(e) => setSubmitComment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                placeholder="Any notes for the facilitator?"
              ></textarea>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => { setSubmitModalOpen(false); setSubmitFormError(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <SavingButton onClick={handleSubmitAssignment} isSaving={submitFormSaving} label="Submit" />
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

      {/* Resource Preview Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${resourcePreview ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setResourcePreview(null)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
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
        </div>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        danger
        onConfirm={() => {
          clearSession();
          clearSessionStorage();
          navigate('/');
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      {/* Account Settings Modal */}
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${accountSettingsOpen ? 'flex' : 'hidden'} items-center justify-center z-50`} role="dialog" aria-modal="true" onClick={() => setAccountSettingsOpen(false)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold mb-4">Account Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={authEmail ?? ''} readOnly className="w-full px-3 py-2 border rounded-lg outline-none bg-gray-50 text-gray-500" />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setAccountSettingsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
            <button onClick={saveAccountSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
