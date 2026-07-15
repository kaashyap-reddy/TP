import type { AssignmentFeedbackAudience } from './assignmentFeedback';

export type SubmissionStatus = 'Not Started' | 'Under Review' | 'Completed' | 'Late';
export type AssignmentStatus = 'Draft' | 'Open' | 'Closed';

export interface Submission {
  traineeName: string;
  status: SubmissionStatus;
  submittedOn: string;
  grade: number | null;
  feedback: string;
  /** Real backend submission/trainee ids, needed to route grade updates — optional so nothing that only reads display fields is affected. */
  id?: string;
  traineeId?: string;
  /** The trainee's enrolled batch for this row — present on roster rows from an assignment's submissions list. */
  batchId?: string;
  /** The trainee's current submitted file, if any — absent means "Not submitted". */
  attachmentId?: string;
  attachmentFilename?: string;
  attachmentMimeType?: string;
}

export interface AssignmentBatchRef {
  id: string;
  name: string;
  code: string;
}

export interface Assignment {
  id: string;
  title: string;
  /** Primary/first batch — kept for callers that only need one; see `batches` for the full set. */
  batchId: string;
  batches: AssignmentBatchRef[];
  /** The session this assignment is tied to, if any — assignments belong to a Training Plan, not an individual facilitator. */
  sessionId: string | null;
  sessionTitle: string | null;
  /** The Training Plan of the assignment's primary batch, if it has one. */
  trainingPlanName: string | null;
  /** What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics"). */
  agenda: string;
  deadline: string;
  description: string;
  status: AssignmentStatus;
  submissions: Submission[];
  attachmentFilename: string | null;
  /** Feedback-form summary if one is attached directly to this assignment — null means none. Full stats come from assignmentFeedbackService.getAssignmentFeedbackForm(). */
  feedbackForm: {
    id: string;
    name: string;
    description: string;
    formUrl: string;
    audience: AssignmentFeedbackAudience;
    submittedCount: number;
  } | null;
}
