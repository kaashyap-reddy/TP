import { Router } from 'express';
import {
  attachSessionFeedbackFormHandler,
  getSessionFeedbackFormHandler,
  removeSessionFeedbackFormHandler,
  submitSessionFeedbackHandler,
  updateSessionFeedbackFormHandler
} from '../controllers/sessionFeedback.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { feedbackFormBodySchema, updateFeedbackFormBodySchema } from '../validators/sessionFeedback.validator';
import { sessionIdParamsSchema } from '../validators/sessions.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /sessions/{id}/feedback-form:
 *   get:
 *     tags: [SessionFeedback]
 *     summary: Get a session's feedback form link and submission stats (admin, owning facilitator, or an enrolled trainee)
 *     responses:
 *       200: { description: Form + stats, or null if none attached }
 *   post:
 *     tags: [SessionFeedback]
 *     summary: Attach a feedback form link to a session (admin or owning facilitator)
 *     responses:
 *       201: { description: Attached }
 *   patch:
 *     tags: [SessionFeedback]
 *     summary: Edit a session's feedback form (admin or owning facilitator)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [SessionFeedback]
 *     summary: Remove a session's feedback form (admin or owning facilitator)
 *     responses:
 *       204: { description: Removed }
 */
router.get('/:id/feedback-form', validate({ params: sessionIdParamsSchema }), getSessionFeedbackFormHandler);
router.post(
  '/:id/feedback-form',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema, body: feedbackFormBodySchema }),
  attachSessionFeedbackFormHandler
);
router.patch(
  '/:id/feedback-form',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema, body: updateFeedbackFormBodySchema }),
  updateSessionFeedbackFormHandler
);
router.delete(
  '/:id/feedback-form',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema }),
  removeSessionFeedbackFormHandler
);

/**
 * @openapi
 * /sessions/{id}/feedback-form/submissions:
 *   post:
 *     tags: [SessionFeedback]
 *     summary: Trainee or facilitator marks their own session feedback as submitted (idempotent) — only valid when the form's audience includes their role
 *     responses:
 *       201: { description: Recorded }
 */
router.post(
  '/:id/feedback-form/submissions',
  requireRole('trainee', 'facilitator'),
  validate({ params: sessionIdParamsSchema }),
  submitSessionFeedbackHandler
);

export default router;
