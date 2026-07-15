import type { SessionFeedbackAudience } from './sessionFeedback';

export type SessionStatus = 'Upcoming' | 'Live' | 'Completed' | 'Cancelled' | 'Rescheduled';
export type MeetingPlatform = 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Other';

export interface Session {
  id: string;
  title: string;
  batchId: string;
  facilitator: string;
  date: string;
  time: string;
  link: string;
  platform: MeetingPlatform;
  status: SessionStatus;
  presentCount: number | null;
  absentCount: number | null;
  /** The assignment tied to this session, if any. */
  relatedAssignmentId: string | null;
  relatedAssignmentTitle: string | null;
  /** Feedback-form summary if one is attached — null means none attached yet. Full stats (incl. totalTrainees) come from sessionFeedbackService.getSessionFeedbackForm(). */
  feedbackForm: {
    id: string;
    name: string;
    description: string;
    formUrl: string;
    audience: SessionFeedbackAudience;
    submittedCount: number;
  } | null;
}
