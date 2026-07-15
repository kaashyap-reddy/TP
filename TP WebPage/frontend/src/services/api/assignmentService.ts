import type { Assignment, AssignmentBatchRef, AssignmentStatus } from '../../types/assignment';
import { api } from './apiClient';
import { ApiSubmission, toFrontendSubmission } from './submissionService';

interface ApiAssignment {
  id: string;
  batchId: string;
  batches: (AssignmentBatchRef & { trainingPlan?: { id: string; name: string } | null })[];
  title: string;
  agenda: string;
  description: string;
  status: AssignmentStatus;
  deadline: string;
  session: { id: string; title: string } | null;
  attachment: { originalFilename: string; mimeType: string; sizeBytes: number } | null;
  // Embedded directly by the backend list/create/update endpoints (see backend's
  // assignments.service.ts) — avoids one GET /assignments/:id/submissions round-trip per
  // assignment that a separate fetch here would otherwise require for every list render.
  submissions: ApiSubmission[];
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function isOverdue(assignment: Assignment): boolean {
  if (assignment.status !== 'Open') return false;
  const deadline = new Date(assignment.deadline);
  if (isNaN(deadline.getTime())) return false;
  return deadline.getTime() < Date.now();
}

export function effectiveStatus(assignment: Assignment): AssignmentStatus | 'Overdue' {
  return isOverdue(assignment) ? 'Overdue' : assignment.status;
}

/** Authorized view/download path for an assignment's instructions file — pass to FileViewButton. */
export function assignmentAttachmentUrl(assignmentId: string): string {
  return `/assignments/${assignmentId}/attachment`;
}

function toFrontendAssignment(apiAssignment: ApiAssignment): Assignment {
  return {
    id: apiAssignment.id,
    title: apiAssignment.title,
    batchId: apiAssignment.batchId,
    batches: apiAssignment.batches ?? [],
    sessionId: apiAssignment.session?.id ?? null,
    sessionTitle: apiAssignment.session?.title ?? null,
    trainingPlanName: apiAssignment.batches?.[0]?.trainingPlan?.name ?? null,
    agenda: apiAssignment.agenda,
    deadline: apiAssignment.deadline,
    description: apiAssignment.description,
    status: apiAssignment.status,
    submissions: apiAssignment.submissions.map(toFrontendSubmission),
    attachmentFilename: apiAssignment.attachment?.originalFilename ?? null
  };
}

export async function listAssignments(filters?: { batchId?: string }): Promise<Assignment[]> {
  const res = await api.get<PaginatedResponse<ApiAssignment>>('/assignments', { ...filters, pageSize: 200 });
  return res.data.map(toFrontendAssignment);
}

export interface CreateAssignmentInput {
  title: string;
  /** What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics"). */
  agenda?: string;
  /** One or more batches this assignment is assigned to. */
  batchIds: string[];
  deadline: string;
  description: string;
  status?: AssignmentStatus;
  /** The session this assignment relates to, if any. */
  sessionId?: string;
  /** Optional instructions file. */
  file?: File | null;
}

function toFormData(input: {
  batchIds?: string[];
  title?: string;
  agenda?: string;
  description?: string;
  deadline?: string;
  status?: AssignmentStatus;
  sessionId?: string | null;
  file?: File | null;
}): FormData {
  const formData = new FormData();
  if (input.batchIds) formData.append('batchIds', JSON.stringify(input.batchIds));
  if (input.title !== undefined) formData.append('title', input.title);
  if (input.agenda !== undefined) formData.append('agenda', input.agenda);
  if (input.description !== undefined) formData.append('description', input.description);
  if (input.deadline !== undefined) formData.append('deadline', input.deadline);
  if (input.status !== undefined) formData.append('status', input.status);
  if (input.sessionId) formData.append('sessionId', input.sessionId);
  if (input.file) formData.append('file', input.file);
  return formData;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
  const created = await api.post<{ assignment: ApiAssignment }>(
    '/assignments',
    toFormData({
      batchIds: input.batchIds,
      title: input.title,
      agenda: input.agenda,
      description: input.description,
      deadline: input.deadline,
      status: input.status,
      sessionId: input.sessionId,
      file: input.file
    })
  );
  return toFrontendAssignment(created.assignment);
}

export interface UpdateAssignmentInput {
  status?: AssignmentStatus;
  deadline?: string;
  title?: string;
  agenda?: string;
  description?: string;
  batchIds?: string[];
  sessionId?: string | null;
  file?: File | null;
}

export async function updateAssignment(id: string, changes: UpdateAssignmentInput): Promise<Assignment> {
  const updated = await api.patch<{ assignment: ApiAssignment }>(`/assignments/${id}`, toFormData(changes));
  return toFrontendAssignment(updated.assignment);
}

export async function deleteAssignment(id: string): Promise<void> {
  await api.delete(`/assignments/${id}`);
}

export async function duplicateAssignment(assignment: Assignment): Promise<Assignment> {
  return createAssignment({
    title: `${assignment.title} (Copy)`,
    agenda: assignment.agenda,
    batchIds: assignment.batches.length > 0 ? assignment.batches.map((b) => b.id) : [assignment.batchId],
    deadline: assignment.deadline,
    description: assignment.description,
    status: 'Draft'
  });
}
