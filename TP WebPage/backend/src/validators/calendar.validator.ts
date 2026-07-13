import { z } from 'zod';

export const listCalendarQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  type: z.enum(['all', 'session', 'assignment-deadline']).optional().default('all')
});
