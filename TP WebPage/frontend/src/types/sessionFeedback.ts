export type SessionFeedbackAudience = 'Trainees' | 'Facilitators' | 'Both';

export interface SessionFeedbackForm {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  formUrl: string;
  audience: SessionFeedbackAudience;
  submittedCount: number;
  totalTrainees: number;
  /** null unless the requesting user is a legitimate respondent for this form's audience (a trainee for Trainees/Both, a facilitator for Facilitators/Both). */
  mySubmitted: boolean | null;
}

export interface SessionFeedbackFormInput {
  name: string;
  description?: string;
  formUrl: string;
  audience?: SessionFeedbackAudience;
}
