import { Router } from 'express';
import {
  createFacilitatorAssignmentHandler,
  listFacilitatorAssignmentsHandler,
  removeFacilitatorAssignmentHandler,
  setPrimaryFacilitatorAssignmentHandler,
  updateFacilitatorAssignmentHandler
} from '../controllers/facilitatorAssignments.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  createFacilitatorAssignmentSchema,
  facilitatorAssignmentIdParamsSchema,
  listFacilitatorAssignmentsQuerySchema,
  updateFacilitatorAssignmentSchema
} from '../validators/facilitatorAssignments.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /facilitator-assignments:
 *   get:
 *     tags: [FacilitatorAssignments]
 *     summary: List a batch's facilitator team, or a facilitator's own assignments across batches
 *     responses:
 *       200: { description: Paginated facilitator assignments }
 */
router.get(
  '/',
  requireRole('admin', 'facilitator'),
  validate({ query: listFacilitatorAssignmentsQuerySchema }),
  listFacilitatorAssignmentsHandler
);

/**
 * @openapi
 * /facilitator-assignments:
 *   post:
 *     tags: [FacilitatorAssignments]
 *     summary: Add a facilitator to a batch's team
 *     responses:
 *       201: { description: Created }
 */
router.post('/', requireRole('admin'), validate({ body: createFacilitatorAssignmentSchema }), createFacilitatorAssignmentHandler);

/**
 * @openapi
 * /facilitator-assignments/{id}:
 *   patch:
 *     tags: [FacilitatorAssignments]
 *     summary: Update a facilitator assignment's role, status, or notes
 *     responses:
 *       200: { description: Updated }
 */
router.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: facilitatorAssignmentIdParamsSchema, body: updateFacilitatorAssignmentSchema }),
  updateFacilitatorAssignmentHandler
);

/**
 * @openapi
 * /facilitator-assignments/{id}/set-primary:
 *   post:
 *     tags: [FacilitatorAssignments]
 *     summary: Make this assignment's facilitator the batch's Primary Coordinator, demoting whoever held it
 *     responses:
 *       200: { description: Updated }
 */
router.post(
  '/:id/set-primary',
  requireRole('admin'),
  validate({ params: facilitatorAssignmentIdParamsSchema }),
  setPrimaryFacilitatorAssignmentHandler
);

/**
 * @openapi
 * /facilitator-assignments/{id}:
 *   delete:
 *     tags: [FacilitatorAssignments]
 *     summary: Soft-remove a facilitator from a batch's team
 *     responses:
 *       204: { description: Removed }
 */
router.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: facilitatorAssignmentIdParamsSchema }),
  removeFacilitatorAssignmentHandler
);

export default router;
