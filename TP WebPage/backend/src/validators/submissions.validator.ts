import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const statusEnum = z.enum(['NotStarted', 'UnderReview', 'Completed', 'Late']);

export const listSubmissionsQuerySchema = paginationQuerySchema.extend({
  status: statusEnum.optional(),
  sortBy: z.enum(['submittedAt', 'createdAt', 'grade']).default('createdAt')
});

export const gradeSubmissionSchema = z.object({
  grade: z.coerce.number().min(0).max(100).optional(),
  feedback: z.string().trim().optional(),
  status: statusEnum.optional()
});

export const submissionIdParamsSchema = z.object({ id: z.string().uuid() });

export const submissionAttachmentParamsSchema = z.object({
  id: z.string().uuid(),
  attachmentId: z.string().uuid()
});
