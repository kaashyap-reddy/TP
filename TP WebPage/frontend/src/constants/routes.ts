import type { Role } from '../types/role';

export const ROUTES = {
  LOGIN: '/',
  INVITE: '/invite',
  ADMIN: '/admin',
  ADMIN_ACCOUNT_SETTINGS: '/admin/account-settings',
  ADMIN_TRAINING_PLAN_DETAIL: (planId: string) => `/admin/training-plans/${encodeURIComponent(planId)}`,
  ADMIN_TRAINEE_PROFILE: (traineeName: string) => `/admin/trainees/${encodeURIComponent(traineeName)}`,
  FACILITATOR: '/facilitator',
  FACILITATOR_ACCOUNT_SETTINGS: '/facilitator/account-settings',
  FACILITATOR_TRAINEE_PROFILE: (traineeName: string) => `/facilitator/trainees/${encodeURIComponent(traineeName)}`,
  FACILITATOR_BATCH_DETAIL: (batchId: string) => `/facilitator/batches/${encodeURIComponent(batchId)}`,
  TRAINEE: '/trainee',
  TRAINEE_ACCOUNT_SETTINGS: '/trainee/account-settings',
  ASSIGNMENT_DETAIL: (assignmentId: string) => `/assignments/${assignmentId}`,
  DASHBOARD_FOR_ROLE: (role: Role) => `/${role}`
} as const;

// Route *definitions* (with :param placeholders), for use in <Route path="..."> only.
// Use ROUTES above to build concrete URLs for navigate()/Link.
export const ROUTE_PATTERNS = {
  ASSIGNMENT_DETAIL: '/assignments/:assignmentId',
  FACILITATOR_TRAINEE_PROFILE: '/facilitator/trainees/:traineeName',
  FACILITATOR_BATCH_DETAIL: '/facilitator/batches/:batchId',
  ADMIN_TRAINING_PLAN_DETAIL: '/admin/training-plans/:planId',
  ADMIN_TRAINEE_PROFILE: '/admin/trainees/:traineeName'
} as const;
