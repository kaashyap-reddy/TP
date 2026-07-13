import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

export const listResourcesQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  category: z.string().trim().optional(),
  verified: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'title', 'downloadCount']).default('createdAt')
});

export const createResourceSchema = z.object({
  batchId: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  version: z.string().trim().optional().default('v1.0')
});

export const updateResourceSchema = z.object({
  title: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  version: z.string().trim().optional(),
  verified: z.boolean().optional(),
  batchId: z.string().uuid().nullable().optional()
});

export const resourceIdParamsSchema = z.object({ id: z.string().uuid() });
