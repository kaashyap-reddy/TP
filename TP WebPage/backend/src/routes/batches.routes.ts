import { Router } from 'express';
import {
  createBatchHandler,
  deleteBatchHandler,
  enrollTraineeHandler,
  getBatchHandler,
  getBatchMetricsHandler,
  listBatchesHandler,
  listBatchTraineesHandler,
  listBatchTraineeStatsHandler,
  unenrollTraineeHandler,
  updateBatchHandler
} from '../controllers/batches.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  batchIdParamsSchema,
  batchTraineeParamsSchema,
  createBatchSchema,
  enrollTraineeSchema,
  listBatchesQuerySchema,
  listBatchTraineesQuerySchema,
  updateBatchSchema
} from '../validators/batches.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /batches:
 *   get:
 *     tags: [Batches]
 *     summary: List batches — paginated, filterable, searchable, sortable
 *     responses:
 *       200: { description: Paginated batch list }
 *   post:
 *     tags: [Batches]
 *     summary: Create a batch (admin only)
 *     responses:
 *       201: { description: Batch created }
 */
router.get('/', validate({ query: listBatchesQuerySchema }), listBatchesHandler);
router.post('/', requireRole('admin'), validate({ body: createBatchSchema }), createBatchHandler);

/**
 * @openapi
 * /batches/{id}:
 *   get:
 *     tags: [Batches]
 *     summary: Get a batch by id
 *     responses:
 *       200: { description: Batch }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Batches]
 *     summary: Update a batch (admin only)
 *     responses:
 *       200: { description: Updated batch }
 *   delete:
 *     tags: [Batches]
 *     summary: Archive/soft-delete a batch (admin only)
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/:id', validate({ params: batchIdParamsSchema }), getBatchHandler);
router.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: batchIdParamsSchema, body: updateBatchSchema }),
  updateBatchHandler
);
router.delete('/:id', requireRole('admin'), validate({ params: batchIdParamsSchema }), deleteBatchHandler);

/**
 * @openapi
 * /batches/{id}/metrics:
 *   get:
 *     tags: [Batches]
 *     summary: Derived performance metrics for a batch (avg score, completion, attendance, submission rate, feedback rating)
 *     responses:
 *       200: { description: Metrics }
 */
router.get('/:id/metrics', validate({ params: batchIdParamsSchema }), getBatchMetricsHandler);

/**
 * @openapi
 * /batches/{id}/trainee-stats:
 *   get:
 *     tags: [Batches]
 *     summary: Per-trainee stats for a batch (attendance %, assignments completed/pending, avg grade, latest submission, overall progress, feedback status) — admin or the batch's own facilitator only
 *     responses:
 *       200: { description: Trainee stats }
 *       403: { description: Not the assigned facilitator }
 */
router.get('/:id/trainee-stats', validate({ params: batchIdParamsSchema }), listBatchTraineeStatsHandler);

/**
 * @openapi
 * /batches/{id}/trainees:
 *   get:
 *     tags: [Batches]
 *     summary: List trainees enrolled in a batch
 *     responses:
 *       200: { description: Paginated trainee list }
 *   post:
 *     tags: [Batches]
 *     summary: Enroll a trainee in a batch (admin/facilitator)
 *     responses:
 *       201: { description: Enrolled }
 */
router.get(
  '/:id/trainees',
  validate({ params: batchIdParamsSchema, query: listBatchTraineesQuerySchema }),
  listBatchTraineesHandler
);
router.post(
  '/:id/trainees',
  requireRole('admin', 'facilitator'),
  validate({ params: batchIdParamsSchema, body: enrollTraineeSchema }),
  enrollTraineeHandler
);

/**
 * @openapi
 * /batches/{id}/trainees/{traineeId}:
 *   delete:
 *     tags: [Batches]
 *     summary: Remove a trainee from a batch (admin/facilitator)
 *     responses:
 *       204: { description: Removed }
 */
router.delete(
  '/:id/trainees/:traineeId',
  requireRole('admin', 'facilitator'),
  validate({ params: batchTraineeParamsSchema }),
  unenrollTraineeHandler
);

export default router;
