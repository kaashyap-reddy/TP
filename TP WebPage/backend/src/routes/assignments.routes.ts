import { Router } from 'express';
import {
  createAssignmentHandler,
  deleteAssignmentHandler,
  getAssignmentHandler,
  listAssignmentsHandler,
  updateAssignmentHandler,
  viewAssignmentAttachmentHandler
} from '../controllers/assignments.controller';
import { listSubmissionsForAssignmentHandler, submitOwnHandler } from '../controllers/submissions.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { createUploader } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  assignmentIdParamsSchema,
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema
} from '../validators/assignments.validator';
import { listSubmissionsQuerySchema } from '../validators/submissions.validator';

const router = Router();
const upload = createUploader('assignments');

router.use(requireAuth);

/**
 * @openapi
 * /assignments:
 *   get:
 *     tags: [Assignments]
 *     summary: List assignments — paginated, filterable by batch/status, searchable, sortable
 *     responses:
 *       200: { description: Paginated assignment list }
 *   post:
 *     tags: [Assignments]
 *     summary: Create an assignment for one or more batches (facilitator/admin), with an optional instructions file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               batchIds: { type: array, items: { type: string, format: uuid } }
 *               title: { type: string }
 *               description: { type: string }
 *               deadline: { type: string, format: date-time }
 *     responses:
 *       201: { description: Assignment created }
 */
router.get('/', validate({ query: listAssignmentsQuerySchema }), listAssignmentsHandler);
router.post(
  '/',
  requireRole('admin', 'facilitator'),
  upload.single('file'),
  validate({ body: createAssignmentSchema }),
  createAssignmentHandler
);

/**
 * @openapi
 * /assignments/{id}:
 *   get:
 *     tags: [Assignments]
 *     summary: Get an assignment by id
 *     responses:
 *       200: { description: Assignment }
 *   patch:
 *     tags: [Assignments]
 *     summary: Update an assignment, including its assigned batches or instructions file (owning facilitator or admin)
 *     responses:
 *       200: { description: Updated assignment }
 *   delete:
 *     tags: [Assignments]
 *     summary: Soft-delete an assignment (owning facilitator or admin)
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/:id', validate({ params: assignmentIdParamsSchema }), getAssignmentHandler);
router.patch(
  '/:id',
  requireRole('admin', 'facilitator'),
  upload.single('file'),
  validate({ params: assignmentIdParamsSchema, body: updateAssignmentSchema }),
  updateAssignmentHandler
);
router.delete(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: assignmentIdParamsSchema }),
  deleteAssignmentHandler
);

/**
 * @openapi
 * /assignments/{id}/attachment:
 *   get:
 *     tags: [Assignments]
 *     summary: View/download an assignment's instructions file (admin, owning/co-facilitator, or an enrolled trainee)
 *     responses:
 *       200: { description: File stream }
 *       404: { description: No file uploaded, or assignment not found }
 *       403: { description: Not authorized for this assignment }
 */
router.get('/:id/attachment', validate({ params: assignmentIdParamsSchema }), viewAssignmentAttachmentHandler);

/**
 * @openapi
 * /assignments/{id}/submissions:
 *   get:
 *     tags: [Submissions]
 *     summary: List submissions for an assignment, including a placeholder row (status NotStarted, id null) for every enrolled trainee who hasn't submitted yet
 *     responses:
 *       200: { description: Paginated submission list }
 *   post:
 *     tags: [Submissions]
 *     summary: Submit (or resubmit) the current trainee's own work for this assignment
 *     responses:
 *       201: { description: Submission recorded }
 */
router.get(
  '/:id/submissions',
  validate({ params: assignmentIdParamsSchema, query: listSubmissionsQuerySchema }),
  listSubmissionsForAssignmentHandler
);
router.post(
  '/:id/submissions',
  requireRole('trainee'),
  validate({ params: assignmentIdParamsSchema }),
  submitOwnHandler
);

export default router;
