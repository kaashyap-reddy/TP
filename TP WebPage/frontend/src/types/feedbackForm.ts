// Shared vocabulary for every external-form-link feedback record (session, assignment, and
// batch/program-level). SessionFeedbackForm/AssignmentFeedbackForm (already real, working
// features) extend this rather than being replaced -- see types/sessionFeedback.ts and
// types/assignmentFeedback.ts.

/** Auto-detected from the URL at save time (see utils/formUrl.ts) -- not admin-selected, so it
 * can never drift from the actual link. */
export type FeedbackFormProvider = 'Microsoft Forms' | 'External Form';

export type FeedbackFormType =
  | 'Session Feedback'
  | 'Assignment Feedback'
  | 'Trainer Feedback'
  | 'Batch Feedback'
  | 'Mid-Program Feedback'
  | 'Final Program Feedback'
  | 'Resource Feedback'
  | 'Custom Feedback';

/** Wider than SessionFeedbackAudience ('Trainees'|'Facilitators'|'Both') -- batch/program-level
 * forms can reasonably target Primary Coordinators or Admins too, so this enum is only used for
 * BatchFeedbackForm; session/assignment forms keep their existing narrower, already-shipped enum
 * rather than a disruptive widening. */
export type FeedbackFormBroadAudience = 'Trainees' | 'Facilitators' | 'Primary Coordinators' | 'Admins' | 'Multiple Roles';

export type FeedbackFormStatus = 'Draft' | 'Scheduled' | 'Active' | 'Closed' | 'Archived' | 'Invalid Link';

/** 'External Integration' is deliberately not offered -- there is no real Microsoft Forms API
 * integration in this project, and offering that option would misrepresent Demo Mode. */
export type CompletionTrackingMode = 'Not Tracked' | 'Local Demo Status' | 'Manually Updated';

/** Optional scheduling/governance metadata layered onto an existing form-link record. All
 * optional so every current SessionFeedbackForm/AssignmentFeedbackForm consumer keeps working
 * unchanged when these are absent. */
export interface FeedbackFormMeta {
  provider?: FeedbackFormProvider;
  status?: FeedbackFormStatus;
  isRequired?: boolean;
  instructions?: string | null;
  openDate?: string | null;
  dueDate?: string | null;
  completionTrackingMode?: CompletionTrackingMode;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
