export type ReassignmentRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Resolved' | 'Cancelled';

export interface ReassignmentRequest {
  id: string;
  sessionId: string;
  sessionTitle: string;
  batchId: string;
  batchName: string;
  requestedById: string;
  requestedByName: string;
  reason: string;
  suggestedReplacementId: string | null;
  suggestedReplacementName: string | null;
  status: ReassignmentRequestStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

export interface CreateReassignmentRequestInput {
  sessionId: string;
  reason: string;
  suggestedReplacementId?: string;
}
