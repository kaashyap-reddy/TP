import { Router } from 'express';
import {
  attachBatchFeedbackFormHandler,
  listBatchFeedbackFormsHandler,
  removeBatchFeedbackFormHandler,
  submitBatchFeedbackHandler,
  updateBatchFeedbackFormHandler
} from '../controllers/batchFeedback.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  batchFeedbackFormBodySchema,
  batchFeedbackFormIdParamsSchema,
  batchIdParamsSchema,
  updateBatchFeedbackFormBodySchema
} from '../validators/batchFeedback.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /batches/{id}/feedback-forms:
 *   get:
 *     tags: [BatchFeedback]
 *     summary: List a batch's program-level feedback forms (Mid-Program, Final Program, etc.), scoped by audience for non-managers
 *     responses:
 *       200: { description: Forms + per-form submission stats }
 *   post:
 *     tags: [BatchFeedback]
 *     summary: Attach a new batch-level feedback form (admin or a facilitator on the batch's team)
 *     responses:
 *       201: { description: Attached }
 */
router.get('/:id/feedback-forms', validate({ params: batchIdParamsSchema }), listBatchFeedbackFormsHandler);
router.post(
  '/:id/feedback-forms',
  requireRole('admin', 'facilitator'),
  validate({ params: batchIdParamsSchema, body: batchFeedbackFormBodySchema }),
  attachBatchFeedbackFormHandler
);

/**
 * @openapi
 * /batches/{id}/feedback-forms/{formId}:
 *   patch:
 *     tags: [BatchFeedback]
 *     summary: Edit a batch feedback form (admin or a facilitator on the batch's team)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [BatchFeedback]
 *     summary: Remove a batch feedback form (admin only)
 *     responses:
 *       204: { description: Removed }
 */
router.patch(
  '/:id/feedback-forms/:formId',
  requireRole('admin', 'facilitator'),
  validate({ params: batchFeedbackFormIdParamsSchema, body: updateBatchFeedbackFormBodySchema }),
  updateBatchFeedbackFormHandler
);
router.delete(
  '/:id/feedback-forms/:formId',
  requireRole('admin'),
  validate({ params: batchFeedbackFormIdParamsSchema }),
  removeBatchFeedbackFormHandler
);

/**
 * @openapi
 * /batches/{id}/feedback-forms/{formId}/submissions:
 *   post:
 *     tags: [BatchFeedback]
 *     summary: A respondent-matching trainee/facilitator/admin marks their own submission as complete (idempotent)
 *     responses:
 *       201: { description: Recorded }
 */
router.post(
  '/:id/feedback-forms/:formId/submissions',
  validate({ params: batchFeedbackFormIdParamsSchema }),
  submitBatchFeedbackHandler
);

export default router;
