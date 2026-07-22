// Standardized sidebar order across all three roles:
//   1. Dashboard/Home  2. Batches  3. Assignments  4. Sessions & Calendar
//   5. Resources  6. Announcements  7. Feedback  8. role-specific pages
// Sessions, Calendar, and Events were merged into a single "Sessions & Calendar" tab (`sessions`)
// per role; Discussions was removed from Facilitator and Trainee (Admin never had it).

export type AdminTabId =
  | 'analytics'
  | 'batches'
  | 'trainingPlans'
  | 'assignments'
  | 'sessions'
  | 'resources'
  | 'announcements'
  | 'feedbackForms'
  | 'feedbackOverview'
  | 'reports'
  | 'logs';

export const ADMIN_HEADER_TITLES: Record<AdminTabId, string> = {
  analytics: 'System Analytics Dashboard',
  batches: 'Batch Management & Onboarding',
  trainingPlans: 'Training Plans',
  assignments: 'Global Assignments Overview',
  sessions: 'Sessions & Calendar',
  resources: 'Global Content Repository',
  announcements: 'Global Announcements',
  feedbackForms: 'Feedback Forms',
  feedbackOverview: 'Feedback Overview',
  reports: 'Automated Reports',
  logs: 'Audit Logs & Notifications'
};

export type FacilitatorTabId =
  | 'dashboard'
  | 'batches'
  | 'assignments'
  | 'sessions'
  | 'resources'
  | 'announcements'
  | 'feedback'
  | 'trainees';

export const FACILITATOR_HEADER_TITLES: Record<FacilitatorTabId, string> = {
  dashboard: 'Facilitator Workspace Overview',
  batches: 'Batch Management',
  assignments: 'Assignment Management',
  sessions: 'Sessions & Calendar',
  resources: 'Digital Resource Library',
  announcements: 'Announcements',
  feedback: 'Integrated Feedback System',
  trainees: 'Trainee Directory'
};

export type TraineeTabId =
  | 'dashboard'
  | 'batches'
  | 'assignments'
  | 'sessions'
  | 'resources'
  | 'announcements'
  | 'grades'
  | 'facilitators';

export const TRAINEE_HEADER_TITLES: Record<TraineeTabId, string> = {
  dashboard: 'My Progress & Analytics',
  batches: 'My Batch',
  assignments: 'Online Assignment Tracking',
  sessions: 'Sessions & Calendar',
  resources: 'Learning Repository',
  announcements: 'Announcements',
  grades: 'My Session Feedback',
  facilitators: 'Facilitator Contacts'
};

export interface NavItem<TabId extends string> {
  tabId: TabId;
  label: string;
  iconPath: string;
  // Which sidebar dropdown this item lives under. Facilitator/Trainee use 'me'/'global'
  // (DashboardLayout's default group set); Admin defines its own group keys -- see
  // ADMIN_NAV_GROUPS below. Unused on the first (dashboard) item in each list.
  group?: string;
}

const BATCHES_ICON =
  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
const ASSIGNMENTS_ICON =
  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
// Represents the merged Sessions & Calendar tab across all three roles.
const SESSIONS_CALENDAR_ICON = 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
const RESOURCES_ICON =
  'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10';
const ANNOUNCEMENTS_ICON =
  'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z';
const FEEDBACK_ICON = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
const REPORTS_ICON =
  'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

export const ADMIN_BRAND_LABEL = 'Admin Portal';

const TRAINING_PLANS_ICON =
  'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s4.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';

// Named sidebar groups for the Admin Portal -- Admin sees far more surface area than
// Facilitator/Trainee (setup + governance across the whole org, not just their own work),
// so it gets its own grouping instead of DashboardLayout's default "Me"/"Global" split.
export const ADMIN_NAV_GROUPS: { key: string; label: string; iconPath: string }[] = [
  { key: 'programs', label: 'Programs & Batches', iconPath: BATCHES_ICON },
  { key: 'learning', label: 'Learning Operations', iconPath: SESSIONS_CALENDAR_ICON },
  { key: 'feedback', label: 'Feedback', iconPath: FEEDBACK_ICON },
  { key: 'reports', label: 'Reports', iconPath: REPORTS_ICON }
];

