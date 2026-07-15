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
  trainingPlanId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'startMonth']).default('createdAt')
});

// `program`/`track` are no longer client-supplied: creating a batch now means picking a
// Training Plan, and program/track are derived server-side from the plan (see
// batches.service.ts `create()`) so the rest of the app's program-based filters/colors keep
// working unchanged. The org's actual workflow is: Batch Name + Training Plan + Start Date —
// that's it. `facilitatorId` ("Trainer") is optional, same as at the Session/Assignment level.
// `endDate` isn't accepted here at all — it's always server-computed from the plan's generated
// schedule (see batches.service.ts `create()`), never entered by the Admin.
export const createBatchSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  trainingPlanId: z.string().uuid(),
  facilitatorId: z.string().uuid().optional(),
  startMonth: z.coerce.date().optional(),
  status: statusEnum.optional().default('Upcoming')
});

// trainingPlanId is immutable after creation — the automation transaction only runs once, at
// create time, so re-pointing an existing batch at a different plan wouldn't regenerate anything.
// endDate becomes editable here, though — an Admin may want to shorten/extend an individual
// batch's schedule after the fact without touching the Training Plan template.
export const updateBatchSchema = createBatchSchema
  .omit({ trainingPlanId: true })
  .extend({ endDate: z.coerce.date().optional() })
  .partial();

export const batchIdParamsSchema = z.object({ id: z.string().uuid() });

export const batchTraineeParamsSchema = z.object({
  id: z.string().uuid(),
  traineeId: z.string().uuid()
});

export const enrollTraineeSchema = z.object({
  traineeId: z.string().uuid()
});

export const listBatchTraineesQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true, search: true });
