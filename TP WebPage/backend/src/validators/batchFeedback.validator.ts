import { z } from 'zod';

// Wire-contract (display-string) enums, matching frontend/src/types/batchFeedback.ts and
// types/feedbackForm.ts exactly -- converted to/from the Prisma PascalCase enum members at the
// service boundary (see FORM_TYPE_TO_PRISMA/AUDIENCE_TO_PRISMA/STATUS_TO_PRISMA in
// batchFeedback.service.ts).
export const batchFeedbackFormTypeEnum = z.enum(['Batch Feedback', 'Mid-Program Feedback', 'Final Program Feedback', 'Custom Feedback']);
export const feedbackFormBroadAudienceEnum = z.enum(['Trainees', 'Facilitators', 'Primary Coordinators', 'Admins', 'Multiple Roles']);
export const feedbackFormStatusEnum = z.enum(['Draft', 'Scheduled', 'Active', 'Closed', 'Archived', 'Invalid Link']);

export const batchIdParamsSchema = z.object({ id: z.string().uuid() });
export const batchFeedbackFormIdParamsSchema = z.object({ id: z.string().uuid(), formId: z.string().uuid() });

export const batchFeedbackFormBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default(''),
  formUrl: z.string().trim().url(),
  formType: batchFeedbackFormTypeEnum.optional().default('Batch Feedback'),
  audience: feedbackFormBroadAudienceEnum.optional().default('Trainees'),
  status: feedbackFormStatusEnum.optional().default('Draft'),
  isRequired: z.boolean().optional().default(false),
  instructions: z.string().trim().optional(),
  // Native <input type="date"> sends a bare "YYYY-MM-DD" (no time component), not a full ISO
  // datetime string -- z.coerce.date() accepts both, matching the convention already used for
  // Batch.endDate in batches.validator.ts.
  openDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional()
});

export const updateBatchFeedbackFormBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  formUrl: z.string().trim().url().optional(),
  formType: batchFeedbackFormTypeEnum.optional(),
  audience: feedbackFormBroadAudienceEnum.optional(),
  status: feedbackFormStatusEnum.optional(),
  isRequired: z.boolean().optional(),
  instructions: z.string().trim().optional(),
  openDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional()
});
