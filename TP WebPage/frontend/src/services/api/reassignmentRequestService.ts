import type { CreateReassignmentRequestInput, ReassignmentRequest, ReassignmentRequestStatus } from '../../types/reassignmentRequest';
import { api } from './apiClient';

interface ApiReassignmentRequest {
  id: string;
  sessionId: string;
  batchId: string;
  requestedById: string;
  reason: string;
  suggestedReplacementId: string | null;
  status: ReassignmentRequestStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// The demo API layer doesn't resolve session/batch/requester display names onto the request
// itself (see demoMode.ts) -- callers with the batches/sessions/users already in hand should
// resolve those for display; this keeps the wire shape minimal.
function toFrontend(r: ApiReassignmentRequest): ReassignmentRequest {
  return {
    id: r.id,
    sessionId: r.sessionId,
    sessionTitle: '',
    batchId: r.batchId,
    batchName: '',
    requestedById: r.requestedById,
    requestedByName: '',
    reason: r.reason,
    suggestedReplacementId: r.suggestedReplacementId,
    suggestedReplacementName: '',
    status: r.status,
    createdAt: r.createdAt,
    reviewedBy: r.reviewedBy,
    reviewNotes: r.reviewNotes
  };
}

export async function listReassignmentRequests(filters?: { batchId?: string; status?: ReassignmentRequestStatus }): Promise<ReassignmentRequest[]> {
  const res = await api.get<PaginatedResponse<ApiReassignmentRequest>>('/reassignment-requests', { ...filters, pageSize: 200 });
  return res.data.map(toFrontend);
}

export async function createReassignmentRequest(input: CreateReassignmentRequestInput): Promise<ReassignmentRequest> {
  const res = await api.post<{ request: ApiReassignmentRequest }>('/reassignment-requests', input);
  return toFrontend(res.request);
}

export async function reviewReassignmentRequest(
  id: string,
  changes: { status: 'Approved' | 'Rejected' | 'Resolved' | 'Cancelled'; reviewNotes?: string }
): Promise<ReassignmentRequest> {
  const res = await api.patch<{ request: ApiReassignmentRequest }>(`/reassignment-requests/${id}`, changes);
  return toFrontend(res.request);
}
