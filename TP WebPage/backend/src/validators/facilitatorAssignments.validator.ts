import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const ROLE_VALUES = ['Primary Coordinator', 'Lead Facilitator', 'Trainer', 'Guest Trainer', 'Assignment Reviewer', 'Backup Facilitator'] as const;
const STATUS_VALUES = ['Active', 'Upcoming', 'Temporarily Unavailable', 'Completed', 'Removed'] as const;

export const listFacilitatorAssignmentsQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true }).extend({
  batchId: z.string().uuid().optional(),
  facilitatorId: z.string().uuid().optional()
});

export const createFacilitatorAssignmentSchema = z.object({
  batchId: z.string().uuid(),
  facilitatorId: z.string().uuid(),
  role: z.enum(ROLE_VALUES),
  notes: z.string().trim().optional()
});

// Deliberately excludes isPrimaryCoordinator/facilitatorId/batchId -- those can only change via
// setPrimary/create, never a generic PATCH. See Stage 5 plan: the Demo Mode reference this
// mirrors has an unguarded PATCH at this same endpoint; this allow-list is the real-backend fix.
export const updateFacilitatorAssignmentSchema = z
  .object({
    role: z.enum(ROLE_VALUES).optional(),
    status: z.enum(STATUS_VALUES).optional(),
    notes: z.string().trim().nullable().optional()
  })
  .strict();

export const facilitatorAssignmentIdParamsSchema = z.object({ id: z.string().uuid() });
