import type { FeedbackFormBroadAudience, FeedbackFormMeta, FeedbackFormType } from './feedbackForm';

/** Feedback attached to a whole batch/program rather than one session or assignment -- Mid-Program
 * Feedback, Final Program Feedback, Batch Experience Feedback, etc. No existing model covered
 * this (session/assignment feedback only); this is genuinely new, following the same shape. */
export interface BatchFeedbackForm extends FeedbackFormMeta {
  id: string;
  batchId: string;
  name: string;
  description: string;
  formUrl: string;
  formType: Extract<FeedbackFormType, 'Batch Feedback' | 'Mid-Program Feedback' | 'Final Program Feedback' | 'Custom Feedback'>;
  audience: FeedbackFormBroadAudience;
  submittedCount: number;
  totalTrainees: number;
  mySubmitted: boolean | null;
}

export interface BatchFeedbackFormInput {
  name: string;
  description?: string;
  formUrl: string;
  formType: BatchFeedbackForm['formType'];
  audience?: FeedbackFormBroadAudience;
  isRequired?: boolean;
  instructions?: string;
  openDate?: string | null;
  dueDate?: string | null;
}
