import { Submission, SubmissionStatus } from '../../types/assignment';
import { api } from './apiClient';

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

type ApiSubmissionStatus = 'NotStarted' | 'UnderReview' | 'Completed' | 'Late';

const STATUS_TO_API: Record<SubmissionStatus, ApiSubmissionStatus> = {
  'Not Started': 'NotStarted',
  'Under Review': 'UnderReview',
  Completed: 'Completed',
  Late: 'Late'
};

const STATUS_FROM_API: Record<ApiSubmissionStatus, SubmissionStatus> = {
  NotStarted: 'Not Started',
  UnderReview: 'Under Review',
  Completed: 'Completed',
  Late: 'Late'
};

export interface ApiSubmissionAttachment {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  isCurrent?: boolean;
}

export interface ApiSubmission {
  // null on a synthesized "not submitted yet" roster row (see GET /assignments/:id/submissions).
  id: string | null;
  assignmentId: string;
  traineeId: string;
  status: ApiSubmissionStatus;
  submittedAt: string | null;
  grade: string | null; // Prisma Decimal serializes as a numeric string
  feedback: string | null;
  trainee: { id: string; name: string; email: string };
  // Only present on roster rows from GET /assignments/:id/submissions.
  batch?: { id: string; name: string; code: string };
  attachments?: ApiSubmissionAttachment[];
}

export function toFrontendSubmission(apiSub: ApiSubmission): Submission {
  const currentAttachment = apiSub.attachments?.find((a) => a.isCurrent !== false) ?? apiSub.attachments?.[apiSub.attachments.length - 1];
  return {
    id: apiSub.id ?? undefined,
    traineeId: apiSub.traineeId,
    traineeName: apiSub.trainee.name,
    status: STATUS_FROM_API[apiSub.status],
    submittedOn: apiSub.submittedAt ?? '',
    grade: apiSub.grade === null ? null : Number(apiSub.grade),
    feedback: apiSub.feedback ?? '',
    batchId: apiSub.batch?.id,
    attachmentId: currentAttachment?.id,
    attachmentFilename: currentAttachment?.originalFilename,
    attachmentMimeType: currentAttachment?.mimeType
  };
}

export async function gradeSubmission(
  submissionId: string,
  changes: { grade?: number | null; feedback?: string; status?: SubmissionStatus }
): Promise<Submission> {
  const payload: Record<string, unknown> = {};
  if (typeof changes.grade === 'number') payload.grade = changes.grade;
  if (changes.feedback !== undefined) payload.feedback = changes.feedback;
  if (changes.status !== undefined) payload.status = STATUS_TO_API[changes.status];

  const { submission } = await api.patch<{ submission: ApiSubmission }>(`/submissions/${submissionId}`, payload);
  return toFrontendSubmission(submission);
}

/**
 * The full roster for one assignment — one row per trainee enrolled in any of its batches,
 * including a synthesized "Not submitted" (id: undefined) placeholder for anyone who hasn't
 * submitted yet, each carrying that trainee's batch. Distinct from the list-of-assignments
 * endpoint's embedded `submissions`, which only ever contains real submission rows.
 */
export async function listSubmissionsForAssignment(assignmentId: string): Promise<Submission[]> {
  const res = await api.get<PaginatedResponse<ApiSubmission>>(`/assignments/${assignmentId}/submissions`, { pageSize: 500 });
  return res.data.map(toFrontendSubmission);
}

export async function submitOwn(assignmentId: string): Promise<Submission> {
  const { submission } = await api.post<{ submission: ApiSubmission }>(`/assignments/${assignmentId}/submissions`);
  return toFrontendSubmission(submission);
}

export interface UploadedAttachment {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export async function uploadAttachment(submissionId: string, file: File): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<{ attachment: UploadedAttachment }>(`/submissions/${submissionId}/attachments`, formData);
  return res.attachment;
}

/** Authorized view/download path for a specific submission attachment — pass to FileViewButton. */
export function submissionAttachmentUrl(submissionId: string, attachmentId: string): string {
  return `/submissions/${submissionId}/attachments/${attachmentId}`;
}
