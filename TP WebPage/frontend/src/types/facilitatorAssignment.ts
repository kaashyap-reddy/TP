// A batch's facilitator team is many-to-many: one batch can have many facilitators, one
// facilitator can belong to many batches. This is the single source of truth for that
// relationship -- Batch.poc/pocId (types/batch.ts) is a derived, denormalized cache of
// whichever assignment here has isPrimaryCoordinator === true, kept in sync by
// facilitatorAssignmentService/demoMode rather than settable independently.

export type FacilitatorRole = 'Primary Coordinator' | 'Lead Facilitator' | 'Trainer' | 'Guest Trainer' | 'Assignment Reviewer' | 'Backup Facilitator';

export type FacilitatorAssignmentStatus = 'Active' | 'Upcoming' | 'Temporarily Unavailable' | 'Completed' | 'Removed';

export interface FacilitatorAssignment {
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
  /** Count of sessions in this batch where this facilitator is the primary or a co-trainer. */
  sessionCount: number;
  /** Count of those sessions still in the future. */
  upcomingSessionCount: number;
  notes: string | null;
}

export interface AddFacilitatorAssignmentInput {
  batchId: string;
  facilitatorId: string;
  role: FacilitatorRole;
  notes?: string;
}
