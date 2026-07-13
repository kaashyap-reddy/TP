import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const directionEnum = z.enum(['FacilitatorToTrainee', 'TraineeToFacilitator']);

export const listFeedbackQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  traineeId: z.string().uuid().optional(),
  facilitatorId: z.string().uuid().optional(),
  direction: directionEnum.optional(),
  sortBy: z.enum(['createdAt', 'rating']).default('createdAt')
});

// traineeId/facilitatorId are both optional here because which one is supplied by the client
// depends on the actor's role — an admin/facilitator submitting feedback about a trainee sends
// `traineeId` (facilitatorId is always the actor); a trainee submitting feedback about their
// facilitator sends `facilitatorId` (traineeId is always the actor). The service enforces which
// combination is actually required/authorized for the calling actor's role — this schema only
// validates shape.
export const createFeedbackSchema = z.object({
  batchId: z.string().uuid(),
  traineeId: z.string().uuid().optional(),
  facilitatorId: z.string().uuid().optional(),
  category: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().optional()
});

export const feedbackIdParamsSchema = z.object({ id: z.string().uuid() });
