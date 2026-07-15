import type { SessionFeedbackAudience } from './sessionFeedback';

/** Same audience semantics as session feedback — the two features share the enum on the backend too. */
export type AssignmentFeedbackAudience = SessionFeedbackAudience;

export interface AssignmentFeedbackForm {
  id: string;
  assignmentId: string;
  name: string;
  description: string;
  formUrl: string;
  audience: AssignmentFeedbackAudience;
  submittedCount: number;
  totalTrainees: number;
  /** null unless the requesting user is a legitimate respondent for this form's audience. */
  mySubmitted: boolean | null;
}

export interface AssignmentFeedbackFormInput {
  name: string;
  description?: string;
  formUrl: string;
  audience?: AssignmentFeedbackAudience;
}
