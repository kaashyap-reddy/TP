import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Submission, SubmissionStatus, useAssignmentsStore } from '../store/assignmentsStore';
import { useBatchesStore } from '../store/batchesStore';
import { useToastStore } from '../store/toastStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import { assignmentAttachmentUrl } from '../services/api/assignmentService';
import { submissionAttachmentUrl } from '../services/api/submissionService';
import FileViewButton from '../components/FileViewButton';
import InlineFilePreview from '../components/InlineFilePreview';
import AssignmentFeedbackCell from '../components/AssignmentFeedbackCell';
import Tabs from '../components/Tabs';
import { formatDateTime } from '../utils/dateUtils';
import AuthenticatedDetailLayout from '../layouts/AuthenticatedDetailLayout';

const SUBMISSION_STATUSES: SubmissionStatus[] = ['Not Started', 'Under Review', 'Completed', 'Late'];

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  'Not Started': 'bg-gray-100 text-gray-500',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  Late: 'bg-red-100 text-red-800'
};

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const assignment = useAssignmentsStore((s) => s.assignments.find((a) => a.id === assignmentId));
  const updateSubmission = useAssignmentsStore((s) => s.updateSubmission);
  const setAssignmentFeedbackForm = useAssignmentsStore((s) => s.setAssignmentFeedbackForm);
  const fetchAssignments = useAssignmentsStore((s) => s.fetchAssignments);
  const fetchSubmissionsForAssignment = useAssignmentsStore((s) => s.fetchSubmissionsForAssignment);
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);
  useEffect(() => {
    if (assignmentId) fetchSubmissionsForAssignment(assignmentId);
  }, [assignmentId, fetchSubmissionsForAssignment]);
  const batch = useBatchesStore((s) => s.batches.find((b) => b.id === assignment?.batchId));
  const fetchBatches = useBatchesStore((s) => s.fetchBatches);
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);
  const showToast = useToastStore((s) => s.showToast);
  const logEvent = useAuditLogStore((s) => s.logEvent);
  const role = useAuthStore((s) => s.role);

  function goBackToAssignments() {
    navigate(role ? ROUTES.DASHBOARD_FOR_ROLE(role) : ROUTES.LOGIN, { state: { tab: 'assignments' } });
  }

  const [gradingTrainee, setGradingTrainee] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [statusInput, setStatusInput] = useState<SubmissionStatus>('Completed');
  const [rosterFilter, setRosterFilter] = useState<'All' | SubmissionStatus>('All');
  const [selectedTrainees, setSelectedTrainees] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  // Route is guarded to admin/facilitator only (App.tsx) -- role is never null/trainee here in
  // practice, but satisfy the type checker without asserting.
  if (!role || role === 'trainee') return null;

  if (!assignment) {
    return (
      <AuthenticatedDetailLayout
        role={role}
        activeTab="assignments"
        headerTitle="Assignment"
        breadcrumbTrail={[role === 'admin' ? 'Admin' : 'Facilitator', 'Assignments']}
        onBack={goBackToAssignments}
        backLabel="Back to Assignments"
      >
        <p className="text-sm text-gray-600">Assignment not found.</p>
      </AuthenticatedDetailLayout>
    );
  }

  function startGrading(traineeName: string, current: Submission) {
    setGradingTrainee(traineeName);
    setScoreInput(current.grade !== null ? String(current.grade) : '');
    setFeedbackInput(current.feedback);
    setStatusInput(current.status === 'Not Started' ? 'Completed' : current.status);
  }

  async function saveGrade(traineeName: string) {
    const grade = scoreInput.trim() === '' ? null : Number(scoreInput);
    try {
      await updateSubmission(assignment!.id, traineeName, { grade, feedback: feedbackInput, status: statusInput });
      logEvent('Grading', `${traineeName} was graded ${grade ?? '—'}/100 on "${assignment!.title}".`);
      showToast('Grade saved');
      setGradingTrainee(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save grade.', 'error');
    }
  }

  function toggleTraineeSelected(traineeName: string) {
    setSelectedTrainees((prev) => {
      const next = new Set(prev);
      if (next.has(traineeName)) next.delete(traineeName);
      else next.add(traineeName);
      return next;
    });
  }

  function toggleSelectAllSubmitted(rows: Submission[]) {
    const submittedNames = rows.filter((s) => s.id).map((s) => s.traineeName);
    setSelectedTrainees((prev) =>
      submittedNames.length > 0 && submittedNames.every((n) => prev.has(n)) ? new Set() : new Set(submittedNames)
    );
  }

  async function bulkMarkStatus(status: SubmissionStatus) {
    if (selectedTrainees.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(Array.from(selectedTrainees).map((traineeName) => updateSubmission(assignment!.id, traineeName, { status })));
      logEvent('Grading', `${selectedTrainees.size} submission(s) marked ${status} on "${assignment!.title}".`);
      showToast(`${selectedTrainees.size} submission(s) marked ${status}`);
      setSelectedTrainees(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update selected submissions.', 'error');
    } finally {
      setBulkSaving(false);
    }
  }

  const completedCount = assignment.submissions.filter((s) => s.status === 'Completed').length;
  const batchNames = assignment.batches.length > 0 ? assignment.batches.map((b) => b.name).join(', ') : batch?.name ?? assignment.batchId;

  const rosterTabs = [
    { value: 'All', label: 'All', count: assignment.submissions.length },
    ...SUBMISSION_STATUSES.map((status) => ({
      value: status,
      label: status,
      count: assignment.submissions.filter((s) => s.status === status).length
    }))
  ];
  const filteredSubmissions =
    rosterFilter === 'All' ? assignment.submissions : assignment.submissions.filter((s) => s.status === rosterFilter);

  return (
    <AuthenticatedDetailLayout
      role={role}
      activeTab="assignments"
      headerTitle={assignment.title}
      breadcrumbTrail={[role === 'admin' ? 'Admin' : 'Facilitator', 'Assignments', assignment.title]}
      onBack={goBackToAssignments}
      backLabel="Back to Assignments"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            {assignment.agenda && (
              <span className="inline-block mt-1 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">{assignment.agenda}</span>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {batchNames} • Related Session: {assignment.sessionTitle ?? '—'} • Deadline: {formatDateTime(assignment.deadline)}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <FileViewButton
              url={assignment.attachmentFilename ? assignmentAttachmentUrl(assignment.id) : null}
              fileName={assignment.attachmentFilename ?? undefined}
              label="View Assignment File"
            />
            <span className="text-sm bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
              {completedCount} / {assignment.submissions.length} graded
            </span>
          </div>
        </div>
        {assignment.description && <p className="text-sm text-gray-600 mt-3 max-w-2xl">{assignment.description}</p>}
        {/* Route is guarded to admin/facilitator only -- both can manage the feedback form. */}
        <div className="mt-3">
          <AssignmentFeedbackCell
            assignment={assignment}
            canManage
            onChange={(assignmentId, feedbackForm) => setAssignmentFeedbackForm(assignmentId, feedbackForm)}
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-gray-800">Batch Roster & Submissions</h2>
          </div>
          <div className="px-6 pt-3 bg-gray-50 border-b border-gray-200">
            <Tabs tabs={rosterTabs} active={rosterFilter} onChange={(v) => setRosterFilter(v as 'All' | SubmissionStatus)} aria-label="Filter roster by submission status" />
          </div>
          {selectedTrainees.size > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-bold text-blue-800">{selectedTrainees.size} selected</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={bulkSaving}
                  onClick={() => bulkMarkStatus('Under Review')}
                  className="text-xs font-bold text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  Mark Selected as Under Review
                </button>
                <button
                  disabled={bulkSaving}
                  onClick={() => bulkMarkStatus('Completed')}
                  className="text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Mark Selected as Completed
                </button>
              </div>
            </div>
          )}
          {filteredSubmissions.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No trainees match this filter.</p>
          ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Select all submitted"
                    checked={filteredSubmissions.some((s) => s.id) && filteredSubmissions.filter((s) => s.id).every((s) => selectedTrainees.has(s.traineeName))}
                    onChange={() => toggleSelectAllSubmitted(filteredSubmissions)}
                  />
                </th>
                <th className="px-6 py-3 font-medium">Trainee</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Submitted On</th>
                <th className="px-6 py-3 font-medium">Grade</th>
                <th className="px-6 py-3 font-medium">Submission</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredSubmissions.map((s) => (
                <Fragment key={s.traineeName}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.traineeName}`}
                        disabled={!s.id}
                        checked={selectedTrainees.has(s.traineeName)}
                        onChange={() => toggleTraineeSelected(s.traineeName)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">{s.traineeName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full font-bold text-xs ${STATUS_BADGE[s.status]}`}>
                        {s.id ? s.status : 'Not submitted'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{s.submittedOn ? formatDateTime(s.submittedOn) : '—'}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">{s.grade !== null ? `${s.grade}/100` : '-'}</td>
                    <td className="px-6 py-4">
                      <FileViewButton
                        url={s.id && s.attachmentId ? submissionAttachmentUrl(s.id, s.attachmentId) : null}
                        fileName={s.attachmentFilename}
                        label="View Submission"
                        disabledLabel="Not submitted"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        disabled={!s.id}
                        onClick={() => (gradingTrainee === s.traineeName ? setGradingTrainee(null) : startGrading(s.traineeName, s))}
                        className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                          gradingTrainee === s.traineeName
                            ? 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
                            : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
                        }`}
                      >
                        {gradingTrainee === s.traineeName ? 'Close' : 'Grade'}
                      </button>
                    </td>
                  </tr>
                  {gradingTrainee === s.traineeName && (
                    <tr>
                      <td colSpan={7} className="px-6 py-5 bg-blue-50/40 border-t border-blue-100">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label htmlFor="assignment-grade-score" className="block text-xs font-bold text-gray-700 mb-1 uppercase">Score (0-100)</label>
                              <input
                                id="assignment-grade-score"
                                type="number"
                                min={0}
                                max={100}
                                value={scoreInput}
                                onChange={(e) => setScoreInput(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label htmlFor="assignment-grade-status" className="block text-xs font-bold text-gray-700 mb-1 uppercase">Status</label>
                              <select
                                id="assignment-grade-status"
                                value={statusInput}
                                onChange={(e) => setStatusInput(e.target.value as SubmissionStatus)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none"
                              >
                                <option>Not Started</option>
                                <option>Under Review</option>
                                <option>Completed</option>
                                <option>Late</option>
                              </select>
                            </div>
                            <div className="md:col-span-1 flex items-end">
                              <button
                                onClick={() => saveGrade(s.traineeName)}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                              >
                                Save Grade
                              </button>
                            </div>
                            <div className="md:col-span-3">
                              <label htmlFor="assignment-grade-feedback" className="block text-xs font-bold text-gray-700 mb-1 uppercase">Feedback</label>
                              <textarea
                                id="assignment-grade-feedback"
                                value={feedbackInput}
                                onChange={(e) => setFeedbackInput(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none h-20"
                                placeholder="Write constructive feedback here..."
                              />
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-700 mb-1 uppercase">Submission Preview</div>
                            {s.id && s.attachmentId ? (
                              <InlineFilePreview url={submissionAttachmentUrl(s.id, s.attachmentId)} fileName={s.attachmentFilename} className="h-64" />
                            ) : (
                              <div className="flex items-center justify-center h-64 text-sm text-gray-400 border border-gray-200 rounded-lg">No file submitted</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </AuthenticatedDetailLayout>
  );
}
