import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBatchesStore } from '../store/batchesStore';
import { useAssignmentsStore } from '../store/assignmentsStore';
import { useSessionsStore } from '../store/sessionsStore';
import { listBatchTraineeStats, type BatchTraineeStats } from '../services/api/batchService';
import { formatDateTime } from '../utils/dateUtils';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import Table from '../components/Table';
import EmptyState from '../components/EmptyState';
import { ROUTES } from '../constants/routes';
import { facilitatorTraineeProfileNavArgs } from '../utils/facilitatorProfileNav';
import AuthenticatedDetailLayout from '../layouts/AuthenticatedDetailLayout';

function initialsOf(name: string): string {
  return name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
}

export default function FacilitatorBatchDetailPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const { id: currentUserId } = useAuthStore();
  const batches = useBatchesStore((s) => s.batches);
  const fetchBatches = useBatchesStore((s) => s.fetchBatches);
  useEffect(() => {
    if (currentUserId) fetchBatches({ facilitatorId: currentUserId });
  }, [fetchBatches, currentUserId]);

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

  // `batches` is already scoped to this facilitator (fetchBatches({ facilitatorId }) above) — a
  // batch id belonging to someone else's roster simply won't be in this list, so it renders as
  // not-found rather than leaking that batch's existence.
  const batch = useMemo(() => batches.find((b) => b.id === batchId), [batches, batchId]);

  const upcomingSessions = useMemo(
    () => sessions.filter((s) => s.status === 'Upcoming').sort((a, b) => a.date.localeCompare(b.date)),
    [sessions]
  );

  const recentSubmissions = useMemo(
    () =>
      assignments
        .flatMap((a) => a.submissions.filter((s) => s.status !== 'Not Started').map((s) => ({ assignment: a, submission: s })))
        .filter((r) => r.submission.submittedOn)
        .sort((a, b) => b.submission.submittedOn.localeCompare(a.submission.submittedOn))
        .slice(0, 5),
    [assignments]
  );

  const attendanceTotals = useMemo(
    () =>
      sessions.reduce(
        (acc, s) => ({ present: acc.present + (s.presentCount ?? 0), absent: acc.absent + (s.absentCount ?? 0) }),
        { present: 0, absent: 0 }
      ),
    [sessions]
  );
  const attendanceTotal = attendanceTotals.present + attendanceTotals.absent;
  const attendancePercent = attendanceTotal > 0 ? Math.round((attendanceTotals.present / attendanceTotal) * 100) : null;

  function goBack() {
    navigate(ROUTES.FACILITATOR, { state: { tab: 'batches' } });
  }

  if (!batchId || !batch) {
    return (
      <AuthenticatedDetailLayout role="facilitator" activeTab="batches" headerTitle="Batch" breadcrumbTrail={['Facilitator', 'Batches']} onBack={goBack} backLabel="Back to Batches">
        <p className="text-sm text-gray-600">Batch not found.</p>
      </AuthenticatedDetailLayout>
    );
  }

  return (
    <AuthenticatedDetailLayout
      role="facilitator"
      activeTab="batches"
      headerTitle={batch.name}
      breadcrumbTrail={['Facilitator', 'Batches', batch.name]}
      onBack={goBack}
      backLabel="Back to Batches"
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <StatusBadge status={batch.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {batch.code} • {batch.program} {batch.track} • {batch.startMonth || '—'} – {batch.endDate ? formatDateTime(batch.endDate) : '—'}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Trainees" value={batch.traineeCount} valueClassName="text-3xl font-bold mt-2 text-gray-800" />
          <StatCard
            label="Assignment Completion"
            value={batch.completion !== null ? `${batch.completion}%` : '—'}
            valueClassName="text-3xl font-bold mt-2 text-gray-800"
          />
          <StatCard
            label="Attendance"
            value={batch.attendanceRate !== null ? `${batch.attendanceRate}%` : '—'}
            valueClassName="text-3xl font-bold mt-2 text-gray-800"
          />
          <StatCard
            label="Avg Performance"
            value={batch.avgScore !== null ? `${batch.avgScore}/100` : '—'}
            valueClassName="text-3xl font-bold mt-2 text-gray-800"
          />
        </div>

        {/* Trainee list */}
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
                { key: 'latest', label: 'Latest Submission' },
                { key: 'progress', label: 'Overall Progress' },
                { key: 'feedback', label: 'Feedback' }
              ]}
            >
              {trainees.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(...facilitatorTraineeProfileNavArgs(t.name, { type: 'batch', batchId: batch.id }))}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">
                        {initialsOf(t.name)}
                      </div>
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
                  <td className="px-6 py-4">{t.latestSubmissionStatus ? <StatusBadge status={t.latestSubmissionStatus} /> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4 w-40">{t.overallProgress !== null ? <ProgressBar value={t.overallProgress} /> : <span className="text-gray-400 text-sm">—</span>}</td>
                  <td className="px-6 py-4">
                    {t.feedbackGiven ? (
                      <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">Given</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded-full">None yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assignment progress */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-800">Assignment Progress</h2>
            </div>
            {assignments.length === 0 ? (
              <EmptyState title="No assignments for this batch yet" icon="inbox" />
            ) : (
              <div className="divide-y divide-gray-100">
                {assignments.map((a) => {
                  const gradedCount = a.submissions.filter((s) => s.status === 'Completed').length;
                  const gradedPercent = a.submissions.length > 0 ? Math.round((gradedCount / a.submissions.length) * 100) : 0;
                  return (
                    <div key={a.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800 text-sm">{a.title}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="text-[11px] text-gray-500 font-bold mb-1">{gradedCount}/{a.submissions.length} completed</div>
                      <ProgressBar value={gradedPercent} color="bg-blue-500" size="sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attendance summary */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-800">Attendance Summary</h2>
            </div>
            {sessions.length === 0 ? (
              <EmptyState title="No sessions recorded yet" icon="inbox" />
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-3xl font-bold text-gray-800">{attendancePercent !== null ? `${attendancePercent}%` : '—'}</div>
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wide mt-1">Overall Attendance</div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div><span className="font-bold text-green-600">{attendanceTotals.present}</span> present</div>
                    <div><span className="font-bold text-red-500">{attendanceTotals.absent}</span> absent</div>
                  </div>
                </div>
                {attendancePercent !== null && <ProgressBar value={attendancePercent} />}
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

          {/* Recent submissions */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-bold text-gray-800">Recent Submissions</h2>
            </div>
            {recentSubmissions.length === 0 ? (
              <EmptyState title="No submissions yet" icon="inbox" />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentSubmissions.map(({ assignment, submission }) => (
                  <div key={`${assignment.id}-${submission.traineeName}`} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800 text-sm">{assignment.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {submission.traineeName} • {submission.submittedOn ? formatDateTime(submission.submittedOn) : '—'}
                      </div>
                    </div>
                    <StatusBadge status={submission.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedDetailLayout>
  );
}
