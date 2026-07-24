import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const platformEnum = z.enum(['GoogleMeet', 'MicrosoftTeams', 'Zoom', 'Other']);
const statusEnum = z.enum(['Upcoming', 'Live', 'Completed', 'Cancelled', 'Rescheduled']);

export const listSessionsQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  status: statusEnum.optional(),
  sortBy: z.enum(['scheduledAt', 'createdAt', 'title']).default('scheduledAt')
});

export const createSessionSchema = z.object({
  batchId: z.string().uuid(),
  title: z.string().trim().min(1),
  agenda: z.string().trim().optional(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional().default(120),
  platform: platformEnum.optional().default('Other'),
  meetingLink: z.string().trim().url().optional(),
  status: statusEnum.optional().default('Upcoming')
});

// facilitatorId is intentionally omitted from createSessionSchema (create() always hard-codes the
// creator as trainer) but is a real, separately-added field here -- this is the only way to
// reassign a session's trainer after creation.
export const updateSessionSchema = createSessionSchema
  .omit({ batchId: true })
  .partial()
  .extend({ facilitatorId: z.string().uuid().nullable().optional() });

export const sessionIdParamsSchema = z.object({ id: z.string().uuid() });
