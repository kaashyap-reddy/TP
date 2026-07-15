import { Prisma, SubmissionStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { getStorageProvider } from './storage';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination, PaginationQuery } from '../utils/pagination';
import { gradeSubmissionSchema } from '../validators/submissions.validator';

const include = {
  trainee: { select: { id: true, name: true, email: true } },
  attachments: true
} satisfies Prisma.SubmissionInclude;

async function getAssignmentWithBatchesOrThrow(assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    include: { batches: { select: { batchId: true } } }
  });
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  return assignment;
}

// facilitatorId is nullable — assignments generated from a Training Plan template usually have
// no individual owner, in which case only admin can manage submissions for them.
function assertCanManage(actor: AuthenticatedUser, facilitatorId: string | null) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === facilitatorId) return;
  throw ApiError.forbidden('You do not have access to this assignment.');
}

interface SubmissionRow {
  id: string | null;
  assignmentId: string;
  traineeId: string;
  trainee: { id: string; name: string; email: string };
  batch: { id: string; name: string; code: string };
  status: SubmissionStatus;
  submittedAt: Date | null;
  grade: Prisma.Decimal | null;
  feedback: string | null;
  attachments: { id: string; originalFilename: string; mimeType: string; sizeBytes: number; uploadedAt: Date; isCurrent: boolean }[];
}

/**
 * Every trainee enrolled in one of the assignment's batches gets a row — trainees who haven't
 * submitted yet get a synthesized `id: null` / `status: 'NotStarted'` placeholder instead of
 * being absent from the table, so the roster (and "Not submitted" state) is always complete.
 */
export async function listForAssignment(
  _actor: AuthenticatedUser,
  assignmentId: string,
  query: PaginationQuery & { status?: SubmissionStatus; sortBy: string }
) {
  // Intentionally unrestricted read (any authenticated user) — matches the mock data layer's
  // existing behavior, where Assignment.submissions was visible to whoever held the store.
  const assignment = await getAssignmentWithBatchesOrThrow(assignmentId);
  const batchIds = assignment.batches.map((b) => b.batchId);

  const [enrollments, submissions] = await Promise.all([
    prisma.batchTrainee.findMany({
      where: { batchId: { in: batchIds }, removedAt: null },
      include: {
        trainee: { select: { id: true, name: true, email: true } },
        batch: { select: { id: true, name: true, code: true } }
      }
    }),
    prisma.submission.findMany({
      where: { assignmentId },
      include: { trainee: { select: { id: true, name: true, email: true } }, attachments: { where: { isCurrent: true } } }
    })
  ]);

  const submissionByTraineeId = new Map(submissions.map((s) => [s.traineeId, s]));
  const seenTrainee = new Set<string>();
  const rows: SubmissionRow[] = [];

  for (const enrollment of enrollments) {
    // A trainee enrolled in more than one of this assignment's batches only gets one row.
    if (seenTrainee.has(enrollment.traineeId)) continue;
    seenTrainee.add(enrollment.traineeId);

    const submission = submissionByTraineeId.get(enrollment.traineeId);
    rows.push({
      id: submission?.id ?? null,
      assignmentId,
      traineeId: enrollment.traineeId,
      trainee: enrollment.trainee,
      batch: enrollment.batch,
      status: submission?.status ?? 'NotStarted',
      submittedAt: submission?.submittedAt ?? null,
      grade: submission?.grade ?? null,
      feedback: submission?.feedback ?? null,
      attachments: submission?.attachments ?? []
    });
  }

  const filtered = query.status ? rows.filter((r) => r.status === query.status) : rows;

  const sorted = [...filtered].sort((a, b) => {
    if (query.sortBy === 'grade') {
      const ag = a.grade === null ? -Infinity : Number(a.grade);
      const bg = b.grade === null ? -Infinity : Number(b.grade);
      return query.sortOrder === 'asc' ? ag - bg : bg - ag;
    }
    if (query.sortBy === 'submittedAt') {
      const at = a.submittedAt ? a.submittedAt.getTime() : -Infinity;
      const bt = b.submittedAt ? b.submittedAt.getTime() : -Infinity;
      return query.sortOrder === 'asc' ? at - bt : bt - at;
    }
    // No createdAt on a synthesized placeholder row — trainee name is a stable, meaningful default.
    return a.trainee.name.localeCompare(b.trainee.name);
  });

  const { skip, take, page, pageSize } = getPagination(query);
  return buildPaginatedResponse(sorted.slice(skip, skip + take), sorted.length, page, pageSize);
}

