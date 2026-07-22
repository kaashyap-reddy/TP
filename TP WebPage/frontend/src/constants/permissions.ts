// Real, enforced permission checks for the facilitator-allocation feature -- deliberately a small,
// concrete set rather than a large enum with no consumers. Nothing in this codebase had any
// per-action permission checking before this (RequireAuth only gates whole routes by role), so
// this is new; keep additions here tied to an actual gate point in the UI or a mutation handler,
// not speculative coverage.
import type { Role } from '../types/role';
import type { FacilitatorRole } from '../types/facilitatorAssignment';

// `role` accepts null (authStore's pre-hydration value) so every check here fails closed --
// nothing is permitted until a real role is known -- rather than callers needing a non-null
// assertion or a separate loading-state check before calling in.

const COORDINATION_ROLES: FacilitatorRole[] = ['Primary Coordinator', 'Lead Facilitator'];

/** Admin retains final authority over batch lifecycle, training-plan templates, and the
 * facilitator team roster itself -- see PHASE 10 — ADMIN AUTHORITY. */
export function canCreateBatch(role: Role | null): boolean {
  return role === 'admin';
}
export function canActivateOrArchiveBatch(role: Role | null): boolean {
  return role === 'admin';
}
export function canEditTrainingPlanTemplate(role: Role | null): boolean {
  return role === 'admin';
}
export function canManageFacilitatorTeam(role: Role | null): boolean {
  return role === 'admin';
}
export function canSetPrimaryCoordinator(role: Role | null): boolean {
  return role === 'admin';
}
export function canRemoveFacilitator(role: Role | null): boolean {
  return role === 'admin';
}
export function canBulkAssignTrainers(role: Role | null): boolean {
  return role === 'admin';
}
export function canOverrideSchedulingConflict(role: Role | null): boolean {
  return role === 'admin';
}
export function canViewOrgWideReports(role: Role | null): boolean {
  return role === 'admin';
}

/** Coordinating routine session allocation is a Primary Coordinator / Lead Facilitator capability
 * within their own batch, not something every Trainer gets -- see FACILITATOR ACTIONS. Admin can
 * always do this too, regardless of batch role. */
export function canAssignSessionTrainer(role: Role | null, batchRole?: FacilitatorRole | null): boolean {
  if (role === 'admin') return true;
  return role === 'facilitator' && !!batchRole && COORDINATION_ROLES.includes(batchRole);
}

export function canReviewReassignmentRequest(role: Role | null, batchRole?: FacilitatorRole | null): boolean {
  if (role === 'admin') return true;
  return role === 'facilitator' && !!batchRole && COORDINATION_ROLES.includes(batchRole);
}

/** Any facilitator can flag that they can't deliver a session assigned to them -- see PHASE 11. */
export function canRequestReassignment(role: Role | null): boolean {
  return role === 'facilitator';
}
