export interface TrainingPlanSession {
  id: string;
  title: string;
  /** What the session covers (e.g. "Requirements Gathering Techniques"). */
  agenda: string;
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  platform: 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Other';
  order: number;
  feedbackFormUrl: string | null;
}

export interface TrainingPlanAssignment {
  id: string;
  title: string;
  /** What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics"). */
  agenda: string;
  description: string;
  dueDayOffset: number;
  relatedSessionId: string | null;
  relatedSessionTitle: string | null;
}

export interface TrainingPlanResource {
  id: string;
  title: string;
  category: string;
  url: string;
}

export interface TrainingPlanAnnouncement {
  id: string;
  title: string;
  message: string;
  priority: 'Normal' | 'Important' | 'Critical';
}

export interface TrainingPlanSummary {
  id: string;
  code: string;
  name: string;
  durationMonths: number;
  counts: { sessions: number; assignments: number; resources: number; announcements: number; batches: number };
}

export interface TrainingPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMonths: number;
  /** Minutes from midnight — the single source of truth for this plan's schedule; UI reads/writes these, never a hardcoded time. */
  defaultSessionStartMinute: number;
  defaultSessionEndMinute: number;
  defaultAssignmentStartMinute: number;
  defaultAssignmentDeadlineMinute: number;
  sessions: TrainingPlanSession[];
  assignments: TrainingPlanAssignment[];
  resources: TrainingPlanResource[];
  announcements: TrainingPlanAnnouncement[];
}

export interface TrainingPlanGeneralInput {
  name?: string;
  description?: string;
  durationMonths?: number;
  defaultSessionStartMinute?: number;
  defaultSessionEndMinute?: number;
  defaultAssignmentStartMinute?: number;
  defaultAssignmentDeadlineMinute?: number;
}

export interface TrainingPlanSessionInput {
  title: string;
  agenda?: string;
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  platform?: TrainingPlanSession['platform'];
  order: number;
  feedbackFormUrl?: string;
}

export interface TrainingPlanAssignmentInput {
  title: string;
  agenda?: string;
  description?: string;
  dueDayOffset: number;
  relatedSessionId?: string;
}

export interface TrainingPlanResourceInput {
  title: string;
  category: string;
  url: string;
}

export interface TrainingPlanAnnouncementInput {
  title: string;
  message: string;
  priority?: TrainingPlanAnnouncement['priority'];
}
