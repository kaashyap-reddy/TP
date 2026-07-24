import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { batchFeedbackFormBodySchema, updateBatchFeedbackFormBodySchema } from '../validators/batchFeedback.validator';
import { isOnBatchTeam } from './facilitatorAssignments.service';

// Wire contract uses human-readable display strings (matching frontend/src/types/batchFeedback.ts
// and the already-shipped Demo Mode contract in demoMode.ts); Prisma's generated enum uses
// PascalCase member names — same bridging pattern established in facilitatorAssignments.service.ts.
const FORM_TYPE_TO_PRISMA = {
  'Batch Feedback': 'BatchFeedback',
  'Mid-Program Feedback': 'MidProgramFeedback',
  'Final Program Feedback': 'FinalProgramFeedback',
  'Custom Feedback': 'CustomFeedback'
} as const;
const FORM_TYPE_FROM_PRISMA: Record<string, string> = Object.fromEntries(Object.entries(FORM_TYPE_TO_PRISMA).map(([k, v]) => [v, k]));

const AUDIENCE_TO_PRISMA = {
  Trainees: 'Trainees',
  Facilitators: 'Facilitators',
  'Primary Coordinators': 'PrimaryCoordinators',
  Admins: 'Admins',
  'Multiple Roles': 'MultipleRoles'
} as const;
const AUDIENCE_FROM_PRISMA: Record<string, string> = Object.fromEntries(Object.entries(AUDIENCE_TO_PRISMA).map(([k, v]) => [v, k]));

const STATUS_TO_PRISMA = {
  Draft: 'Draft',
  Scheduled: 'Scheduled',
  Active: 'Active',
  Closed: 'Closed',
  Archived: 'Archived',
  'Invalid Link': 'InvalidLink'
} as const;
const STATUS_FROM_PRISMA: Record<string, string> = Object.fromEntries(Object.entries(STATUS_TO_PRISMA).map(([k, v]) => [v, k]));

type BatchFeedbackFormRow = Awaited<ReturnType<typeof prisma.batchFeedbackForm.findFirstOrThrow>>;

function toWire(form: BatchFeedbackFormRow, extra: { submittedCount: number; totalTrainees: number; mySubmitted: boolean | null }) {
  return {
    id: form.id,
    batchId: form.batchId,
    name: form.name,
    description: form.description,
    formUrl: form.formUrl,
    formType: FORM_TYPE_FROM_PRISMA[form.formType],
    audience: AUDIENCE_FROM_PRISMA[form.audience],
    status: STATUS_FROM_PRISMA[form.status],
    isRequired: form.isRequired,
    instructions: form.instructions,
    openDate: form.openDate ? form.openDate.toISOString() : null,
    dueDate: form.dueDate ? form.dueDate.toISOString() : null,
    createdBy: form.createdBy,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
    ...extra
  };
}

async function getBatchOrThrow(batchId: string) {
  const batch = await prisma.batch.findFirst({ where: { id: batchId, deletedAt: null } });
  if (!batch) throw ApiError.notFound('Batch not found.');
  return batch;
}

/** Admin always manages a batch's feedback forms; a facilitator only if they're an active team
 * member (owner or BatchFacilitator row) — mirrors isBatchFeedbackManager in demoMode.ts. */
async function isManager(actor: AuthenticatedUser, batch: { id: string; facilitatorId: string | null }): Promise<boolean> {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'facilitator') return false;
  if (batch.facilitatorId === actor.id) return true;
  return isOnBatchTeam(actor.id, batch.id);
}

/** Whether this actor is a legitimate respondent for a form with this (wire-format) audience —
 * mirrors isRespondentForBroadAudience in demoMode.ts exactly. */
function isRespondent(role: AuthenticatedUser['role'], audience: string): boolean {
  if (role === 'trainee') return audience === 'Trainees' || audience === 'Multiple Roles';
  if (role === 'facilitator') return audience === 'Facilitators' || audience === 'Primary Coordinators' || audience === 'Multiple Roles';
  if (role === 'admin') return audience === 'Admins' || audience === 'Multiple Roles';
  return false;
}

async function withStats(formId: string, batchId: string) {
  const [submittedCount, totalTrainees] = await Promise.all([
    prisma.batchFeedbackSubmission.count({ where: { formId } }),
    prisma.batchTrainee.count({ where: { batchId, removedAt: null } })
  ]);
  return { submittedCount, totalTrainees };
}

