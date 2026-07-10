export type AdminTabId =
  | 'analytics'
  | 'batches'
  | 'assignments'
  | 'announcements'
  | 'sessions'
  | 'feedback'
  | 'reports'
  | 'resources'
  | 'logs';

export const ADMIN_HEADER_TITLES: Record<AdminTabId, string> = {
  analytics: 'System Analytics Dashboard',
  batches: 'Batch Management & Onboarding',
  assignments: 'Global Assignments Overview',
  announcements: 'Global Announcements',
  sessions: 'Sessions — All Batches',
  feedback: 'Global Feedback Reviews',
  reports: 'Automated Reports',
  resources: 'Global Content Repository',
  logs: 'Audit Logs & Notifications'
};

export type FacilitatorTabId =
  | 'dashboard'
  | 'batches'
  | 'assignments'
  | 'discussions'
  | 'resources'
  | 'sessions'
  | 'calendar'
  | 'announcements'
  | 'feedback'
  | 'trainees';

export const FACILITATOR_HEADER_TITLES: Record<FacilitatorTabId, string> = {
  dashboard: 'Facilitator Workspace Overview',
  batches: 'Batch Management',
  assignments: 'Assignment Management',
  discussions: 'Communication Hub',
  resources: 'Digital Resource Library',
  sessions: 'Sessions',
  calendar: 'Session Calendar',
  announcements: 'Announcements',
  feedback: 'Integrated Feedback System',
  trainees: 'Trainee Directory'
};

export type TraineeTabId =
  | 'dashboard'
  | 'assignments'
  | 'discussions'
  | 'resources'
  | 'calendar'
  | 'grades'
  | 'announcements'
  | 'meetings'
  | 'facilitators';

export const TRAINEE_HEADER_TITLES: Record<TraineeTabId, string> = {
  dashboard: 'My Progress & Analytics',
  assignments: 'Online Assignment Tracking',
  discussions: 'Communication Hub',
  announcements: 'Announcements',
  meetings: 'Upcoming Sessions',
  facilitators: 'Facilitator Contacts',
  resources: 'Learning Repository',
  calendar: 'Assignment Calendar',
  grades: 'Historical Feedback & Grades'
};
