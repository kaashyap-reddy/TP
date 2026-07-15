import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { feedbackFormBodySchema, updateFeedbackFormBodySchema } from '../validators/sessionFeedback.validator';

// Mirrors sessionFeedback.service.ts one-to-one, but the form hangs off an Assignment. The one
// structural difference: an assignment can span multiple batches (AssignmentBatch join), so
// enrollment checks and the totalTrainees stat consider every batch the assignment is assigned to.

async function getAssignmentOrThrow(assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    include: { batches: { select: { batchId: true } } }
  });
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  return assignment;
}

function batchIdsOf(assignment: { batchId: string; batches: { batchId: string }[] }): string[] {
  const ids = assignment.batches.map((b) => b.batchId);
  return ids.length > 0 ? ids : [assignment.batchId];
}

// facilitatorId is nullable — assignments generated from a Training Plan template usually have
// no individual owner, so only admin can manage those; once a trainer is set, that facilitator
// (or admin) can.
function assertOwnerOrAdmin(actor: AuthenticatedUser, facilitatorId: string | null) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === facilitatorId) return;
  throw ApiError.forbidden('You do not own this assignment.');
}

/** Admin: unrestricted. Facilitator: only their own assignment. Trainee: only if enrolled in one of the assignment's batches. */
async function assertAccess(
  actor: AuthenticatedUser,
  assignment: { batchId: string; facilitatorId: string | null; batches: { batchId: string }[] }
): Promise<void> {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === assignment.facilitatorId) return;
  if (actor.role === 'trainee') {
    const enrollment = await prisma.batchTrainee.findFirst({
      where: { traineeId: actor.id, removedAt: null, batchId: { in: batchIdsOf(assignment) } }
    });
    if (enrollment) return;
  }
  throw ApiError.forbidden('You do not have access to this assignment.');
}

async function withStats(formId: string, batchIds: string[]) {
  const [submittedCount, totalTrainees] = await Promise.all([
    prisma.assignmentFeedbackSubmission.count({ where: { formId } }),
    prisma.batchTrainee.count({ where: { batchId: { in: batchIds }, removedAt: null } })
  ]);
  return { submittedCount, totalTrainees };
}

/** Whether this actor is a legitimate respondent for a form with this audience — same rule as session feedback. */
function isRespondent(actor: AuthenticatedUser, audience: string): boolean {
  if (actor.role === 'trainee') return audience === 'Trainees' || audience === 'Both';
  if (actor.role === 'facilitator') return audience === 'Facilitators' || audience === 'Both';
  return false;
}

export async function attach(actor: AuthenticatedUser, assignmentId: string, input: z.infer<typeof feedbackFormBodySchema>) {
  const assignment = await getAssignmentOrThrow(assignmentId);
  assertOwnerOrAdmin(actor, assignment.facilitatorId);

  const existing = await prisma.assignmentFeedbackForm.findUnique({ where: { assignmentId } });
  if (existing) throw ApiError.conflict('This assignment already has a feedback form attached — edit it instead.');

  const form = await prisma.assignmentFeedbackForm.create({
    data: { assignmentId, name: input.name, description: input.description, formUrl: input.formUrl, audience: input.audience, createdBy: actor.id }
  });
  return { ...form, ...(await withStats(form.id, batchIdsOf(assignment))) };
}

export async function update(actor: AuthenticatedUser, assignmentId: string, input: z.infer<typeof updateFeedbackFormBodySchema>) {
  const assignment = await getAssignmentOrThrow(assignmentId);
  assertOwnerOrAdmin(actor, assignment.facilitatorId);

  const existing = await prisma.assignmentFeedbackForm.findUnique({ where: { assignmentId } });
  if (!existing) throw ApiError.notFound('No feedback form attached to this assignment yet.');

  const form = await prisma.assignmentFeedbackForm.update({
    where: { assignmentId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.formUrl !== undefined ? { formUrl: input.formUrl } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {})
    }
  });
  return { ...form, ...(await withStats(form.id, batchIdsOf(assignment))) };
}

export async function remove(actor: AuthenticatedUser, assignmentId: string): Promise<void> {
  const assignment = await getAssignmentOrThrow(assignmentId);
  assertOwnerOrAdmin(actor, assignment.facilitatorId);

  const existing = await prisma.assignmentFeedbackForm.findUnique({ where: { assignmentId } });
  if (!existing) throw ApiError.notFound('No feedback form attached to this assignment.');

  await prisma.assignmentFeedbackForm.delete({ where: { assignmentId } });
}

export async function getForAssignment(actor: AuthenticatedUser, assignmentId: string) {
  const assignment = await getAssignmentOrThrow(assignmentId);
  await assertAccess(actor, assignment);

  const form = await prisma.assignmentFeedbackForm.findUnique({ where: { assignmentId } });
  if (!form) return null;

  // Audience gating — identical to sessionFeedback.service.ts getForSession().
  const isManager = actor.role === 'admin' || (actor.role === 'facilitator' && actor.id === assignment.facilitatorId);
  if (!isManager) {
    if (actor.role === 'trainee' && form.audience === 'Facilitators') return null;
    if (actor.role === 'facilitator' && form.audience === 'Trainees') return null;
  }

  const respondent = isRespondent(actor, form.audience);
  const mySubmission = respondent
    ? await prisma.assignmentFeedbackSubmission.findUnique({
        where: { formId_submitterId: { formId: form.id, submitterId: actor.id } }
      })
    : null;

  return {
    ...form,
    ...(await withStats(form.id, batchIdsOf(assignment))),
    mySubmitted: respondent ? mySubmission !== null : null
  };
}

export async function submit(actor: AuthenticatedUser, assignmentId: string) {
  const assignment = await getAssignmentOrThrow(assignmentId);
  if (actor.role !== 'trainee' && actor.role !== 'facilitator') {
    throw ApiError.forbidden('Only trainees and facilitators submit assignment feedback.');
  }
  await assertAccess(actor, assignment);

  const form = await prisma.assignmentFeedbackForm.findUnique({ where: { assignmentId } });
  if (!form) throw ApiError.notFound('No feedback form attached to this assignment.');
  if (!isRespondent(actor, form.audience)) throw ApiError.forbidden('This feedback form is not for your role.');

  return prisma.assignmentFeedbackSubmission.upsert({
    where: { formId_submitterId: { formId: form.id, submitterId: actor.id } },
    create: { formId: form.id, submitterId: actor.id },
    update: {}
  });
}
