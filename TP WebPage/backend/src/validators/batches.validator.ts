import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const programEnum = z.enum(['BA', 'DataEngineering', 'AIML', 'UIUX']);
const trackEnum = z.enum(['BTech', 'MBA']);
const statusEnum = z.enum(['Active', 'Upcoming']);

export const listBatchesQuerySchema = paginationQuerySchema.extend({
  program: programEnum.optional(),
  track: trackEnum.optional(),
  status: statusEnum.optional(),
  facilitatorId: z.string().uuid().optional(),
  traineeId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'startMonth']).default('createdAt')
});

export const createBatchSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  program: programEnum,
  track: trackEnum,
  facilitatorId: z.string().uuid().optional(),
  startMonth: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum.optional().default('Upcoming')
});

export const updateBatchSchema = createBatchSchema.partial();

export const batchIdParamsSchema = z.object({ id: z.string().uuid() });

export const batchTraineeParamsSchema = z.object({
  id: z.string().uuid(),
  traineeId: z.string().uuid()
});

export const enrollTraineeSchema = z.object({
  traineeId: z.string().uuid()
});

export const listBatchTraineesQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true, search: true });
