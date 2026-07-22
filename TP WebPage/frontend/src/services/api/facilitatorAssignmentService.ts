import type { AddFacilitatorAssignmentInput, FacilitatorAssignment, FacilitatorAssignmentStatus, FacilitatorRole } from '../../types/facilitatorAssignment';
import { api } from './apiClient';

interface ApiFacilitatorAssignment {
  id: string;
  batchId: string;
  facilitatorId: string;
  facilitatorName: string;
  facilitatorEmail: string;
  role: FacilitatorRole;
  isPrimaryCoordinator: boolean;
  status: FacilitatorAssignmentStatus;
  assignedAt: string;
  assignedBy: string;
  sessionCount: number;
  upcomingSessionCount: number;
  notes: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function toFrontend(a: ApiFacilitatorAssignment): FacilitatorAssignment {
  return { ...a };
}

export async function listFacilitatorAssignments(filters?: { batchId?: string; facilitatorId?: string }): Promise<FacilitatorAssignment[]> {
  const res = await api.get<PaginatedResponse<ApiFacilitatorAssignment>>('/facilitator-assignments', { ...filters, pageSize: 200 });
  return res.data.map(toFrontend);
}

export async function addFacilitatorAssignment(input: AddFacilitatorAssignmentInput): Promise<FacilitatorAssignment> {
  const res = await api.post<{ assignment: ApiFacilitatorAssignment }>('/facilitator-assignments', input);
  return toFrontend(res.assignment);
}

export async function updateFacilitatorAssignment(
  id: string,
  changes: Partial<Pick<FacilitatorAssignment, 'role' | 'status' | 'notes'>>
): Promise<FacilitatorAssignment> {
  const res = await api.patch<{ assignment: ApiFacilitatorAssignment }>(`/facilitator-assignments/${id}`, changes);
  return toFrontend(res.assignment);
}

/** Sets this assignment's facilitator as the batch's Primary Coordinator, automatically demoting
 * whoever currently held it to Lead Facilitator -- see PRIMARY COORDINATOR RULES in the spec. */
export async function setPrimaryCoordinator(id: string): Promise<FacilitatorAssignment> {
  const res = await api.post<{ assignment: ApiFacilitatorAssignment }>(`/facilitator-assignments/${id}/set-primary`, {});
  return toFrontend(res.assignment);
}

/** Soft-removes the assignment (status becomes 'Removed') -- callers should check
 * assignment.sessionCount / upcomingSessionCount first and warn before calling this. */
export async function removeFacilitatorAssignment(id: string): Promise<void> {
  await api.delete(`/facilitator-assignments/${id}`);
}
