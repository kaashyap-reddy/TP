import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { isOnBatchTeam } from './facilitatorAssignments.service';
import { createFeedbackSchema, listFeedbackQuerySchema } from '../validators/feedback.validator';

const include = {
  trainee: { select: { id: true, name: true, email: true } },
  facilitator: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } }
} satisfies Prisma.FeedbackEntryInclude;

/** Batches a facilitator owns (denormalized POC cache) or is an active team member of. */
async function accessibleBatchIdsForFacilitator(facilitatorId: string): Promise<string[]> {
  const [ownedBatches, teamAssignments] = await Promise.all([
    prisma.batch.findMany({ where: { facilitatorId, deletedAt: null }, select: { id: true } }),
    prisma.batchFacilitator.findMany({ where: { facilitatorId, status: { not: 'Removed' } }, select: { batchId: true } })
  ]);
  return [...new Set([...ownedBatches.map((b) => b.id), ...teamAssignments.map((a) => a.batchId)])];
}

export async function list(actor: AuthenticatedUser, query: z.infer<typeof listFeedbackQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.FeedbackEntryWhereInput = {
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.direction ? { direction: query.direction } : {}),
    ...(query.facilitatorId ? { facilitatorId: query.facilitatorId } : {}),
    // A trainee is always the "traineeId" party on a feedback row regardless of who authored it
    // (see create() below), so forcing this filter for trainee actors — and ignoring whatever
    // traineeId they requested — keeps every other trainee's feedback out of their results.
    ...(actor.role === 'trainee' ? { traineeId: actor.id } : query.traineeId ? { traineeId: query.traineeId } : {})
  };

  // A facilitator previously had no batch scoping at all here — restrict to batches they own or
  // are an active team member of, same as every other batch-scoped list in this backend.
  if (actor.role === 'facilitator') {
    const accessibleBatchIds = await accessibleBatchIdsForFacilitator(actor.id);
    if (query.batchId && !accessibleBatchIds.includes(query.batchId)) {
      throw ApiError.forbidden('You do not have access to this batch.');
    }
    where.batchId = query.batchId ?? { in: accessibleBatchIds };
  }

  const [entries, total] = await prisma.$transaction([
    prisma.feedbackEntry.findMany({ where, include, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.feedbackEntry.count({ where })
  ]);

  return buildPaginatedResponse(entries, total, page, pageSize);
}

export async function getById(actor: AuthenticatedUser, id: string) {
  const entry = await prisma.feedbackEntry.findUnique({ where: { id }, include });
  if (!entry) throw ApiError.notFound('Feedback entry not found.');
  if (actor.role === 'trainee' && entry.traineeId !== actor.id) {
    throw ApiError.forbidden('You do not have access to this feedback entry.');
  }
  // A facilitator previously had no check at all here — restrict to entries about them
  // specifically, or any entry within a batch they own/team-member of.
  if (actor.role === 'facilitator' && entry.facilitatorId !== actor.id && !(await isOnBatchTeam(actor.id, entry.batchId))) {
    throw ApiError.forbidden('You do not have access to this feedback entry.');
  }
  return entry;
}

export async function create(actor: AuthenticatedUser, input: z.infer<typeof createFeedbackSchema>) {
  if (actor.role === 'trainee') {
    if (!input.facilitatorId) throw ApiError.badRequest('facilitatorId is required.');

    const enrollment = await prisma.batchTrainee.findUnique({
      where: { batchId_traineeId: { batchId: input.batchId, traineeId: actor.id } }
    });
    if (!enrollment || enrollment.removedAt) {
      throw ApiError.forbidden('You are not enrolled in this batch.');
    }

    const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
    if (!batch || batch.facilitatorId !== input.facilitatorId) {
      throw ApiError.forbidden('You may only give feedback about the facilitator assigned to your batch.');
    }

    return prisma.feedbackEntry.create({
      data: {
        batchId: input.batchId,
        traineeId: actor.id,
        facilitatorId: input.facilitatorId,
        category: input.category,
        rating: input.rating,
        comment: input.comment,
        direction: 'TraineeToFacilitator'
      },
      include
    });
  }

  // admin/facilitator authoring feedback about a trainee (existing behavior).
  if (!input.traineeId) throw ApiError.badRequest('traineeId is required.');

  // Previously unchecked — any facilitator could author feedback about a trainee in any batch.
  // Restrict to the facilitator's own (owned or team-member) batches; admin is unrestricted.
  if (actor.role === 'facilitator') {
    const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
    if (!batch) throw ApiError.badRequest('No such batch.');
    if (batch.facilitatorId !== actor.id && !(await isOnBatchTeam(actor.id, input.batchId))) {
      throw ApiError.forbidden('You may only give feedback within your own batch.');
    }
  }

  const enrollment = await prisma.batchTrainee.findUnique({
    where: { batchId_traineeId: { batchId: input.batchId, traineeId: input.traineeId } }
  });
  if (!enrollment || enrollment.removedAt) {
    throw ApiError.badRequest('That trainee is not enrolled in this batch.');
  }

  return prisma.feedbackEntry.create({
    data: {
      batchId: input.batchId,
      traineeId: input.traineeId,
      facilitatorId: actor.id,
      category: input.category,
      rating: input.rating,
      comment: input.comment,
      direction: 'FacilitatorToTrainee'
    },
    include
  });
}
