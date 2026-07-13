import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import {
  createBatchSchema,
  enrollTraineeSchema,
  listBatchesQuerySchema,
  listBatchTraineesQuerySchema,
  updateBatchSchema
} from '../validators/batches.validator';

const include = { facilitator: { select: { id: true, name: true, email: true } } } satisfies Prisma.BatchInclude;

// Embedded on every list row alongside `metrics` (below) — every dashboard that lists batches
// (Admin/Facilitator/Trainee) reads member names directly, not just a count, so this can't be
// trimmed down to _count. Nested one-to-many includes like this are batched by Prisma into a
// single extra query across the whole page, not one query per batch.
const listInclude = {
  ...include,
  trainees: { where: { removedAt: null }, select: { trainee: { select: { name: true } } } }
} satisfies Prisma.BatchInclude;

interface BatchMetrics {
  traineeCount: number;
  avgScore: number | null;
  completionPct: number | null;
  attendanceRate: number | null;
  submissionRate: number | null;
  feedbackRating: number | null;
}

function pctOf(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10000) / 100;
}

/**
 * Same figures as getMetrics() below, but for a whole page of batches in a fixed number of
 * queries (4) instead of one round trip per batch. Submission/Attendance don't carry batchId
 * directly (only via assignment/session), so this fetches the relevant rows once each and
 * aggregates them in memory per batch rather than issuing a per-batch query — the thing that
 * previously made GET /batches trigger a GET /batches/:id/metrics per row on the frontend.
 */
async function getMetricsForBatches(batchIds: string[]): Promise<Map<string, BatchMetrics>> {
  const result = new Map<string, BatchMetrics>();
  if (batchIds.length === 0) return result;

  const [traineeCounts, submissions, attendanceRecords, feedbackAverages] = await Promise.all([
    prisma.batchTrainee.groupBy({ by: ['batchId'], where: { batchId: { in: batchIds }, removedAt: null }, _count: true }),
    prisma.submission.findMany({
      where: { assignment: { batchId: { in: batchIds } } },
      select: { grade: true, status: true, assignment: { select: { batchId: true } } }
    }),
    prisma.attendance.findMany({
      where: { session: { batchId: { in: batchIds } } },
      select: { status: true, session: { select: { batchId: true } } }
    }),
    prisma.feedbackEntry.groupBy({ by: ['batchId'], where: { batchId: { in: batchIds } }, _avg: { rating: true } })
  ]);

  const traineeCountByBatch = new Map(traineeCounts.map((r) => [r.batchId, r._count]));
  const feedbackRatingByBatch = new Map(feedbackAverages.map((r) => [r.batchId, r._avg.rating]));

  const submissionsByBatch = new Map<string, typeof submissions>();
  for (const submission of submissions) {
    const batchId = submission.assignment.batchId;
    const list = submissionsByBatch.get(batchId);
    if (list) list.push(submission);
    else submissionsByBatch.set(batchId, [submission]);
  }

  const attendanceByBatch = new Map<string, typeof attendanceRecords>();
  for (const record of attendanceRecords) {
    const batchId = record.session.batchId;
    const list = attendanceByBatch.get(batchId);
    if (list) list.push(record);
    else attendanceByBatch.set(batchId, [record]);
  }

  for (const batchId of batchIds) {
    const batchSubmissions = submissionsByBatch.get(batchId) ?? [];
    const grades = batchSubmissions.filter((s) => s.grade !== null).map((s) => Number(s.grade));
    const completed = batchSubmissions.filter((s) => s.status === 'Completed').length;
    const counted = batchSubmissions.filter((s) => s.status === 'Completed' || s.status === 'UnderReview' || s.status === 'Late').length;

    const batchAttendance = attendanceByBatch.get(batchId) ?? [];
    const present = batchAttendance.filter((a) => a.status === 'Present').length;

    result.set(batchId, {
      traineeCount: traineeCountByBatch.get(batchId) ?? 0,
      avgScore: grades.length > 0 ? Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100 : null,
      completionPct: pctOf(completed, batchSubmissions.length),
      attendanceRate: pctOf(present, batchAttendance.length),
      submissionRate: pctOf(counted, batchSubmissions.length),
      feedbackRating: feedbackRatingByBatch.get(batchId) ?? null
    });
  }

  return result;
}

async function assertRole(userId: string, expected: 'facilitator' | 'trainee') {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.badRequest(`No such user.`);
  if (user.role.name !== expected) throw ApiError.badRequest(`User is not a ${expected}.`);
  return user;
}

