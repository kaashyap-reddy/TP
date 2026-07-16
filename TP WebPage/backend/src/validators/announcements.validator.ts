import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const priorityEnum = z.enum(['Normal', 'Important', 'Critical']);

export const listAnnouncementsQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  pinned: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'priority']).default('createdAt')
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  priority: priorityEnum.optional().default('Normal'),
  // Free-form label shown in the UI (e.g. "All Trainees", "BA BTech - July 2026") — real
  // visibility scoping is done by batchId, not by parsing this string.
  audience: z.string().trim().min(1).max(120),
  batchId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().optional().default(false),
  scheduledFor: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional()
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const announcementIdParamsSchema = z.object({ id: z.string().uuid() });
