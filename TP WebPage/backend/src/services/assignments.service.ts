import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { getStorageProvider } from './storage';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { createAssignmentSchema, listAssignmentsQuerySchema, updateAssignmentSchema } from '../validators/assignments.validator';

// Submissions are embedded directly (not just a count) because every consumer of the list
// endpoint (Admin/Facilitator/Trainee dashboards) needs per-submission status/grade/trainee to
// compute their own breakdowns — see frontend/src/services/api/assignmentService.ts. Prisma
// batches this nested include into one extra query across the whole page of results, not one
// query per assignment, which is what previously made the frontend do N extra HTTP round-trips
// (GET /assignments/:id/submissions for every assignment) after listing.
// `facilitator` is intentionally NOT included here — assignments belong to a Training Plan, not
// an individual facilitator, so the API no longer surfaces one in list/detail responses (the
// underlying `facilitatorId` column still exists and is read directly off `existing`/`assignment`
// scalars for the assertOwnerOrAdmin() ownership check below, which doesn't need the join).
const include = {
  batch: { select: { id: true, name: true, code: true, trainingPlan: { select: { id: true, name: true } } } },
  batches: {
    include: { batch: { select: { id: true, name: true, code: true, trainingPlan: { select: { id: true, name: true } } } } }
  },
  session: { select: { id: true, title: true } },
  submissions: { include: { trainee: { select: { id: true, name: true, email: true } } } },
  feedbackForm: {
    select: { id: true, name: true, description: true, formUrl: true, audience: true, _count: { select: { submissions: true } } }
  }
} satisfies Prisma.AssignmentInclude;

type AssignmentWithIncludes = Prisma.AssignmentGetPayload<{ include: typeof include }>;

// facilitatorId is nullable — assignments generated from a Training Plan template usually have
// no individual owner. A null facilitatorId never matches an actor, so only admin can manage an
// unowned assignment; once a trainer is set, that facilitator (or admin) can.
function assertOwnerOrAdmin(actor: AuthenticatedUser, facilitatorId: string | null) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === facilitatorId) return;
  throw ApiError.forbidden('You do not own this assignment.');
}

// Every assignment always has at least one AssignmentBatch row (its primary `batch`, added at
// create time — see create() below), so `batches` here is the authoritative multi-batch list;
// the single `batch`/`batchId` fields are kept only for older frontend code paths that haven't
// been updated to read the array.
function serialize(assignment: AssignmentWithIncludes) {
  const { batches = [], attachmentStorageKey, attachmentOriginalFilename, attachmentMimeType, attachmentSizeBytes, ...rest } = assignment;
  return {
    ...rest,
    batches: batches.map((b) => b.batch),
    attachment: attachmentStorageKey
      ? { originalFilename: attachmentOriginalFilename, mimeType: attachmentMimeType, sizeBytes: attachmentSizeBytes }
      : null
  };
}

// An assignment's embedded feedback form shouldn't leak to a role it isn't meant for — same rule
// as sessions.service.ts's withFeedbackFormVisibility() and assignmentFeedback.service.ts's
// getForAssignment(). `actor` is optional only because a couple of internal callers (and tests)
// don't have one; the HTTP handlers always pass req.user.
function withFeedbackFormVisibility<T extends { facilitatorId: string | null; feedbackForm: { audience: string } | null }>(
  actor: AuthenticatedUser | undefined,
  assignment: T
): T {
  if (!actor || !assignment.feedbackForm) return assignment;
  const isManager = actor.role === 'admin' || (actor.role === 'facilitator' && actor.id === assignment.facilitatorId);
  if (isManager) return assignment;
  if (actor.role === 'trainee' && assignment.feedbackForm.audience === 'Facilitators') return { ...assignment, feedbackForm: null };
  if (actor.role === 'facilitator' && assignment.feedbackForm.audience === 'Trainees') return { ...assignment, feedbackForm: null };
  return assignment;
}

async function assertBatchesExist(batchIds: string[]): Promise<void> {
  const batches = await prisma.batch.findMany({ where: { id: { in: batchIds }, deletedAt: null } });
  if (batches.length !== batchIds.length) throw ApiError.badRequest('One or more selected batches do not exist.');
}

