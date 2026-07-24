import type { Batch } from '../../types/batch';
import { findUserIdByName } from './userService';
import { api } from './apiClient';

type ApiProgram = 'BA' | 'DataEngineering' | 'AIML' | 'UIUX';

const PROGRAM_FROM_API: Record<ApiProgram, Batch['program']> = {
  BA: 'BA',
  DataEngineering: 'Data Engineering',
  AIML: 'AI ML',
  UIUX: 'UI/UX'
};

interface ApiBatch {
  id: string;
  code: string;
  name: string;
  program: ApiProgram;
  track: Batch['track'];
  status: Batch['status'];
  startMonth: string | null;
  endDate: string | null;
  facilitator: { id: string; name: string; email: string } | null;
  trainingPlan: { id: string; code: string; name: string } | null;
}

interface ApiBatchMetrics {
  traineeCount: number;
  avgScore: number | null;
  completionPct: number | null;
  attendanceRate: number | null;
  submissionRate: number | null;
  feedbackRating: number | null;
}

// Embedded directly on each row by GET /batches (see backend's batches.service.ts) — avoids the
// GET /batches/:id/trainees + GET /batches/:id/metrics round-trips per batch that listBatches()
// previously made for every batch after listing.
interface ApiBatchListItem extends ApiBatch {
  members: string[];
  metrics: ApiBatchMetrics;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function monthNameToDate(monthName: string): string | undefined {
  const trimmed = monthName.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(`${trimmed} 1, ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function dateToMonthName(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'long' });
}

function toFrontendBatchBase(apiBatch: ApiBatch, metrics: ApiBatchMetrics, members: string[]): Batch {
  return {
    id: apiBatch.id,
    code: apiBatch.code,
    name: apiBatch.name,
    program: PROGRAM_FROM_API[apiBatch.program],
    track: apiBatch.track,
    trainingPlanId: apiBatch.trainingPlan?.id ?? null,
    trainingPlanName: apiBatch.trainingPlan?.name ?? null,
    poc: apiBatch.facilitator?.name ?? '',
    pocId: apiBatch.facilitator?.id ?? null,
    traineeCount: metrics.traineeCount,
    startMonth: dateToMonthName(apiBatch.startMonth),
    startDate: apiBatch.startMonth ?? null,
    endDate: apiBatch.endDate ?? null,
    avgScore: metrics.avgScore,
    completion: metrics.completionPct,
    attendanceRate: metrics.attendanceRate,
    submissionRate: metrics.submissionRate,
    feedbackRating: metrics.feedbackRating,
    status: apiBatch.status,
    members
  };
}

/** For single-batch results (create/update) that don't come with metrics/trainees embedded. */
async function toFrontendBatch(apiBatch: ApiBatch): Promise<Batch> {
  const [traineesPage, metricsRes] = await Promise.all([
    api.get<PaginatedResponse<{ id: string; name: string }>>(`/batches/${apiBatch.id}/trainees`, { pageSize: 100 }),
    api.get<{ metrics: ApiBatchMetrics }>(`/batches/${apiBatch.id}/metrics`)
  ]);

  return toFrontendBatchBase(apiBatch, metricsRes.metrics, traineesPage.data.map((t) => t.name));
}

export async function listBatches(filters?: { facilitatorId?: string; traineeId?: string }): Promise<Batch[]> {
  const res = await api.get<PaginatedResponse<ApiBatchListItem>>('/batches', { ...filters, pageSize: 100 });
  return res.data.map((apiBatch) => toFrontendBatchBase(apiBatch, apiBatch.metrics, apiBatch.members));
}

export interface CreateBatchInput {
  name: string;
  /** Every batch belongs to exactly one Training Plan (currently BA BTech or BA MBA) — program/track are derived server-side from it. */
  trainingPlanId: string;
  /** ISO date string (e.g. straight from a native date picker) — the batch's Start Date. Everything else (end date, ~42 sessions, assignments, resources, announcements, feedback links) is generated automatically from it. */
  startDate: string;
  /** Optional Trainer/POC — the org's workflow doesn't require one at batch-creation time (same as Session/Assignment "Trainer"). */
  poc?: string;
  members?: string[];
  /** Accepted for call-site compatibility with the CSV-onboarding form; traineeCount is always server-derived from real enrollments, so this has no effect. */
  traineeCount?: number;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'batch'
  );
}

async function enrollByName(batchId: string, names: string[]): Promise<void> {
  for (const name of names) {
    const traineeId = await findUserIdByName(name, 'trainee');
    if (traineeId) {
      await api.post(`/batches/${batchId}/trainees`, { traineeId }).catch(() => undefined);
    }
  }
}

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const facilitatorId = input.poc ? await findUserIdByName(input.poc, 'facilitator') : undefined;

  const created = await api.post<{ batch: ApiBatch }>('/batches', {
    code: `${slugify(input.name)}-${Date.now().toString(36).slice(-4)}`,
    name: input.name,
    trainingPlanId: input.trainingPlanId,
    facilitatorId,
    startMonth: input.startDate ? new Date(input.startDate).toISOString() : undefined
  });

  if (input.members?.length) {
    await enrollByName(created.batch.id, input.members);
  }

  return toFrontendBatch(created.batch);
}

export async function updateBatch(id: string, changes: Partial<Batch>): Promise<Batch> {
  // trainingPlanId is immutable after creation (see backend's updateBatchSchema) — program/track
  // are derived from it, so they aren't independently editable either.
  const { poc, startMonth, startDate, status, name, code, endDate, members } = changes;

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (code !== undefined) patch.code = code;
  if (status !== undefined) patch.status = status;
  // startDate (a real ISO date, e.g. from a date picker) takes precedence over the lossy
  // month-name-only startMonth path -- monthNameToDate() always anchors to the *current* year,
  // which silently corrupts any batch not starting in the current calendar year.
  if (startDate !== undefined) patch.startMonth = startDate ? new Date(startDate).toISOString() : undefined;
  else if (startMonth !== undefined) patch.startMonth = monthNameToDate(startMonth);
  if (endDate !== undefined) patch.endDate = endDate ? new Date(endDate).toISOString() : null;
  if (poc !== undefined) {
    patch.facilitatorId = (await findUserIdByName(poc, 'facilitator')) ?? null;
  }

  let updated: { batch: ApiBatch };
  if (Object.keys(patch).length > 0) {
    updated = await api.patch<{ batch: ApiBatch }>(`/batches/${id}`, patch);
  } else {
    updated = await api.get<{ batch: ApiBatch }>(`/batches/${id}`);
  }

  if (members) {
    // The mock model only ever appends names via this action; resolve any not-yet-enrolled names.
    const current = await api.get<PaginatedResponse<{ id: string; name: string }>>(`/batches/${id}/trainees`, { pageSize: 100 });
    const currentNames = new Set(current.data.map((t) => t.name));
    const newNames = members.filter((m) => !currentNames.has(m));
    await enrollByName(id, newNames);
  }

  return toFrontendBatch(updated.batch);
}

export async function deleteBatch(id: string): Promise<void> {
  await api.delete(`/batches/${id}`);
}

export interface BatchTraineeStats {
  id: string;
  name: string;
  email: string;
  attendancePercentage: number | null;
  assignmentsCompleted: number;
  assignmentsPending: number;
  avgGrade: number | null;
  latestSubmissionStatus: string | null;
  overallProgress: number | null;
  feedbackGiven: boolean;
}

/** Per-trainee stats for a batch's Facilitator "Batch Details" view (admin or the owning facilitator only). */
export async function listBatchTraineeStats(batchId: string): Promise<BatchTraineeStats[]> {
  const res = await api.get<{ trainees: BatchTraineeStats[] }>(`/batches/${batchId}/trainee-stats`);
  return res.trainees;
}