export async function list(actor: AuthenticatedUser, batchId: string) {
  const batch = await getBatchOrThrow(batchId);
  const managing = await isManager(actor, batch);

  const forms = await prisma.batchFeedbackForm.findMany({ where: { batchId }, orderBy: { createdAt: 'asc' } });
  const totalTrainees = await prisma.batchTrainee.count({ where: { batchId, removedAt: null } });

  const visible = managing
    ? forms
    : forms.filter((f) => f.status !== 'Draft' && f.status !== 'InvalidLink' && isRespondent(actor.role, AUDIENCE_FROM_PRISMA[f.audience]));

  return Promise.all(
    visible.map(async (form) => {
      const submittedCount = await prisma.batchFeedbackSubmission.count({ where: { formId: form.id } });
      const wireAudience = AUDIENCE_FROM_PRISMA[form.audience];
      const respondent = isRespondent(actor.role, wireAudience);
      const mySubmitted = respondent
        ? (await prisma.batchFeedbackSubmission.findUnique({ where: { formId_submitterId: { formId: form.id, submitterId: actor.id } } })) !== null
        : null;
      return toWire(form, { submittedCount, totalTrainees, mySubmitted });
    })
  );
}

export async function create(actor: AuthenticatedUser, batchId: string, input: z.infer<typeof batchFeedbackFormBodySchema>) {
  const batch = await getBatchOrThrow(batchId);
  if (!(await isManager(actor, batch))) {
    throw ApiError.forbidden("Only Admin or this batch's Primary Coordinator/Lead Facilitator can attach a batch feedback form.");
  }

  const form = await prisma.batchFeedbackForm.create({
    data: {
      batchId,
      name: input.name,
      description: input.description,
      formUrl: input.formUrl,
      formType: FORM_TYPE_TO_PRISMA[input.formType],
      audience: AUDIENCE_TO_PRISMA[input.audience],
      status: STATUS_TO_PRISMA[input.status],
      isRequired: input.isRequired,
      instructions: input.instructions ?? null,
      openDate: input.openDate ?? null,
      dueDate: input.dueDate ?? null,
      createdBy: actor.id
    }
  });
  const { totalTrainees } = await withStats(form.id, batchId);
  return toWire(form, { submittedCount: 0, totalTrainees, mySubmitted: null });
}

export async function update(actor: AuthenticatedUser, batchId: string, formId: string, input: z.infer<typeof updateBatchFeedbackFormBodySchema>) {
  const batch = await getBatchOrThrow(batchId);
  const existing = await prisma.batchFeedbackForm.findFirst({ where: { id: formId, batchId } });
  if (!existing) throw ApiError.notFound('Feedback form not found.');
  if (!(await isManager(actor, batch))) {
    throw ApiError.forbidden("Only Admin or this batch's Primary Coordinator/Lead Facilitator can edit this feedback form.");
  }

  const form = await prisma.batchFeedbackForm.update({
    where: { id: formId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.formUrl !== undefined ? { formUrl: input.formUrl } : {}),
      ...(input.formType !== undefined ? { formType: FORM_TYPE_TO_PRISMA[input.formType] } : {}),
      ...(input.audience !== undefined ? { audience: AUDIENCE_TO_PRISMA[input.audience] } : {}),
      ...(input.status !== undefined ? { status: STATUS_TO_PRISMA[input.status] } : {}),
      ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.openDate !== undefined ? { openDate: input.openDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {})
    }
  });
  const { totalTrainees } = await withStats(form.id, batchId);
  return toWire(form, { submittedCount: await prisma.batchFeedbackSubmission.count({ where: { formId } }), totalTrainees, mySubmitted: null });
}

export async function remove(actor: AuthenticatedUser, batchId: string, formId: string): Promise<void> {
  await getBatchOrThrow(batchId);
  const existing = await prisma.batchFeedbackForm.findFirst({ where: { id: formId, batchId } });
  if (!existing) throw ApiError.notFound('Feedback form not found.');
  // Deliberately admin-only, no team-membership widening — matches canDeleteFeedbackForm in
  // frontend/src/constants/permissions.ts and demoMode.ts's identical check.
  if (actor.role !== 'admin') throw ApiError.forbidden('Only Admin can remove a batch feedback form.');

  await prisma.batchFeedbackForm.delete({ where: { id: formId } });
}

export async function submit(actor: AuthenticatedUser, batchId: string, formId: string) {
  await getBatchOrThrow(batchId);
  const form = await prisma.batchFeedbackForm.findFirst({ where: { id: formId, batchId } });
  if (!form) throw ApiError.notFound('Feedback form not found.');
  if (!isRespondent(actor.role, AUDIENCE_FROM_PRISMA[form.audience])) {
    throw ApiError.forbidden('This feedback form is not for your role.');
  }

  return prisma.batchFeedbackSubmission.upsert({
    where: { formId_submitterId: { formId: form.id, submitterId: actor.id } },
    create: { formId: form.id, submitterId: actor.id },
    update: {}
  });
}