/** Admin: unrestricted. Facilitator: only the batch they're assigned to. Trainee: only if enrolled. */
async function assertBatchAccess(actor: AuthenticatedUser, batch: { id: string; facilitatorId: string | null }): Promise<void> {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator') {
    if (actor.id === batch.facilitatorId) return;
    throw ApiError.forbidden('You do not have access to this batch.');
  }
  const enrollment = await prisma.batchTrainee.findUnique({ where: { batchId_traineeId: { batchId: batch.id, traineeId: actor.id } } });
  if (!enrollment || enrollment.removedAt) throw ApiError.forbidden('You are not enrolled in this batch.');
}

/** Admin: unrestricted. Facilitator: only the batch they're assigned to. Trainee: never. */
function assertFacilitatorOrAdminAccess(actor: AuthenticatedUser, batch: { facilitatorId: string | null }): void {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === batch.facilitatorId) return;
  throw ApiError.forbidden('You do not have access to this batch.');
}

export async function list(query: z.infer<typeof listBatchesQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.BatchWhereInput = {
    deletedAt: null,
    ...(query.program ? { program: query.program } : {}),
    ...(query.track ? { track: query.track } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.facilitatorId ? { facilitatorId: query.facilitatorId } : {}),
    ...(query.traineeId ? { trainees: { some: { traineeId: query.traineeId, removedAt: null } } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  const [batches, total] = await prisma.$transaction([
    prisma.batch.findMany({ where, include: listInclude, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.batch.count({ where })
  ]);

  const metricsByBatch = await getMetricsForBatches(batches.map((b) => b.id));
  const enriched = batches.map(({ trainees, ...batch }) => ({
    ...batch,
    members: trainees.map((t) => t.trainee.name),
    metrics: metricsByBatch.get(batch.id)
  }));

  return buildPaginatedResponse(enriched, total, page, pageSize);
}

export async function getById(id: string) {
  const batch = await prisma.batch.findFirst({ where: { id, deletedAt: null }, include });
  if (!batch) throw ApiError.notFound('Batch not found.');
  return batch;
}

export async function create(input: z.infer<typeof createBatchSchema>) {
  if (input.facilitatorId) await assertRole(input.facilitatorId, 'facilitator');

  const existingCode = await prisma.batch.findUnique({ where: { code: input.code } });
  if (existingCode) throw ApiError.conflict('A batch with this code already exists.');

  return prisma.batch.create({ data: input, include });
}

export async function update(id: string, input: z.infer<typeof updateBatchSchema>) {
  const existing = await prisma.batch.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Batch not found.');

  if (input.facilitatorId) await assertRole(input.facilitatorId, 'facilitator');

  return prisma.batch.update({ where: { id }, data: input, include });
}

export async function softDelete(id: string): Promise<void> {
  const existing = await prisma.batch.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Batch not found.');

  await prisma.batch.update({ where: { id }, data: { deletedAt: new Date(), archivedAt: new Date() } });
}

export async function getMetrics(actor: AuthenticatedUser, id: string) {
  const batch = await getById(id);
  await assertBatchAccess(actor, batch);

  const [traineeCount, gradeAgg, submissionTotal, submissionCompleted, submissionCounted, attendanceTotal, presentCount, feedbackAgg] =
    await prisma.$transaction([
      prisma.batchTrainee.count({ where: { batchId: id, removedAt: null } }),
      prisma.submission.aggregate({
        where: { assignment: { batchId: id }, grade: { not: null } },
        _avg: { grade: true }
      }),
      prisma.submission.count({ where: { assignment: { batchId: id } } }),
      prisma.submission.count({ where: { assignment: { batchId: id }, status: 'Completed' } }),
      prisma.submission.count({ where: { assignment: { batchId: id }, status: { in: ['Completed', 'UnderReview', 'Late'] } } }),
      prisma.attendance.count({ where: { session: { batchId: id } } }),
      prisma.attendance.count({ where: { session: { batchId: id }, status: 'Present' } }),
      prisma.feedbackEntry.aggregate({ where: { batchId: id }, _avg: { rating: true } })
    ]);

  const pct = (numerator: number, denominator: number) =>
    denominator === 0 ? null : Math.round((numerator / denominator) * 10000) / 100;

  return {
    traineeCount,
    avgScore: gradeAgg._avg.grade ? Number(gradeAgg._avg.grade) : null,
    completionPct: pct(submissionCompleted, submissionTotal),
    attendanceRate: pct(presentCount, attendanceTotal),
    submissionRate: pct(submissionCounted, submissionTotal),
    feedbackRating: feedbackAgg._avg.rating ?? null
  };
}

export async function listTrainees(actor: AuthenticatedUser, batchId: string, query: z.infer<typeof listBatchTraineesQuerySchema>) {
  const batch = await getById(batchId);

  // A trainee may only see the roster of a batch they're actually enrolled in, and a facilitator
  // only the roster of a batch they're assigned to — otherwise this endpoint would let anyone
  // browse any other batch's membership (names, emails).
  await assertBatchAccess(actor, batch);

  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.BatchTraineeWhereInput = {
    batchId,
    removedAt: null,
    ...(query.search
      ? {
          trainee: {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } }
            ]
          }
        }
      : {})
  };

  const [rows, total] = await prisma.$transaction([
    prisma.batchTrainee.findMany({
      where,
      include: { trainee: { select: { id: true, name: true, email: true } } },
      skip,
      take,
      orderBy: { enrolledAt: 'desc' }
    }),
    prisma.batchTrainee.count({ where })
  ]);

  return buildPaginatedResponse(
    rows.map((r) => ({ ...r.trainee, enrolledAt: r.enrolledAt })),
    total,
    page,
    pageSize
  );
}

export async function enrollTrainee(batchId: string, input: z.infer<typeof enrollTraineeSchema>) {
  await getById(batchId);
  await assertRole(input.traineeId, 'trainee');

  const existing = await prisma.batchTrainee.findUnique({
    where: { batchId_traineeId: { batchId, traineeId: input.traineeId } }
  });

  if (existing && !existing.removedAt) {
    throw ApiError.conflict('Trainee is already enrolled in this batch.');
  }

  if (existing) {
    return prisma.batchTrainee.update({
      where: { batchId_traineeId: { batchId, traineeId: input.traineeId } },
      data: { removedAt: null, enrolledAt: new Date() }
    });
  }

  return prisma.batchTrainee.create({ data: { batchId, traineeId: input.traineeId } });
}

export async function unenrollTrainee(batchId: string, traineeId: string): Promise<void> {
  const existing = await prisma.batchTrainee.findUnique({ where: { batchId_traineeId: { batchId, traineeId } } });
  if (!existing || existing.removedAt) throw ApiError.notFound('Trainee is not enrolled in this batch.');

  await prisma.batchTrainee.update({
    where: { batchId_traineeId: { batchId, traineeId } },
    data: { removedAt: new Date() }
  });
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

/**
 * Per-trainee breakdown for a single batch's Facilitator "Batch Details" view. Restricted to
 * admin and the batch's own facilitator — this exposes every trainee's grades/attendance, which
 * a facilitator managing a different batch (or a trainee) has no business seeing.
 */
export async function listTraineeStats(actor: AuthenticatedUser, batchId: string): Promise<BatchTraineeStats[]> {
  const batch = await getById(batchId);
  assertFacilitatorOrAdminAccess(actor, batch);

  const enrollments = await prisma.batchTrainee.findMany({
    where: { batchId, removedAt: null },
    include: { trainee: { select: { id: true, name: true, email: true } } },
    orderBy: { enrolledAt: 'desc' }
  });
  if (enrollments.length === 0) return [];

  const traineeIds = enrollments.map((e) => e.traineeId);

  const [assignments, attendanceRecords, feedbackEntries] = await Promise.all([
    prisma.assignment.findMany({
      where: { deletedAt: null, batches: { some: { batchId } } },
      select: {
        submissions: {
          where: { traineeId: { in: traineeIds } },
          select: { traineeId: true, status: true, grade: true, submittedAt: true }
        }
      }
    }),
    prisma.attendance.findMany({
      where: { traineeId: { in: traineeIds }, session: { batchId } },
      select: { traineeId: true, status: true }
    }),
    prisma.feedbackEntry.findMany({ where: { batchId, traineeId: { in: traineeIds } }, select: { traineeId: true } })
  ]);

  const feedbackTraineeIds = new Set(feedbackEntries.map((f) => f.traineeId));
  const totalAssignments = assignments.length;

  return enrollments.map(({ trainee }) => {
    const submissions = assignments.flatMap((a) => a.submissions.filter((s) => s.traineeId === trainee.id));
    const completed = submissions.filter((s) => s.status === 'Completed').length;
    const pending = Math.max(totalAssignments - completed, 0);
    const grades = submissions.filter((s) => s.grade !== null).map((s) => Number(s.grade));
    const avgGrade = grades.length > 0 ? Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100 : null;
    const latestSubmission = submissions
      .filter((s) => s.submittedAt !== null)
      .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime())[0];

    const traineeAttendance = attendanceRecords.filter((a) => a.traineeId === trainee.id);
    const present = traineeAttendance.filter((a) => a.status === 'Present').length;

    return {
      id: trainee.id,
      name: trainee.name,
      email: trainee.email,
      attendancePercentage: pctOf(present, traineeAttendance.length),
      assignmentsCompleted: completed,
      assignmentsPending: pending,
      avgGrade,
      latestSubmissionStatus: latestSubmission?.status ?? null,
      overallProgress: pctOf(completed, totalAssignments),
      feedbackGiven: feedbackTraineeIds.has(trainee.id)
    };
  });
}
