import type { Batch } from '../../types/batch';
import { findUserIdByName } from './userService';
import { api } from './apiClient';

type ApiProgram = 'BA' | 'DataEngineering' | 'AIML' | 'UIUX';

const PROGRAM_TO_API: Record<Batch['program'], ApiProgram> = {
  BA: 'BA',
  'Data Engineering': 'DataEngineering',
  'AI ML': 'AIML',
  'UI/UX': 'UIUX'
};

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
  program: Batch['program'];
  track: Batch['track'];
  poc: string;
  startMonth: string;
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
  const facilitatorId = (await findUserIdByName(input.poc, 'facilitator')) ?? undefined;

  const created = await api.post<{ batch: ApiBatch }>('/batches', {
    code: `${slugify(input.name)}-${Date.now().toString(36).slice(-4)}`,
    name: input.name,
    program: PROGRAM_TO_API[input.program],
    track: input.track,
    facilitatorId,
    startMonth: monthNameToDate(input.startMonth)
  });

  if (input.members?.length) {
    await enrollByName(created.batch.id, input.members);
  }

  return toFrontendBatch(created.batch);
}

export async function updateBatch(id: string, changes: Partial<Batch>): Promise<Batch> {
  const { poc, program, track, startMonth, status, name, members } = changes;

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (program !== undefined) patch.program = PROGRAM_TO_API[program];
  if (track !== undefined) patch.track = track;
  if (status !== undefined) patch.status = status;
  if (startMonth !== undefined) patch.startMonth = monthNameToDate(startMonth);
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
