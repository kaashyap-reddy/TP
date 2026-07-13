import { ROUTES } from '../constants/routes';
import type { FacilitatorTabId } from '../constants/navigation';

/** Where a Facilitator opened a trainee's profile from — carried as router state so "Back" can return to the exact place, not just a generic tab. */
export type FacilitatorProfileOrigin = { type: 'batch'; batchId: string } | { type: 'trainees' };

interface FacilitatorProfileLocationState {
  from?: FacilitatorProfileOrigin;
}

interface BackTarget {
  path: string;
  state?: { tab: FacilitatorTabId };
  label: string;
}

/**
 * Resolves the Facilitator trainee-profile "Back" button's destination from the `from` origin
 * recorded when the profile was opened (see navigateToFacilitatorTraineeProfile below). Falls
 * back to the Batches tab — never the generic Trainees tab — when no origin is known, e.g. the
 * profile was opened via a direct link.
 */
export function resolveFacilitatorProfileBack(state: unknown): BackTarget {
  const origin = (state as FacilitatorProfileLocationState | null)?.from;

  if (origin?.type === 'batch' && origin.batchId) {
    return { path: ROUTES.FACILITATOR_BATCH_DETAIL(origin.batchId), label: '‹ Back to Batch' };
  }
  if (origin?.type === 'trainees') {
    return { path: ROUTES.FACILITATOR, state: { tab: 'trainees' }, label: '‹ Back to Trainee Directory' };
  }
  return { path: ROUTES.FACILITATOR, state: { tab: 'batches' }, label: '‹ Back to Batches' };
}

/** Builds the `navigate()` args for opening a trainee's profile with a recorded origin, so Back can return here. */
export function facilitatorTraineeProfileNavArgs(traineeName: string, from?: FacilitatorProfileOrigin): [string, { state: FacilitatorProfileLocationState } | undefined] {
  return [ROUTES.FACILITATOR_TRAINEE_PROFILE(traineeName), from ? { state: { from } } : undefined];
}
