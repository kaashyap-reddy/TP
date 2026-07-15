import { z } from 'zod';

const audienceEnum = z.enum(['Trainees', 'Facilitators', 'Both']);

export const feedbackFormBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
  formUrl: z.string().trim().url(),
  audience: audienceEnum.optional().default('Both')
});

export const updateFeedbackFormBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  formUrl: z.string().trim().url().optional(),
  audience: audienceEnum.optional()
});
