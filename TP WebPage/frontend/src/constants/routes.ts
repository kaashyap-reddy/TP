import type { Role } from '../types/role';

export const ROUTES = {
  LOGIN: '/',
  INVITE: '/invite',
  ADMIN: '/admin',
  ADMIN_ACCOUNT_SETTINGS: '/admin/account-settings',
  FACILITATOR: '/facilitator',
  FACILITATOR_ACCOUNT_SETTINGS: '/facilitator/account-settings',
  FACILITATOR_TRAINEE_PROFILE: (traineeName: string) => `/facilitator/trainees/${encodeURIComponent(traineeName)}`,
  TRAINEE: '/trainee',
  TRAINEE_ACCOUNT_SETTINGS: '/trainee/account-settings',
  ASSIGNMENT_DETAIL: (assignmentId: string) => `/assignments/${assignmentId}`,
  DASHBOARD_FOR_ROLE: (role: Role) => `/${role}`
} as const;

// Route *definitions* (with :param placeholders), for use in <Route path="..."> only.
// Use ROUTES above to build concrete URLs for navigate()/Link.
export const ROUTE_PATTERNS = {
  ASSIGNMENT_DETAIL: '/assignments/:assignmentId',
  FACILITATOR_TRAINEE_PROFILE: '/facilitator/trainees/:traineeName'
} as const;
