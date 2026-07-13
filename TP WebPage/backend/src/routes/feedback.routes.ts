import { Router } from 'express';
import { createFeedbackHandler, getFeedbackHandler, listFeedbackHandler } from '../controllers/feedback.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { createFeedbackSchema, feedbackIdParamsSchema, listFeedbackQuerySchema } from '../validators/feedback.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /feedback:
 *   get:
 *     tags: [Feedback]
 *     summary: List feedback entries — paginated, filterable by batch/trainee, sortable
 *     responses:
 *       200: { description: Paginated feedback list }
 *   post:
 *     tags: [Feedback]
 *     summary: Record feedback — admin/facilitator about a trainee, or a trainee about their batch's facilitator. Feedback is append-only — no update/delete.
 *     responses:
 *       201: { description: Feedback recorded }
 */
router.get('/', validate({ query: listFeedbackQuerySchema }), listFeedbackHandler);
router.post(
  '/',
  requireRole('admin', 'facilitator', 'trainee'),
  validate({ body: createFeedbackSchema }),
  createFeedbackHandler
);

/**
 * @openapi
 * /feedback/{id}:
 *   get:
 *     tags: [Feedback]
 *     summary: Get a feedback entry by id
 *     responses:
 *       200: { description: Feedback entry }
 */
router.get('/:id', validate({ params: feedbackIdParamsSchema }), getFeedbackHandler);

export default router;
