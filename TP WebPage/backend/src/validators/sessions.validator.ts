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
  scheduledAt: z.coerce.date(),
  platform: platformEnum.optional().default('Other'),
  meetingLink: z.string().trim().url().optional(),
  status: statusEnum.optional().default('Upcoming')
});

export const updateSessionSchema = createSessionSchema.omit({ batchId: true }).partial();

export const sessionIdParamsSchema = z.object({ id: z.string().uuid() });