export async function list(query: z.infer<typeof listAssignmentsQuerySchema>, actor?: AuthenticatedUser) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.AssignmentWhereInput = {
    deletedAt: null,
    ...(query.batchId ? { batches: { some: { batchId: query.batchId } } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {})
  };

  const [assignments, total] = await prisma.$transaction([
    prisma.assignment.findMany({ where, include, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.assignment.count({ where })
  ]);

  return buildPaginatedResponse(
    assignments.map((a) => serialize(withFeedbackFormVisibility(actor, a))),
    total,
    page,
    pageSize
  );
}

export async function getById(id: string, actor?: AuthenticatedUser) {
  const assignment = await prisma.assignment.findFirst({ where: { id, deletedAt: null }, include });
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  return serialize(withFeedbackFormVisibility(actor, assignment));
}

export async function create(
  actor: AuthenticatedUser,
  input: z.infer<typeof createAssignmentSchema>,
  file?: Express.Multer.File
) {
  const batchIds = [...new Set(input.batchIds)];
  await assertBatchesExist(batchIds);

  let storageKey: string | undefined;
  if (file) storageKey = await getStorageProvider().save(file, 'assignments');

  try {
    const assignment = await prisma.assignment.create({
      data: {
        title: input.title,
        agenda: input.agenda,
        description: input.description,
        deadline: input.deadline,
        status: input.status,
        facilitatorId: actor.id,
        sessionId: input.sessionId,
        // Primary/first batch — see the schema comment on Assignment.batchId.
        batchId: batchIds[0],
        batches: { create: batchIds.map((batchId) => ({ batchId })) },
        ...(storageKey
          ? {
              attachmentOriginalFilename: file!.originalname,
              attachmentStorageKey: storageKey,
              attachmentMimeType: file!.mimetype,
              attachmentSizeBytes: file!.size
            }
          : {})
      },
      include
    });
    return serialize(assignment);
  } catch (err) {
    // The file already landed in storage before the DB write failed — don't leave it orphaned.
    if (storageKey) await getStorageProvider().remove(storageKey);
    throw err;
  }
}

export async function update(
  actor: AuthenticatedUser,
  id: string,
  input: z.infer<typeof updateAssignmentSchema>,
  file?: Express.Multer.File
) {
  const existing = await prisma.assignment.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Assignment not found.');
  assertOwnerOrAdmin(actor, existing.facilitatorId);

  let batchIds: string[] | undefined;
  if (input.batchIds) {
    batchIds = [...new Set(input.batchIds)];
    await assertBatchesExist(batchIds);
  }

  let newStorageKey: string | undefined;
  if (file) newStorageKey = await getStorageProvider().save(file, 'assignments');

  const data: Prisma.AssignmentUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.agenda !== undefined ? { agenda: input.agenda } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(batchIds ? { batchId: batchIds[0] } : {}),
    ...(newStorageKey
      ? {
          attachmentOriginalFilename: file!.originalname,
          attachmentStorageKey: newStorageKey,
          attachmentMimeType: file!.mimetype,
          attachmentSizeBytes: file!.size
        }
      : {})
  };

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      if (batchIds) {
        await tx.assignmentBatch.deleteMany({ where: { assignmentId: id } });
        await tx.assignmentBatch.createMany({ data: batchIds.map((batchId) => ({ assignmentId: id, batchId })) });
      }
      return tx.assignment.update({ where: { id }, data, include });
    });

    // Only remove the old file once the new one is safely committed.
    if (newStorageKey && existing.attachmentStorageKey) {
      await getStorageProvider().remove(existing.attachmentStorageKey);
    }
    return serialize(assignment);
  } catch (err) {
    if (newStorageKey) await getStorageProvider().remove(newStorageKey);
    throw err;
  }
}

export async function softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
  const existing = await prisma.assignment.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Assignment not found.');
  assertOwnerOrAdmin(actor, existing.facilitatorId);

  await prisma.assignment.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Authorizes and resolves an assignment's instructions-file attachment for viewing/downloading. */
export async function getAttachmentForView(actor: AuthenticatedUser, id: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id, deletedAt: null },
    include: { batches: { select: { batchId: true } } }
  });
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  if (!assignment.attachmentStorageKey) throw ApiError.notFound('No file uploaded for this assignment.');

  if (actor.role === 'admin') return assignment;

  const batchIds = assignment.batches.map((b) => b.batchId);

  if (actor.role === 'facilitator') {
    if (actor.id === assignment.facilitatorId) return assignment;
    const managesAssignedBatch = await prisma.batch.findFirst({ where: { id: { in: batchIds }, facilitatorId: actor.id } });
    if (managesAssignedBatch) return assignment;
    throw ApiError.forbidden('You do not have access to this assignment.');
  }

  const enrolled = await prisma.batchTrainee.findFirst({
    where: { traineeId: actor.id, removedAt: null, batchId: { in: batchIds } }
  });
  if (!enrolled) throw ApiError.forbidden('You do not have access to this assignment.');
  return assignment;
}
