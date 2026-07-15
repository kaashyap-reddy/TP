import type { MeetingPlatform, Session, SessionStatus } from '../../types/session';
import type { SessionFeedbackAudience } from '../../types/sessionFeedback';
import { formatTimeRange, parseTimeRange } from '../../utils/sessionTime';
import { api } from './apiClient';

type ApiPlatform = 'GoogleMeet' | 'MicrosoftTeams' | 'Zoom' | 'Other';

const PLATFORM_TO_API: Record<MeetingPlatform, ApiPlatform> = {
  'Google Meet': 'GoogleMeet',
  'Microsoft Teams': 'MicrosoftTeams',
  Zoom: 'Zoom',
  Other: 'Other'
};

const PLATFORM_FROM_API: Record<ApiPlatform, MeetingPlatform> = {
  GoogleMeet: 'Google Meet',
  MicrosoftTeams: 'Microsoft Teams',
  Zoom: 'Zoom',
  Other: 'Other'
};

interface ApiSession {
  id: string;
  batchId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  platform: ApiPlatform;
  meetingLink: string | null;
  status: SessionStatus;
  facilitator: { id: string; name: string; email: string };
  relatedAssignments: { id: string; title: string }[];
  feedbackForm: {
    id: string;
    name: string;
    description: string;
    formUrl: string;
    audience: SessionFeedbackAudience;
    _count: { submissions: number };
  } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/** The API stores a single instant (scheduledAt) plus a duration; the UI displays a start-end range. Combine date + range-start on write. */
function toScheduledAt(dateStr: string, timeStr: string): string {
  const { start } = parseTimeRange(timeStr);
  const base = new Date(dateStr);
  if (isNaN(base.getTime())) return new Date().toISOString();
  base.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return base.toISOString();
}

function toDurationMinutes(timeStr: string): number {
  const { start, end } = parseTimeRange(timeStr);
  return Math.max(1, end - start);
}

function fromScheduledAt(iso: string, durationMinutes: number): { date: string; time: string } {
  const scheduled = new Date(iso);
  const date = scheduled.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const start = scheduled.getHours() * 60 + scheduled.getMinutes();
  const time = formatTimeRange(start, start + durationMinutes);
  return { date, time };
}

function toFrontendSession(apiSession: ApiSession): Session {
  const { date, time } = fromScheduledAt(apiSession.scheduledAt, apiSession.durationMinutes);
  return {
    id: apiSession.id,
    title: apiSession.title,
    batchId: apiSession.batchId,
    facilitator: apiSession.facilitator?.name ?? '',
    date,
    time,
    link: apiSession.meetingLink ?? '',
    platform: PLATFORM_FROM_API[apiSession.platform],
    status: apiSession.status,
    // No aggregate-attendance field server-side (attendance is per-trainee); overlaid client-side by the store.
    presentCount: null,
    absentCount: null,
    relatedAssignmentId: apiSession.relatedAssignments?.[0]?.id ?? null,
    relatedAssignmentTitle: apiSession.relatedAssignments?.[0]?.title ?? null,
    feedbackForm: apiSession.feedbackForm
      ? {
          id: apiSession.feedbackForm.id,
          name: apiSession.feedbackForm.name,
          description: apiSession.feedbackForm.description,
          formUrl: apiSession.feedbackForm.formUrl,
          audience: apiSession.feedbackForm.audience,
          submittedCount: apiSession.feedbackForm._count.submissions
        }
      : null
  };
}

export async function listSessions(filters?: { batchId?: string }): Promise<Session[]> {
  const res = await api.get<PaginatedResponse<ApiSession>>('/sessions', { ...filters, pageSize: 200 });
  return res.data.map(toFrontendSession);
}

export type CreateSessionInput = Omit<
  Session,
  'id' | 'presentCount' | 'absentCount' | 'relatedAssignmentId' | 'relatedAssignmentTitle' | 'feedbackForm'
>;

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const created = await api.post<{ session: ApiSession }>('/sessions', {
    batchId: input.batchId,
    title: input.title,
    scheduledAt: toScheduledAt(input.date, input.time),
    durationMinutes: toDurationMinutes(input.time),
    platform: PLATFORM_TO_API[input.platform],
    meetingLink: input.link || undefined,
    status: input.status
  });
  return toFrontendSession(created.session);
}

/** presentCount/absentCount have no server field (attendance is tracked per-trainee) and are applied client-side only by the caller. */
export async function updateSession(id: string, changes: Partial<Session>): Promise<Partial<Session>> {
  const patch: Record<string, unknown> = {};
  if (changes.title !== undefined) patch.title = changes.title;
  if (changes.link !== undefined) patch.meetingLink = changes.link || undefined;
  if (changes.platform !== undefined) patch.platform = PLATFORM_TO_API[changes.platform];
  if (changes.status !== undefined) patch.status = changes.status;
  if (changes.date !== undefined && changes.time !== undefined) {
    patch.scheduledAt = toScheduledAt(changes.date, changes.time);
    patch.durationMinutes = toDurationMinutes(changes.time);
  }

  if (Object.keys(patch).length === 0) {
    return changes;
  }

  const updated = await api.patch<{ session: ApiSession }>(`/sessions/${id}`, patch);
  return { ...toFrontendSession(updated.session), presentCount: changes.presentCount, absentCount: changes.absentCount };
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/sessions/${id}`);
}
