import type { SessionFeedbackAudience } from './sessionFeedback';

export type SessionStatus = 'Upcoming' | 'Live' | 'Completed' | 'Cancelled' | 'Rescheduled';
export type MeetingPlatform = 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Other';

/** Whether a session's trainer slot(s) are filled -- independent of `status`, which tracks delivery (Upcoming/Completed/etc), not staffing. */
export type TrainerAssignmentStatus = 'Assigned' | 'Partially Assigned' | 'Unassigned' | 'Reassignment Requested' | 'Confirmed';

export interface SessionCoTrainer {
  id: string;
  name: string;
}

/** A one-off trainer for a single session who isn't a registered facilitator user -- no portal
 * account, no access to the batch/trainees/other sessions. See GUEST TRAINERS in the spec. */
export interface SessionGuestTrainer {
  name: string;
  email: string;
  organization: string | null;
  notes: string | null;
}

export interface Session {
  id: string;
  title: string;
  batchId: string;
  /** Primary trainer's display name -- kept in sync with primaryTrainerName for every existing
   * read site ("Facilitator: {session.facilitator}"); prefer primaryTrainerId/primaryTrainerName
   * for anything that needs a stable id. */
  facilitator: string;
  /** Stable id of the primary trainer, resolved against the facilitator/user dataset -- null if unassigned. */
  primaryTrainerId: string | null;
  primaryTrainerName: string | null;
  /** Additional trainers co-delivering this session alongside (or instead of) the primary. */
  coTrainers: SessionCoTrainer[];
  trainerAssignmentStatus: TrainerAssignmentStatus;
  /** Internal note about the trainer assignment (e.g. "covering for Srikar, week 3 only"). */
  trainerNotes: string | null;
  /** Set only when this session's trainer is a one-off guest rather than a registered facilitator. */
  guestTrainer: SessionGuestTrainer | null;
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
