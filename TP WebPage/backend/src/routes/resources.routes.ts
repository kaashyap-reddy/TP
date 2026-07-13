import { Router } from 'express';
import {
  createResourceHandler,
  deleteResourceHandler,
  downloadResourceHandler,
  getResourceHandler,
  listResourcesHandler,
  updateResourceHandler
} from '../controllers/resources.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { createUploader } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  createResourceSchema,
  listResourcesQuerySchema,
  resourceIdParamsSchema,
  updateResourceSchema
} from '../validators/resources.validator';

const router = Router();
const upload = createUploader('resources');

router.use(requireAuth);

/**
 * @openapi
 * /resources:
 *   get:
 *     tags: [Resources]
 *     summary: List learning resources — paginated, filterable by batch/category/verified, searchable, sortable
 *     responses:
 *       200: { description: Paginated resource list }
 *   post:
 *     tags: [Resources]
 *     summary: Upload a learning resource (facilitator/admin)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               title: { type: string }
 *               category: { type: string }
 *               batchId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Resource created }
 */
router.get('/', validate({ query: listResourcesQuerySchema }), listResourcesHandler);
router.post(
  '/',
  requireRole('admin', 'facilitator'),
  upload.single('file'),
  validate({ body: createResourceSchema }),
  createResourceHandler
);

/**
 * @openapi
 * /resources/{id}:
 *   get:
 *     tags: [Resources]
 *     summary: Get a resource's metadata by id
 *     responses:
 *       200: { description: Resource }
 *   patch:
 *     tags: [Resources]
 *     summary: Update resource metadata (uploader or admin)
 *     responses:
 *       200: { description: Updated resource }
 *   delete:
 *     tags: [Resources]
 *     summary: Soft-delete a resource (uploader or admin)
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/:id', validate({ params: resourceIdParamsSchema }), getResourceHandler);
router.patch(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: resourceIdParamsSchema, body: updateResourceSchema }),
  updateResourceHandler
);
router.delete(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: resourceIdParamsSchema }),
  deleteResourceHandler
);

/**
 * @openapi
 * /resources/{id}/download:
 *   get:
 *     tags: [Resources]
 *     summary: Download a resource file (increments its download count)
 *     responses:
 *       200: { description: File stream }
 */
router.get('/:id/download', validate({ params: resourceIdParamsSchema }), downloadResourceHandler);

export default router;
