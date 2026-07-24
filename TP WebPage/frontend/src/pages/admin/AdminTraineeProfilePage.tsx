import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useBatchesStore } from '../../store/batchesStore';
import { useAssignmentsStore } from '../../store/assignmentsStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { listBatchTraineeStats, type BatchTraineeStats } from '../../services/api/batchService';
import { formatDateTime } from '../../utils/dateUtils';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import Table from '../../components/Table';
import EmptyState from '../../components/EmptyState';
import { ROUTES } from '../../constants/routes';
import AuthenticatedDetailLayout from '../../layouts/AuthenticatedDetailLayout';

interface TraineeProfileOrigin {
  batchId?: string;
}

function initialsOf(name: string): string {
  return name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase();
}

/**
 * Admin's view-only trainee profile — reached by clicking a trainee's name inside an expanded
 * batch row in Batch Management. Keeps the batch that was clicked from as context (both for the
 * displayed stats and for the Back button), mirroring the Facilitator equivalent
 * (TraineeProfilePage.tsx) without touching that Facilitator-only file.
 */
export default function AdminTraineeProfilePage() {
  const { traineeName: encodedName } = useParams();
  const traineeName = decodeURIComponent(encodedName ?? '');
  const navigate = useNavigate();
  const location = useLocation();
  const originBatchId = (location.state as { from?: TraineeProfileOrigin } | null)?.from?.batchId;

  const batches = useBatchesStore((s) => s.batches);
  const fetchBatches = useBatchesStore((s) => s.fetchBatches);
  useEffect(() => {
    if (batches.length === 0) fetchBatches();
  }, [batches.length, fetchBatches]);

  const batch = useMemo(
    () => batches.find((b) => b.id === originBatchId) ?? batches.find((b) => b.members.includes(traineeName)),
    [batches, originBatchId, traineeName]
  );

  const assignments = useAssignmentsStore((s) => s.assignments);
  const fetchAssignments = useAssignmentsStore((s) => s.fetchAssignments);
  useEffect(() => {
    if (batch) fetchAssignments({ batchId: batch.id });
  }, [fetchAssignments, batch]);

  const feedback = useFeedbackStore((s) => s.feedback);

  const [stats, setStats] = useState<BatchTraineeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  useEffect(() => {
    if (!batch) return;
    let cancelled = false;
    setStatsLoading(true);
    setStatsError('');
    listBatchTraineeStats(batch.id)
      .then((res) => {
        if (!cancelled) setStats(res.find((t) => t.name === traineeName) ?? null);
      })
      .catch((err) => {
        if (!cancelled) setStatsError(err instanceof Error ? err.message : 'Unable to load trainee stats.');
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch, traineeName]);

  const submissionRows = useMemo(
    () =>
      assignments.flatMap((a) => {
        const submission = a.submissions.find((s) => s.traineeName === traineeName);
        return submission ? [{ assignment: a, submission }] : [];
      }),
    [assignments, traineeName]
  );

  const traineeFeedback = useMemo(() => feedback.filter((f) => f.trainee === traineeName), [feedback, traineeName]);

  function goBack() {
    if (batch) {
      navigate(ROUTES.ADMIN, { state: { tab: 'batches', expandBatchId: batch.id } });
    } else {
      navigate(ROUTES.ADMIN, { state: { tab: 'batches' } });
    }
  }

  if (!traineeName || !batch) {
    return (
      <AuthenticatedDetailLayout
        role="admin"
        activeTab="batches"
        headerTitle="Trainee"
        breadcrumbTrail={['Admin', 'Batch Management']}
        onBack={goBack}
        backLabel="Back to Batch Management"
      >
        <p className="text-sm text-gray-600">Trainee not found.</p>
      </AuthenticatedDetailLayout>
    );
  }

  return (
    <AuthenticatedDetailLayout
      role="admin"
      activeTab="batches"
      headerTitle={traineeName}
      breadcrumbTrail={['Admin', 'Batch Management', batch.name, traineeName]}
      onBack={goBack}
      backLabel="Back to Batch Management"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl">{initialsOf(traineeName)}</div>
        <div>
          <p className="text-sm text-gray-500">
            {batch.name} • {batch.program} {batch.track}
            {stats?.email && <span> • {stats.email}</span>}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {statsError && <p className="text-sm text-red-600">{statsError}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Attendance" value={statsLoading ? '…' : stats?.attendancePercentage !== null && stats?.attendancePercentage !== undefined ? `${stats.attendancePercentage}%` : '—'} />
          <StatCard label="Assignments Completed" value={statsLoading ? '…' : stats?.assignmentsCompleted ?? '—'} />
          <StatCard label="Assignments Pending" value={statsLoading ? '…' : stats?.assignmentsPending ?? '—'} />
          <StatCard label="Average Grade" value={statsLoading ? '…' : stats?.avgGrade !== null && stats?.avgGrade !== undefined ? `${stats.avgGrade}/100` : '—'} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-800">Assignment History</h2>
          </div>
          {submissionRows.length === 0 ? (
            <EmptyState title="No assignments yet" icon="inbox" />
          ) : (
            <Table columns={[{ key: 'assignment', label: 'Assignment' }, { key: 'status', label: 'Status' }, { key: 'submitted', label: 'Submitted' }, { key: 'grade', label: 'Grade' }]}>
              {submissionRows.map(({ assignment, submission }) => (
                <tr key={assignment.id}>
                  <td className="px-6 py-4 font-medium text-gray-800">{assignment.title}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={submission.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-600">{submission.submittedOn ? formatDateTime(submission.submittedOn) : '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{submission.grade !== null ? `${submission.grade}/100` : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-800">Feedback History</h2>
          </div>
          {traineeFeedback.length === 0 ? (
            <EmptyState title="No feedback recorded yet" icon="inbox" />
          ) : (
            <div className="p-6 space-y-4">
              {traineeFeedback.map((f) => (
                <div key={f.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-gray-800">{f.category}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        By {f.facilitator} • {f.date}
                      </div>
                    </div>
                    <div className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-lg text-sm">{f.rating}/5</div>
                  </div>
                  {f.comment && <p className="text-sm text-gray-600 italic mt-2">"{f.comment}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedDetailLayout>
  );
}
