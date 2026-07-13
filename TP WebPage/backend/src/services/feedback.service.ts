import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { createFeedbackSchema, listFeedbackQuerySchema } from '../validators/feedback.validator';

const include = {
  trainee: { select: { id: true, name: true, email: true } },
  facilitator: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } }
} satisfies Prisma.FeedbackEntryInclude;

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
