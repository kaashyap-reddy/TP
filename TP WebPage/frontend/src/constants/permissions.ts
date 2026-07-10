import type { Role } from '../types/role';

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ['manage_batches', 'manage_users', 'manage_announcements', 'view_reports', 'view_audit_log'],
  facilitator: ['manage_assignments', 'grade_submissions', 'manage_sessions', 'manage_resources', 'view_trainees'],
  trainee: ['submit_assignments', 'view_grades', 'view_resources', 'join_sessions']
};

export function getPermissionsForRole(role: Role): string[] {
  return ROLE_PERMISSIONS[role];
}
