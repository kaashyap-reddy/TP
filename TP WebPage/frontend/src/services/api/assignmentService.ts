import type { Assignment, AssignmentBatchRef, AssignmentStatus } from '../../types/assignment';
import { api } from './apiClient';
import { ApiSubmission, toFrontendSubmission } from './submissionService';

interface ApiAssignment {
  id: string;
  batchId: string;
  batches: AssignmentBatchRef[];
  title: string;
  description: string;
  status: AssignmentStatus;
  deadline: string;
  facilitator: { id: string; name: string; email: string };
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
    facilitator: apiAssignment.facilitator?.name ?? '',
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
  /** One or more batches this assignment is assigned to. */
  batchIds: string[];
  deadline: string;
  description: string;
  status?: AssignmentStatus;
  /** Accepted for call-site compatibility; the API always assigns the creating facilitator, not an arbitrary name. */
  facilitator?: string;
  /** Optional instructions file. */
  file?: File | null;
}

function toFormData(input: {
  batchIds?: string[];
  title?: string;
  description?: string;
  deadline?: string;
  status?: AssignmentStatus;
  file?: File | null;
}): FormData {
  const formData = new FormData();
  if (input.batchIds) formData.append('batchIds', JSON.stringify(input.batchIds));
  if (input.title !== undefined) formData.append('title', input.title);
  if (input.description !== undefined) formData.append('description', input.description);
  if (input.deadline !== undefined) formData.append('deadline', input.deadline);
  if (input.status !== undefined) formData.append('status', input.status);
  if (input.file) formData.append('file', input.file);
  return formData;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
  const created = await api.post<{ assignment: ApiAssignment }>(
    '/assignments',
    toFormData({
      batchIds: input.batchIds,
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      status: input.status,
      file: input.file
    })
  );
  return toFrontendAssignment(created.assignment);
}

export interface UpdateAssignmentInput {
  status?: AssignmentStatus;
  deadline?: string;
  title?: string;
  description?: string;
  batchIds?: string[];
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
    batchIds: assignment.batches.length > 0 ? assignment.batches.map((b) => b.id) : [assignment.batchId],
    deadline: assignment.deadline,
    description: assignment.description,
    status: 'Draft'
  });
}
