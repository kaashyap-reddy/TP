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

// ---- feedback-form governance (Prompt 3, Phase 7) -- Admin retains final governance; a normal
// Trainer gets view/open/report-invalid only, while Primary Coordinator/Lead Facilitator gets the
// same attach/edit rights Admin has, scoped to their own batch. ----

/** Attaching/editing a session, assignment, or batch feedback form. Admin can do this anywhere;
 * a facilitator only within their own batch, and only as Primary Coordinator or Lead Facilitator
 * -- a plain Trainer cannot attach or edit a form, even on their own session. */
export function canAttachFeedbackForm(role: Role | null, batchRole?: FacilitatorRole | null): boolean {
  if (role === 'admin') return true;
  return role === 'facilitator' && !!batchRole && COORDINATION_ROLES.includes(batchRole);
}
export function canEditFeedbackForm(role: Role | null, batchRole?: FacilitatorRole | null): boolean {
  return canAttachFeedbackForm(role, batchRole);
}

/** Deleting/archiving a feedback form is Admin-only -- a facilitator must never be able to remove
 * a form other batches or sessions still rely on. */
export function canDeleteFeedbackForm(role: Role | null): boolean {
  return role === 'admin';
}

/** Any facilitator on a batch's team -- including a plain Trainer -- can report a feedback link as
 * broken; this is deliberately looser than canEditFeedbackForm so whoever notices a dead link
 * isn't stuck asking someone else to report it. Admin then decides whether to replace it. */
export function canReportInvalidFeedbackLink(role: Role | null): boolean {
  return role === 'admin' || role === 'facilitator';
}

/** The reusable Training-Plan feedback template (copied onto each batch at creation) stays
 * Admin-only, same as the rest of the template -- see canEditTrainingPlanTemplate. */
export function canEditGlobalFeedbackTemplate(role: Role | null): boolean {
  return role === 'admin';
}

/** Cross-batch feedback completion data (who submitted what, anywhere) is Admin-only; a
 * facilitator only ever sees completion data for their own batch's forms. */
export function canViewAllFeedbackCompletionData(role: Role | null): boolean {
  return role === 'admin';
}

/** The primary "Contact" action (trainee <-> facilitator, either direction) always opens
 * Microsoft Teams or shows a clear disabled reason -- never Outlook/mailto: -- see PHASE 12/13.
 * Admins and Guest Trainers (no portal account) aren't contactable through this action. */
export function canContactViaTeams(role: Role | null): boolean {
  return role === 'trainee' || role === 'facilitator';
}
