import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { feedbackFormBodySchema, updateFeedbackFormBodySchema } from '../validators/sessionFeedback.validator';
import { assertOwnerOrAdmin } from './sessions.service';

async function getSessionOrThrow(sessionId: string) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, deletedAt: null } });
  if (!session) throw ApiError.notFound('Session not found.');
  return session;
}

/** Admin: unrestricted. Facilitator: only their own session. Trainee: only if enrolled in the session's batch. */
async function assertAccess(actor: AuthenticatedUser, session: { batchId: string; facilitatorId: string | null }): Promise<void> {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === session.facilitatorId) return;
  if (actor.role === 'trainee') {
    const enrollment = await prisma.batchTrainee.findUnique({
      where: { batchId_traineeId: { batchId: session.batchId, traineeId: actor.id } }
    });
    if (enrollment && !enrollment.removedAt) return;
  }
  throw ApiError.forbidden('You do not have access to this session.');
}

async function withStats(formId: string, batchId: string) {
  const [submittedCount, totalTrainees] = await Promise.all([
    prisma.sessionFeedbackSubmission.count({ where: { formId } }),
    prisma.batchTrainee.count({ where: { batchId, removedAt: null } })
  ]);
  return { submittedCount, totalTrainees };
}

/** Whether this actor is a legitimate respondent for a form with this audience — i.e. can submit/see "my submission" status, independent of whether they also manage the form. */
function isRespondent(actor: AuthenticatedUser, audience: string): boolean {
  if (actor.role === 'trainee') return audience === 'Trainees' || audience === 'Both';
  if (actor.role === 'facilitator') return audience === 'Facilitators' || audience === 'Both';
  return false;
}

export async function attach(actor: AuthenticatedUser, sessionId: string, input: z.infer<typeof feedbackFormBodySchema>) {
  const session = await getSessionOrThrow(sessionId);
  await assertOwnerOrAdmin(actor, session.facilitatorId, session.batchId);

  const existing = await prisma.sessionFeedbackForm.findUnique({ where: { sessionId } });
  if (existing) throw ApiError.conflict('This session already has a feedback form attached — edit it instead.');

  const form = await prisma.sessionFeedbackForm.create({
    data: { sessionId, name: input.name, description: input.description, formUrl: input.formUrl, audience: input.audience, createdBy: actor.id }
  });
  return { ...form, ...(await withStats(form.id, session.batchId)) };
}

export async function update(actor: AuthenticatedUser, sessionId: string, input: z.infer<typeof updateFeedbackFormBodySchema>) {
  const session = await getSessionOrThrow(sessionId);
  await assertOwnerOrAdmin(actor, session.facilitatorId, session.batchId);

  const existing = await prisma.sessionFeedbackForm.findUnique({ where: { sessionId } });
  if (!existing) throw ApiError.notFound('No feedback form attached to this session yet.');

  const form = await prisma.sessionFeedbackForm.update({
    where: { sessionId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.formUrl !== undefined ? { formUrl: input.formUrl } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {})
    }
  });
  return { ...form, ...(await withStats(form.id, session.batchId)) };
}

export async function remove(actor: AuthenticatedUser, sessionId: string): Promise<void> {
  const session = await getSessionOrThrow(sessionId);
  await assertOwnerOrAdmin(actor, session.facilitatorId, session.batchId);

  const existing = await prisma.sessionFeedbackForm.findUnique({ where: { sessionId } });
  if (!existing) throw ApiError.notFound('No feedback form attached to this session.');

  await prisma.sessionFeedbackForm.delete({ where: { sessionId } });
}

export async function getForSession(actor: AuthenticatedUser, sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  await assertAccess(actor, session);

  const form = await prisma.sessionFeedbackForm.findUnique({ where: { sessionId } });
  if (!form) return null;

  // Audience gating: a trainee only ever sees trainee-facing forms, and a facilitator who merely
  // has batch access (not the session's owning manager) only sees facilitator-facing forms.
  // Admin and the owning facilitator (who can manage the form) always see it regardless.
  const isManager = actor.role === 'admin' || (actor.role === 'facilitator' && actor.id === session.facilitatorId);
  if (!isManager) {
    if (actor.role === 'trainee' && form.audience === 'Facilitators') return null;
    if (actor.role === 'facilitator' && form.audience === 'Trainees') return null;
  }

  const respondent = isRespondent(actor, form.audience);
  const mySubmission = respondent
    ? await prisma.sessionFeedbackSubmission.findUnique({
        where: { formId_submitterId: { formId: form.id, submitterId: actor.id } }
      })
    : null;

  return {
    ...form,
    ...(await withStats(form.id, session.batchId)),
    mySubmitted: respondent ? mySubmission !== null : null
  };
}

export async function submit(actor: AuthenticatedUser, sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  if (actor.role !== 'trainee' && actor.role !== 'facilitator') {
    throw ApiError.forbidden('Only trainees and facilitators submit session feedback.');
  }
  await assertAccess(actor, session);

  const form = await prisma.sessionFeedbackForm.findUnique({ where: { sessionId } });
  if (!form) throw ApiError.notFound('No feedback form attached to this session.');
  if (!isRespondent(actor, form.audience)) throw ApiError.forbidden('This feedback form is not for your role.');

  return prisma.sessionFeedbackSubmission.upsert({
    where: { formId_submitterId: { formId: form.id, submitterId: actor.id } },
    create: { formId: form.id, submitterId: actor.id },
    update: {}
  });
}