export const ADMIN_NAV_ITEMS: NavItem<AdminTabId>[] = [
  { tabId: 'analytics', label: 'Real-time Analytics', iconPath: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
  { tabId: 'batches', label: 'Batch Management', iconPath: BATCHES_ICON, group: 'programs' },
  { tabId: 'trainingPlans', label: 'Training Plans', iconPath: TRAINING_PLANS_ICON, group: 'programs' },
  { tabId: 'sessions', label: 'Sessions & Calendar', iconPath: SESSIONS_CALENDAR_ICON, group: 'learning' },
  { tabId: 'assignments', label: 'Assignments', iconPath: ASSIGNMENTS_ICON, group: 'learning' },
  { tabId: 'resources', label: 'Global Resources', iconPath: RESOURCES_ICON, group: 'learning' },
  { tabId: 'announcements', label: 'Announcements', iconPath: ANNOUNCEMENTS_ICON, group: 'learning' },
  { tabId: 'feedbackForms', label: 'Feedback Forms', iconPath: FEEDBACK_ICON, group: 'feedback' },
  {
    tabId: 'feedbackOverview',
    label: 'Feedback Overview',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    group: 'feedback'
  },
  { tabId: 'reports', label: 'Automated Reports', iconPath: REPORTS_ICON, group: 'reports' },
  {
    tabId: 'logs',
    label: 'Audit Logs',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    group: 'reports'
  }
];

export const FACILITATOR_BRAND_LABEL = 'Facilitator Portal';

export const FACILITATOR_NAV_ITEMS: NavItem<FacilitatorTabId>[] = [
  {
    tabId: 'dashboard',
    label: 'Dashboard',
    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
  },
  { tabId: 'batches', label: 'Batches', iconPath: BATCHES_ICON, group: 'me' },
  { tabId: 'assignments', label: 'Assignments', iconPath: ASSIGNMENTS_ICON, group: 'me' },
  { tabId: 'sessions', label: 'Sessions & Calendar', iconPath: SESSIONS_CALENDAR_ICON, group: 'me' },
  { tabId: 'resources', label: 'Resource Library', iconPath: RESOURCES_ICON, group: 'global' },
  { tabId: 'announcements', label: 'Announcements', iconPath: ANNOUNCEMENTS_ICON, group: 'global' },
  {
    tabId: 'feedback',
    label: 'Feedback & Reports',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    group: 'global'
  },
  {
    tabId: 'trainees',
    label: 'Trainees',
    iconPath: 'M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 100-8 4 4 0 000 8zm8 0a4 4 0 100-8 4 4 0 000 8z',
    group: 'me'
  }
];

export const TRAINEE_BRAND_LABEL = 'My Workspace';

export const TRAINEE_NAV_ITEMS: NavItem<TraineeTabId>[] = [
  {
    tabId: 'dashboard',
    label: 'My Progress',
    iconPath: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
  },
  { tabId: 'batches', label: 'My Batch', iconPath: BATCHES_ICON, group: 'me' },
  { tabId: 'assignments', label: 'Assignments', iconPath: ASSIGNMENTS_ICON, group: 'me' },
  { tabId: 'sessions', label: 'Sessions & Calendar', iconPath: SESSIONS_CALENDAR_ICON, group: 'me' },
  { tabId: 'resources', label: 'Learning Repository', iconPath: RESOURCES_ICON, group: 'global' },
  { tabId: 'announcements', label: 'Announcements', iconPath: ANNOUNCEMENTS_ICON, group: 'global' },
  {
    tabId: 'grades',
    label: 'My Session Feedback',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    group: 'me'
  },
  {
    tabId: 'facilitators',
    label: 'Facilitators',
    iconPath: 'M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 100-8 4 4 0 000 8zm8 0a4 4 0 100-8 4 4 0 000 8z',
    group: 'global'
  }
];
