import type {
  TrainingPlan,
  TrainingPlanAnnouncement,
  TrainingPlanAnnouncementInput,
  TrainingPlanAssignment,
  TrainingPlanAssignmentInput,
  TrainingPlanGeneralInput,
  TrainingPlanResource,
  TrainingPlanResourceInput,
  TrainingPlanSession,
  TrainingPlanSessionInput,
  TrainingPlanSummary
} from '../../types/trainingPlan';
import { api } from './apiClient';

type ApiPlatform = 'GoogleMeet' | 'MicrosoftTeams' | 'Zoom' | 'Other';

const PLATFORM_TO_API: Record<TrainingPlanSession['platform'], ApiPlatform> = {
  'Google Meet': 'GoogleMeet',
  'Microsoft Teams': 'MicrosoftTeams',
  Zoom: 'Zoom',
  Other: 'Other'
};

const PLATFORM_FROM_API: Record<ApiPlatform, TrainingPlanSession['platform']> = {
  GoogleMeet: 'Google Meet',
  MicrosoftTeams: 'Microsoft Teams',
  Zoom: 'Zoom',
  Other: 'Other'
};

interface ApiTrainingPlanSession {
  id: string;
  title: string;
  agenda: string;
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  platform: ApiPlatform;
  order: number;
  feedbackFormUrl: string | null;
}

interface ApiTrainingPlanAssignment {
  id: string;
  title: string;
  agenda: string;
  description: string;
  dueDayOffset: number;
  relatedSessionId: string | null;
  relatedSession: { id: string; title: string } | null;
}

interface ApiTrainingPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMonths: number;
  defaultSessionStartMinute: number;
  defaultSessionEndMinute: number;
  defaultAssignmentStartMinute: number;
  defaultAssignmentDeadlineMinute: number;
  sessions: ApiTrainingPlanSession[];
  assignments: ApiTrainingPlanAssignment[];
  resources: TrainingPlanResource[];
  announcements: TrainingPlanAnnouncement[];
}

interface ApiTrainingPlanSummary {
  id: string;
  code: string;
  name: string;
  durationMonths: number;
  _count: { sessions: number; assignments: number; resources: number; announcements: number; batches: number };
}

function toFrontendSession(s: ApiTrainingPlanSession): TrainingPlanSession {
  return {
    id: s.id,
    title: s.title,
    agenda: s.agenda,
    dayOffset: s.dayOffset,
    startMinute: s.startMinute,
    endMinute: s.endMinute,
    platform: PLATFORM_FROM_API[s.platform],
    order: s.order,
    feedbackFormUrl: s.feedbackFormUrl
  };
}

function toFrontendAssignment(a: ApiTrainingPlanAssignment): TrainingPlanAssignment {
  return {
    id: a.id,
    title: a.title,
    agenda: a.agenda,
    description: a.description,
    dueDayOffset: a.dueDayOffset,
    relatedSessionId: a.relatedSessionId,
    relatedSessionTitle: a.relatedSession?.title ?? null
  };
}

function toFrontendPlan(apiPlan: ApiTrainingPlan): TrainingPlan {
  return {
    id: apiPlan.id,
    code: apiPlan.code,
    name: apiPlan.name,
    description: apiPlan.description,
    durationMonths: apiPlan.durationMonths,
    defaultSessionStartMinute: apiPlan.defaultSessionStartMinute,
    defaultSessionEndMinute: apiPlan.defaultSessionEndMinute,
    defaultAssignmentStartMinute: apiPlan.defaultAssignmentStartMinute,
    defaultAssignmentDeadlineMinute: apiPlan.defaultAssignmentDeadlineMinute,
    sessions: apiPlan.sessions.map(toFrontendSession),
    assignments: apiPlan.assignments.map(toFrontendAssignment),
    resources: apiPlan.resources,
    announcements: apiPlan.announcements
  };
}

// Only includes keys actually present in `input` — callers may pass a true partial (e.g. a
// Reschedule action sending just day/time), and a field omitted here must stay untouched on the
// server rather than being reset to a default.
function sessionInputToApi(input: Partial<TrainingPlanSessionInput>) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.agenda !== undefined) out.agenda = input.agenda;
  if (input.dayOffset !== undefined) out.dayOffset = input.dayOffset;
  if (input.startMinute !== undefined) out.startMinute = input.startMinute;
  if (input.endMinute !== undefined) out.endMinute = input.endMinute;
  if (input.platform !== undefined) out.platform = PLATFORM_TO_API[input.platform];
  if (input.order !== undefined) out.order = input.order;
  if (input.feedbackFormUrl !== undefined) out.feedbackFormUrl = input.feedbackFormUrl || undefined;
  return out;
}

