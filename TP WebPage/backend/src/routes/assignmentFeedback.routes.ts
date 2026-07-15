import { Router } from 'express';
import {
  attachAssignmentFeedbackFormHandler,
  getAssignmentFeedbackFormHandler,
  removeAssignmentFeedbackFormHandler,
  submitAssignmentFeedbackHandler,
  updateAssignmentFeedbackFormHandler
} from '../controllers/assignmentFeedback.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { assignmentIdParamsSchema } from '../validators/assignments.validator';
// Body shapes are identical to session feedback forms — reused on purpose so the two features
// can't drift apart.
import { feedbackFormBodySchema, updateFeedbackFormBodySchema } from '../validators/sessionFeedback.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /assignments/{id}/feedback-form:
 *   get:
 *     tags: [AssignmentFeedback]
 *     summary: Get an assignment's feedback form link and submission stats (admin, owning facilitator, or a trainee enrolled in one of its batches)
 *     responses:
 *       200: { description: Form + stats, or null if none attached }
 *   post:
 *     tags: [AssignmentFeedback]
 *     summary: Attach a feedback form link to an assignment (admin or owning facilitator)
 *     responses:
 *       201: { description: Attached }
 *   patch:
 *     tags: [AssignmentFeedback]
 *     summary: Edit an assignment's feedback form (admin or owning facilitator)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [AssignmentFeedback]
 *     summary: Remove an assignment's feedback form (admin or owning facilitator)
 *     responses:
 *       204: { description: Removed }
 */
router.get('/:id/feedback-form', validate({ params: assignmentIdParamsSchema }), getAssignmentFeedbackFormHandler);
router.post(
  '/:id/feedback-form',
  requireRole('admin', 'facilitator'),
  validate({ params: assignmentIdParamsSchema, body: feedbackFormBodySchema }),
  attachAssignmentFeedbackFormHandler
);
router.patch(
  '/:id/feedback-form',
  requireRole('admin', 'facilitator'),
  validate({ params: assignmentIdParamsSchema, body: updateFeedbackFormBodySchema }),
  updateAssignmentFeedbackFormHandler
);
router.delete(
  '/:id/feedback-form',
  requireRole('admin', 'facilitator'),
  validate({ params: assignmentIdParamsSchema }),
  removeAssignmentFeedbackFormHandler
);

/**
 * @openapi
 * /assignments/{id}/feedback-form/submissions:
 *   post:
 *     tags: [AssignmentFeedback]
 *     summary: Trainee or facilitator marks their own assignment feedback as submitted (idempotent) — only valid when the form's audience includes their role
 *     responses:
 *       201: { description: Recorded }
 */
router.post(
  '/:id/feedback-form/submissions',
  requireRole('trainee', 'facilitator'),
  validate({ params: assignmentIdParamsSchema }),
  submitAssignmentFeedbackHandler
);

export default router;
