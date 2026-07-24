import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useBatchesStore } from '../store/batchesStore';
import { useAuthStore } from '../store/authStore';
import { useFacilitatorAssignmentsStore } from '../store/facilitatorAssignmentsStore';
import { useAssignmentsStore } from '../store/assignmentsStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { MeetingPlatform, useSessionsStore } from '../store/sessionsStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useToastStore } from '../store/toastStore';
import { findUserEmailByName } from '../services/api/userService';
import { average } from '../utils/mathUtils';
import { formatDateTime } from '../utils/dateUtils';
import StatusBadge from '../components/StatusBadge';
import SavingButton from '../components/SavingButton';
import { resolveFacilitatorProfileBack } from '../utils/facilitatorProfileNav';
import AuthenticatedDetailLayout from '../layouts/AuthenticatedDetailLayout';

export default function TraineeProfilePage() {
  const { traineeName: encodedName } = useParams();
  const traineeName = decodeURIComponent(encodedName ?? '');
  const navigate = useNavigate();
  const location = useLocation();
  const backTarget = resolveFacilitatorProfileBack(location.state);
  const backLabel = backTarget.label.replace(/^[‹\s]+/, '');
  const origin = (location.state as { from?: { type: 'batch' | 'trainees' } } | null)?.from;
  const activeTab = origin?.type === 'trainees' ? 'trainees' : 'batches';
  const { id: currentUserId } = useAuthStore();

  const batches = useBatchesStore((s) => s.batches);
  const fetchBatches = useBatchesStore((s) => s.fetchBatches);
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);
  const { assignments: myTeamAssignments, fetchAssignments: fetchMyTeamAssignments } = useFacilitatorAssignmentsStore();
  useEffect(() => {
    if (currentUserId) fetchMyTeamAssignments({ facilitatorId: currentUserId });
  }, [fetchMyTeamAssignments, currentUserId]);
  const assignments = useAssignmentsStore((s) => s.assignments);
  const feedback = useFeedbackStore((s) => s.feedback);
  const createSession = useSessionsStore((s) => s.createSession);
  const logEvent = useAuditLogStore((s) => s.logEvent);
  const showToast = useToastStore((s) => s.showToast);

  // "My batches" now means every batch this facilitator is actively on the team for -- Primary
  // Coordinator, Lead Facilitator, Trainer, whatever role -- not just batches where they happen to
  // be the Primary Coordinator (poc). Fixes a real gap: a Lead Facilitator/Trainer couldn't
  // previously open a trainee's profile in a batch they were genuinely assigned to.
  const myBatches = useMemo(() => {
    const myBatchIds = new Set(myTeamAssignments.filter((a) => a.status !== 'Removed').map((a) => a.batchId));
    return batches.filter((b) => myBatchIds.has(b.id));
  }, [batches, myTeamAssignments]);
  const batch = useMemo(() => myBatches.find((b) => b.members.includes(traineeName)), [myBatches, traineeName]);
  // Assignments belong to a Training Plan, not an individual facilitator — scope to "my batches'
  // assignments" via batch membership instead of a facilitator-name match.
  const facilitatorAssignments = useMemo(() => {
    const myBatchIds = new Set(myBatches.map((b) => b.id));
    return assignments.filter((a) => a.batches.some((b) => myBatchIds.has(b.id)));
  }, [assignments, myBatches]);
  const submissionRows = useMemo(
    () =>
      facilitatorAssignments.flatMap((a) => {
        const submission = a.submissions.find((s) => s.traineeName === traineeName);
        return submission ? [{ assignment: a, submission }] : [];
      }),
    [facilitatorAssignments, traineeName]
  );
  const missingCount = submissionRows.filter((r) => r.submission.status === 'Not Started' || r.submission.status === 'Late').length;
  const grades = submissionRows.filter((r) => r.submission.grade !== null).map((r) => r.submission.grade as number);
  const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
  const traineeFeedback = useMemo(() => feedback.filter((f) => f.trainee === traineeName), [feedback, traineeName]);
  const avgRating = average(traineeFeedback.map((f) => f.rating));

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [link, setLink] = useState('');
  const [platform, setPlatform] = useState<MeetingPlatform>('Google Meet');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function goBack() {
    navigate(backTarget.path, backTarget.state ? { state: backTarget.state } : undefined);
  }

  if (!traineeName || !batch) {
    return (
      <AuthenticatedDetailLayout
        role="facilitator"
        activeTab={activeTab}
        headerTitle="Trainee"
        breadcrumbTrail={['Facilitator Dashboard', 'Trainees']}
        onBack={goBack}
        backLabel={backLabel}
      >
        <p className="text-sm text-gray-600">Trainee not found.</p>
      </AuthenticatedDetailLayout>
    );
  }

  function openSchedule() {
    setTitle(`1:1 with ${traineeName}`);
    setBatchId(batch!.id);
    setDate('');
    setTime('');
    setLink('');
    setPlatform('Google Meet');
    setFormError('');
    setScheduleOpen(true);
  }

  async function handleCreateSession() {
    if (!title.trim() || !date.trim() || !time.trim()) {
      setFormError('Please fill in the title, date, and time.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await createSession({
        title: title.trim(),
        batchId: batchId || batches[0]?.id || '',
        date,
        time,
        link,
        platform,
        status: 'Upcoming'
      });
      logEvent('Session', `Scheduled "${title.trim()}".`);
      showToast('1:1 session scheduled');
      setScheduleOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to schedule session.');
    } finally {
      setSaving(false);
    }
  }

  function handleSendReminder() {
    logEvent('Reminder', `Reminder sent to ${traineeName} for pending submission.`);
    showToast(`Reminder sent to ${traineeName}`);
  }

  async function handleMessage() {
    const email = await findUserEmailByName(traineeName, 'trainee');
    if (!email) {
      showToast(`No email on file for ${traineeName}.`, 'error');
      return;
    }
    window.location.href = `mailto:${email}`;
  }

  const initials = traineeName
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AuthenticatedDetailLayout
      role="facilitator"
      activeTab={activeTab}
      headerTitle={traineeName}
      breadcrumbTrail={['Facilitator Dashboard', 'Trainees', traineeName]}
      onBack={goBack}
      backLabel={backLabel}
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl">{initials}</div>
        <div>
          <p className="text-sm text-gray-500">
            {batch.name} • {batch.program} {batch.track}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Missing/Late Submissions</div>
            <div className="text-3xl font-bold mt-2 text-gray-800">{missingCount}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average Grade</div>
            <div className="text-3xl font-bold mt-2 text-gray-800">{avgGrade !== null ? `${avgGrade}%` : '—'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average Feedback Rating</div>
            <div className="text-3xl font-bold mt-2 text-gray-800">{avgRating !== null ? `${avgRating}/5` : '—'}</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">Connect</h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={openSchedule} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Schedule 1:1
            </button>
            <button onClick={handleMessage} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
              Message
            </button>
            <button onClick={handleSendReminder} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
              Send Reminder
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-800">Assignment History</h2>
          </div>
          {submissionRows.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No assignments yet.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Assignment</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Submitted</th>
                  <th className="px-6 py-3 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
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
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-bold text-gray-800">Feedback History</h2>
          </div>
          {traineeFeedback.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No feedback recorded yet.</p>
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

      {/* Schedule 1:1 modal */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${scheduleOpen ? 'flex' : 'hidden'} items-center justify-center z-50`}
        role="dialog"
        aria-modal="true"
        onClick={() => setScheduleOpen(false)}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Schedule 1:1 with {traineeName}</h2>
          <div className="space-y-4">
            {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
            <div>
              <label htmlFor="trainee-profile-session-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input id="trainee-profile-session-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="trainee-profile-session-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input id="trainee-profile-session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label htmlFor="trainee-profile-session-time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input id="trainee-profile-session-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
            <div>
              <label htmlFor="trainee-profile-session-platform" className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                id="trainee-profile-session-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}
                className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
              >
                <option value="Google Meet">Google Meet</option>
                <option value="Microsoft Teams">Microsoft Teams</option>
                <option value="Zoom">Zoom</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="trainee-profile-session-link" className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
              <input
                id="trainee-profile-session-link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full px-3 py-2 border rounded-lg outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setScheduleOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
              Cancel
            </button>
            <SavingButton onClick={handleCreateSession} isSaving={saving} label="Schedule" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" />
          </div>
        </div>
      </div>
    </AuthenticatedDetailLayout>
  );
}