export async function listTrainingPlans(): Promise<TrainingPlanSummary[]> {
  const res = await api.get<{ trainingPlans: ApiTrainingPlanSummary[] }>('/training-plans');
  return res.trainingPlans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    durationMonths: p.durationMonths,
    counts: p._count
  }));
}

export async function getTrainingPlan(id: string): Promise<TrainingPlan> {
  const res = await api.get<{ trainingPlan: ApiTrainingPlan }>(`/training-plans/${id}`);
  return toFrontendPlan(res.trainingPlan);
}

export async function updateTrainingPlan(id: string, changes: TrainingPlanGeneralInput): Promise<TrainingPlan> {
  const res = await api.patch<{ trainingPlan: ApiTrainingPlan }>(`/training-plans/${id}`, changes);
  return toFrontendPlan(res.trainingPlan);
}

export async function createTrainingPlanSession(planId: string, input: TrainingPlanSessionInput): Promise<TrainingPlanSession> {
  const res = await api.post<{ session: ApiTrainingPlanSession }>(`/training-plans/${planId}/sessions`, sessionInputToApi(input));
  return toFrontendSession(res.session);
}

export async function updateTrainingPlanSession(
  planId: string,
  sessionId: string,
  input: Partial<TrainingPlanSessionInput>
): Promise<TrainingPlanSession> {
  const res = await api.patch<{ session: ApiTrainingPlanSession }>(`/training-plans/${planId}/sessions/${sessionId}`, sessionInputToApi(input));
  return toFrontendSession(res.session);
}

export async function deleteTrainingPlanSession(planId: string, sessionId: string): Promise<void> {
  await api.delete(`/training-plans/${planId}/sessions/${sessionId}`);
}

export async function createTrainingPlanAssignment(planId: string, input: TrainingPlanAssignmentInput): Promise<TrainingPlanAssignment> {
  const res = await api.post<{ assignment: ApiTrainingPlanAssignment }>(`/training-plans/${planId}/assignments`, input);
  return toFrontendAssignment(res.assignment);
}

export async function updateTrainingPlanAssignment(
  planId: string,
  assignmentId: string,
  input: Partial<TrainingPlanAssignmentInput>
): Promise<TrainingPlanAssignment> {
  const res = await api.patch<{ assignment: ApiTrainingPlanAssignment }>(`/training-plans/${planId}/assignments/${assignmentId}`, input);
  return toFrontendAssignment(res.assignment);
}

export async function deleteTrainingPlanAssignment(planId: string, assignmentId: string): Promise<void> {
  await api.delete(`/training-plans/${planId}/assignments/${assignmentId}`);
}

export async function createTrainingPlanResource(planId: string, input: TrainingPlanResourceInput): Promise<TrainingPlanResource> {
  const res = await api.post<{ resource: TrainingPlanResource }>(`/training-plans/${planId}/resources`, input);
  return res.resource;
}

export async function updateTrainingPlanResource(
  planId: string,
  resourceId: string,
  input: Partial<TrainingPlanResourceInput>
): Promise<TrainingPlanResource> {
  const res = await api.patch<{ resource: TrainingPlanResource }>(`/training-plans/${planId}/resources/${resourceId}`, input);
  return res.resource;
}

export async function deleteTrainingPlanResource(planId: string, resourceId: string): Promise<void> {
  await api.delete(`/training-plans/${planId}/resources/${resourceId}`);
}

export async function createTrainingPlanAnnouncement(
  planId: string,
  input: TrainingPlanAnnouncementInput
): Promise<TrainingPlanAnnouncement> {
  const res = await api.post<{ announcement: TrainingPlanAnnouncement }>(`/training-plans/${planId}/announcements`, input);
  return res.announcement;
}

export async function updateTrainingPlanAnnouncement(
  planId: string,
  announcementId: string,
  input: Partial<TrainingPlanAnnouncementInput>
): Promise<TrainingPlanAnnouncement> {
  const res = await api.patch<{ announcement: TrainingPlanAnnouncement }>(`/training-plans/${planId}/announcements/${announcementId}`, input);
  return res.announcement;
}

export async function deleteTrainingPlanAnnouncement(planId: string, announcementId: string): Promise<void> {
  await api.delete(`/training-plans/${planId}/announcements/${announcementId}`);
}