export async function getById(actor: AuthenticatedUser, id: string) {
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { ...include, assignment: true }
  });
  if (!submission) throw ApiError.notFound('Submission not found.');

  const isOwner = actor.id === submission.traineeId;
  if (!isOwner) assertCanManage(actor, submission.assignment.facilitatorId);

  return submission;
}

export async function submitOwn(actor: AuthenticatedUser, assignmentId: string) {
  const assignment = await getAssignmentWithBatchesOrThrow(assignmentId);
  const batchIds = assignment.batches.map((b) => b.batchId);

  const enrolled = await prisma.batchTrainee.findFirst({
    where: { traineeId: actor.id, removedAt: null, batchId: { in: batchIds } }
  });
  if (!enrolled) {
    throw ApiError.forbidden('You are not enrolled in a batch this assignment is assigned to.');
  }

  const isLate = assignment.deadline < new Date();

  return prisma.submission.upsert({
    where: { assignmentId_traineeId: { assignmentId, traineeId: actor.id } },
    create: {
      assignmentId,
      traineeId: actor.id,
      status: isLate ? 'Late' : 'UnderReview',
      submittedAt: new Date()
    },
    update: {
      status: isLate ? 'Late' : 'UnderReview',
      submittedAt: new Date()
    },
    include
  });
}

export async function grade(actor: AuthenticatedUser, id: string, input: z.infer<typeof gradeSubmissionSchema>) {
  const submission = await prisma.submission.findUnique({ where: { id }, include: { assignment: true } });
  if (!submission) throw ApiError.notFound('Submission not found.');
  assertCanManage(actor, submission.assignment.facilitatorId);

  return prisma.submission.update({ where: { id }, data: input, include });
}

export async function addAttachment(actor: AuthenticatedUser, submissionId: string, file: Express.Multer.File) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true, attachments: { where: { isCurrent: true } } }
  });
  if (!submission) throw ApiError.notFound('Submission not found.');
  if (submission.traineeId !== actor.id) throw ApiError.forbidden('You may only attach files to your own submission.');

  const isResubmission = submission.attachments.length > 0;
  if (isResubmission && submission.assignment.deadline < new Date()) {
    throw ApiError.forbidden('The deadline has passed — this submission can no longer be replaced.');
  }

  const storageKey = await getStorageProvider().save(file, 'submissions');

  try {
    // The previous attachment is marked superseded (not deleted) so submission history is
    // preserved and its file — still referenced by that row — is never orphaned; only the
    // current row is served by the download route by default.
    return await prisma.$transaction(async (tx) => {
      if (isResubmission) {
        await tx.submissionAttachment.updateMany({ where: { submissionId, isCurrent: true }, data: { isCurrent: false } });
      }
      return tx.submissionAttachment.create({
        data: {
          submissionId,
          originalFilename: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: file.size
        }
      });
    });
  } catch (err) {
    await getStorageProvider().remove(storageKey);
    throw err;
  }
}

export async function getAttachmentForDownload(actor: AuthenticatedUser, submissionId: string, attachmentId: string) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { assignment: true } });
  if (!submission) throw ApiError.notFound('Submission not found.');

  const isOwner = actor.id === submission.traineeId;
  if (!isOwner) assertCanManage(actor, submission.assignment.facilitatorId);

  const attachment = await prisma.submissionAttachment.findFirst({ where: { id: attachmentId, submissionId } });
  if (!attachment) throw ApiError.notFound('Attachment not found.');

  return attachment;
}
