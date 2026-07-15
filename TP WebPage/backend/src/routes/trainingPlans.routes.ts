import { Router } from 'express';
import {
  createTrainingPlanAnnouncementHandler,
  createTrainingPlanAssignmentHandler,
  createTrainingPlanResourceHandler,
  createTrainingPlanSessionHandler,
  deleteTrainingPlanAnnouncementHandler,
  deleteTrainingPlanAssignmentHandler,
  deleteTrainingPlanResourceHandler,
  deleteTrainingPlanSessionHandler,
  getTrainingPlanHandler,
  listTrainingPlansHandler,
  updateTrainingPlanAnnouncementHandler,
  updateTrainingPlanAssignmentHandler,
  updateTrainingPlanHandler,
  updateTrainingPlanResourceHandler,
  updateTrainingPlanSessionHandler
} from '../controllers/trainingPlans.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  createTrainingPlanAnnouncementSchema,
  createTrainingPlanAssignmentSchema,
  createTrainingPlanResourceSchema,
  createTrainingPlanSessionSchema,
  trainingPlanAnnouncementParamsSchema,
  trainingPlanAssignmentParamsSchema,
  trainingPlanIdParamsSchema,
  trainingPlanResourceParamsSchema,
  trainingPlanSessionParamsSchema,
  updateTrainingPlanAnnouncementSchema,
  updateTrainingPlanAssignmentSchema,
  updateTrainingPlanResourceSchema,
  updateTrainingPlanSchema,
  updateTrainingPlanSessionSchema
} from '../validators/trainingPlans.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /training-plans:
 *   get:
 *     tags: [TrainingPlans]
 *     summary: List all training plans (currently just BA BTech and BA MBA)
 *     responses:
 *       200: { description: Training plans }
 */
router.get('/', listTrainingPlansHandler);

/**
 * @openapi
 * /training-plans/{id}:
 *   get:
 *     tags: [TrainingPlans]
 *     summary: Get a training plan's full template (sessions, assignments, resources, announcements)
 *     responses:
 *       200: { description: Training plan }
 *       404: { description: Not found }
 *   patch:
 *     tags: [TrainingPlans]
 *     summary: Edit a training plan's name/duration (admin only)
 *     responses:
 *       200: { description: Updated training plan }
 */
router.get('/:id', validate({ params: trainingPlanIdParamsSchema }), getTrainingPlanHandler);
router.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: trainingPlanIdParamsSchema, body: updateTrainingPlanSchema }),
  updateTrainingPlanHandler
);

/**
 * @openapi
 * /training-plans/{id}/sessions:
 *   post:
 *     tags: [TrainingPlans]
 *     summary: Add a session to a training plan's template (admin only)
 *     responses:
 *       201: { description: Created }
 */
router.post(
  '/:id/sessions',
  requireRole('admin'),
  validate({ params: trainingPlanIdParamsSchema, body: createTrainingPlanSessionSchema }),
  createTrainingPlanSessionHandler
);

/**
 * @openapi
 * /training-plans/{id}/sessions/{sessionId}:
 *   patch:
 *     tags: [TrainingPlans]
 *     summary: Edit a training plan template session (admin only)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [TrainingPlans]
 *     summary: Remove a training plan template session (admin only)
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/:id/sessions/:sessionId',
  requireRole('admin'),
  validate({ params: trainingPlanSessionParamsSchema, body: updateTrainingPlanSessionSchema }),
  updateTrainingPlanSessionHandler
);
router.delete(
  '/:id/sessions/:sessionId',
  requireRole('admin'),
  validate({ params: trainingPlanSessionParamsSchema }),
  deleteTrainingPlanSessionHandler
);

/**
 * @openapi
 * /training-plans/{id}/assignments:
 *   post:
 *     tags: [TrainingPlans]
 *     summary: Add an assignment to a training plan's template (admin only)
 *     responses:
 *       201: { description: Created }
 */
router.post(
  '/:id/assignments',
  requireRole('admin'),
  validate({ params: trainingPlanIdParamsSchema, body: createTrainingPlanAssignmentSchema }),
  createTrainingPlanAssignmentHandler
);

/**
 * @openapi
 * /training-plans/{id}/assignments/{assignmentId}:
 *   patch:
 *     tags: [TrainingPlans]
 *     summary: Edit a training plan template assignment (admin only)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [TrainingPlans]
 *     summary: Remove a training plan template assignment (admin only)
 *     responses:
 *       204: { description: Deleted }
 */
router.patch(
  '/:id/assignments/:assignmentId',
  requireRole('admin'),
  validate({ params: trainingPlanAssignmentParamsSchema, body: updateTrainingPlanAssignmentSchema }),
  updateTrainingPlanAssignmentHandler
);
router.delete(
  '/:id/assignments/:assignmentId',
  requireRole('admin'),
  validate({ params: trainingPlanAssignmentParamsSchema }),
  deleteTrainingPlanAssignmentHandler
);

/**
 * @openapi
 * /training-plans/{id}/resources:
 *   post:
 *     tags: [TrainingPlans]
 *     summary: Add a resource to a training plan's template (admin only)
 *     responses:
 *       201: { description: Created }
 * /training-plans/{id}/resources/{resourceId}:
 *   patch:
 *     tags: [TrainingPlans]
 *     summary: Edit a training plan template resource (admin only)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [TrainingPlans]
 *     summary: Remove a training plan template resource (admin only)
 *     responses:
 *       204: { description: Deleted }
 */
router.post(
  '/:id/resources',
  requireRole('admin'),
  validate({ params: trainingPlanIdParamsSchema, body: createTrainingPlanResourceSchema }),
  createTrainingPlanResourceHandler
);
router.patch(
  '/:id/resources/:resourceId',
  requireRole('admin'),
  validate({ params: trainingPlanResourceParamsSchema, body: updateTrainingPlanResourceSchema }),
  updateTrainingPlanResourceHandler
);
router.delete(
  '/:id/resources/:resourceId',
  requireRole('admin'),
  validate({ params: trainingPlanResourceParamsSchema }),
  deleteTrainingPlanResourceHandler
);

/**
 * @openapi
 * /training-plans/{id}/announcements:
 *   post:
 *     tags: [TrainingPlans]
 *     summary: Add a default announcement to a training plan's template (admin only)
 *     responses:
 *       201: { description: Created }
 * /training-plans/{id}/announcements/{announcementId}:
 *   patch:
 *     tags: [TrainingPlans]
 *     summary: Edit a training plan template announcement (admin only)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [TrainingPlans]
 *     summary: Remove a training plan template announcement (admin only)
 *     responses:
 *       204: { description: Deleted }
 */
router.post(
  '/:id/announcements',
  requireRole('admin'),
  validate({ params: trainingPlanIdParamsSchema, body: createTrainingPlanAnnouncementSchema }),
  createTrainingPlanAnnouncementHandler
);
router.patch(
  '/:id/announcements/:announcementId',
  requireRole('admin'),
  validate({ params: trainingPlanAnnouncementParamsSchema, body: updateTrainingPlanAnnouncementSchema }),
  updateTrainingPlanAnnouncementHandler
);
router.delete(
  '/:id/announcements/:announcementId',
  requireRole('admin'),
  validate({ params: trainingPlanAnnouncementParamsSchema }),
  deleteTrainingPlanAnnouncementHandler
);

export default router;
