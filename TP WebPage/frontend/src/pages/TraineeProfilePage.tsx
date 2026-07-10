import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBatchesStore } from '../store/batchesStore';
import { useAssignmentsStore } from '../store/assignmentsStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useDiscussionsStore } from '../store/discussionsStore';
import { MeetingPlatform, useSessionsStore } from '../store/sessionsStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useToastStore } from '../store/toastStore';
import { average } from '../lib/mathUtils';
import Breadcrumbs from '../components/Breadcrumbs';
import StatusBadge from '../components/StatusBadge';
import SavingButton from '../components/SavingButton';

const FACILITATOR_NAME = 'Junaid Mohammed';

export default function TraineeProfilePage() {
  const { traineeName: encodedName } = useParams();
  const traineeName = decodeURIComponent(encodedName ?? '');
  const navigate = useNavigate();

  const batches = useBatchesStore((s) => s.batches);
  const assignments = useAssignmentsStore((s) => s.assignments);
  const feedback = useFeedbackStore((s) => s.feedback);
  const createThread = useDiscussionsStore((s) => s.createThread);
  const createSession = useSessionsStore((s) => s.createSession);
  const logEvent = useAuditLogStore((s) => s.logEvent);
  const showToast = useToastStore((s) => s.showToast);

  const myBatches = useMemo(() => batches.filter((b) => b.poc === FACILITATOR_NAME), [batches]);
  const batch = useMemo(() => myBatches.find((b) => b.members.includes(traineeName)), [myBatches, traineeName]);
  const facilitatorAssignments = useMemo(() => assignments.filter((a) => a.facilitator === FACILITATOR_NAME), [assignments]);
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
    navigate('/facilitator', { state: { tab: 'trainees' } });
  }

  if (!traineeName || !batch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-gray-600">
        <p className="mb-4">Trainee not found.</p>
        <button onClick={goBack} className="text-blue-600 font-medium hover:underline">
          ‹ Back to Trainee Directory
        </button>
      </div>
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

  function handleCreateSession() {
    if (!title.trim() || !date.trim() || !time.trim()) {
      setFormError('Please fill in the title, date, and time.');
      return;
    }
    setFormError('');
    setSaving(true);
    setTimeout(() => {
      createSession({
        title: title.trim(),
        batchId: batchId || batches[0]?.id || '',
        facilitator: FACILITATOR_NAME,
        date,
        time,
        link,
        platform,
        status: 'Upcoming'
      });
      logEvent('Session', `Scheduled "${title.trim()}".`);
      showToast('1:1 session scheduled');
      setScheduleOpen(false);
      setSaving(false);
    }, 400);
  }

  function handleSendReminder() {
    logEvent('Reminder', `Reminder sent to ${traineeName} for pending submission.`);
    showToast(`Reminder sent to ${traineeName}`);
  }

  function handleMessage() {
    createThread({
      title: `Note for ${traineeName}`,
      batchId: batch!.id,
      author: FACILITATOR_NAME,
      role: 'facilitator',
      message: `Hi ${traineeName}, wanted to reach out regarding your progress.`
    });
    showToast(`Discussion started with ${traineeName}`);
    navigate('/facilitator', { state: { tab: 'discussions' } });
  }

  const initials = traineeName
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <button onClick={goBack} className="text-sm text-blue-600 hover:underline font-medium mb-3">
          ‹ Back to Trainee Directory
        </button>
        <Breadcrumbs trail={['Facilitator Dashboard', 'Trainees', traineeName]} />
        <div className="flex items-center gap-4 mt-2">
          <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xl">{initials}</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{traineeName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {batch.name} • {batch.program} {batch.track}
            </p>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-4xl mx-auto space-y-6">
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
                    <td className="px-6 py-4 text-gray-600">{submission.submittedOn}</td>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
              <input
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
    </div>
  );
}
