import { Batch } from '../../store/batchesStore';
import { Session } from '../../store/sessionsStore';
import { Assignment } from '../../store/assignmentsStore';
import { AuditLogEntry } from '../../store/auditLogStore';
import type { ReassignmentRequest } from '../../store/reassignmentRequestsStore';
import type { AdminTabId } from '../../constants/navigation';
import Breadcrumbs from '../Breadcrumbs';
import RequiresAttentionWidget from './RequiresAttentionWidget';
import ActiveBatchesOverview from './ActiveBatchesOverview';
import RecentActivityWidget from './RecentActivityWidget';
import UpcomingDeadlinesWidget from './UpcomingDeadlinesWidget';
import QuickActionsBar from './QuickActionsBar';
import { categorize } from '../NotificationPanel';

const BATCHES_ICON =
  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
const INVITE_ICON = 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-8-1a4 4 0 100-8 4 4 0 000 8zM3 20a6 6 0 0112 0v1H3v-1z';
const TRAINING_PLANS_ICON =
  'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s4.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';
const FEEDBACK_ICON = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
const REPORTS_ICON =
  'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

interface AdminDashboardHomeProps {
  batches: Batch[];
  sessions: Session[];
  assignments: Assignment[];
  auditEntries: AuditLogEntry[];
  reassignmentRequests: ReassignmentRequest[];
  dashboardLoadTime: Date;
  onNavigateTab: (tab: AdminTabId) => void;
  onOpenCreateBatch: () => void;
  onOpenInviteTrainee: () => void;
  onOpenBatch: (batchId: string) => void;
}

// The Admin Portal's landing page -- a control center that answers "what needs my
// attention?" first, rather than a wall of equally-weighted numbers. Detailed analytics
// (the batch performance chart, avg score/completion trends) live in Reports instead.
export default function AdminDashboardHome({
  batches,
  sessions,
  assignments,
  auditEntries,
  reassignmentRequests,
  dashboardLoadTime,
  onNavigateTab,
  onOpenCreateBatch,
  onOpenInviteTrainee,
  onOpenBatch
}: AdminDashboardHomeProps) {
  const activeBatchCount = batches.filter((b) => b.status === 'Active').length;
  const activeTraineeCount = batches.reduce((sum, b) => sum + b.traineeCount, 0);
  const upcomingSessionCount = sessions.filter((s) => s.status === 'Upcoming').length;

  const tabMap: Record<string, AdminTabId> = {
    Assignment: 'assignments',
    Session: 'sessions',
    Announcement: 'announcements',
    Resource: 'resources',
    Feedback: 'feedbackForms',
    Batch: 'batches'
  };

  return (
    <div>
      <Breadcrumbs trail={['Admin', 'Dashboard']} />
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs text-gray-400 font-medium">
          Last updated {dashboardLoadTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <button
          onClick={onOpenCreateBatch}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm"
        >
          + Create Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150" onClick={() => onNavigateTab('batches')}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Batches</div>
          <div className="text-3xl font-extrabold text-gray-800 mt-1">{activeBatchCount}</div>
          <div className="mt-3 text-xs text-gray-500 font-medium">Across all programs</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150" onClick={() => onNavigateTab('batches')}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Trainees</div>
          <div className="text-3xl font-extrabold text-blue-600 mt-1">{activeTraineeCount}</div>
          <div className="mt-3 text-xs text-gray-500 font-medium">Enrolled across {batches.length} batches</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150" onClick={() => onNavigateTab('sessions')}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Upcoming Sessions</div>
          <div className="text-3xl font-extrabold text-gray-800 mt-1">{upcomingSessionCount}</div>
          <div className="mt-3 text-xs text-gray-500 font-medium">Scheduled across active batches</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Requires Attention</div>
          <div className="text-3xl font-extrabold text-amber-600 mt-1">See below</div>
          <div className="mt-3 text-xs text-gray-500 font-medium">Details in the panel underneath</div>
        </div>
      </div>

      <QuickActionsBar
        actions={[
          { label: 'Create Batch', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BATCHES_ICON} /></svg>, onClick: onOpenCreateBatch },
          { label: 'Invite Trainee', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={INVITE_ICON} /></svg>, onClick: onOpenInviteTrainee },
          { label: 'Training Plans', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={TRAINING_PLANS_ICON} /></svg>, onClick: () => onNavigateTab('trainingPlans') },
          { label: 'Create Feedback Form', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={FEEDBACK_ICON} /></svg>, onClick: () => onNavigateTab('feedbackForms') },
          { label: 'View Reports', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={REPORTS_ICON} /></svg>, onClick: () => onNavigateTab('reports') }
        ]}
      />

      <div className="mb-8">
        <RequiresAttentionWidget
          batches={batches}
          sessions={sessions}
          reassignmentRequests={reassignmentRequests}
          onOpenBatch={onOpenBatch}
          onOpenSessions={() => onNavigateTab('sessions')}
          onOpenFeedbackForms={() => onNavigateTab('feedbackForms')}
          onOpenReassignmentRequests={() => onNavigateTab('sessions')}
        />
      </div>

      <div className="mb-8">
        <ActiveBatchesOverview
          batches={batches}
          sessions={sessions}
          onOpenBatch={onOpenBatch}
          onViewSchedule={() => onNavigateTab('sessions')}
          onViewAll={() => onNavigateTab('batches')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RecentActivityWidget
          entries={auditEntries.slice(0, 8)}
          onViewAll={() => onNavigateTab('logs')}
          onItemClick={(entry) => onNavigateTab(tabMap[categorize(entry.type)] ?? 'logs')}
        />
        <UpcomingDeadlinesWidget
          assignments={assignments}
          sessions={sessions}
          batches={batches}
          onViewAssignments={() => onNavigateTab('assignments')}
          onItemClick={(item) => onNavigateTab(item.kind === 'Assignment' ? 'assignments' : 'sessions')}
        />
      </div>
    </div>
  );
}
