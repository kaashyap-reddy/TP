import { Router } from 'express';
import {
  createAnnouncementHandler,
  deleteAnnouncementHandler,
  listAnnouncementsHandler,
  markAnnouncementReadHandler,
  updateAnnouncementHandler
} from '../controllers/announcements.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  announcementIdParamsSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementSchema
} from '../validators/announcements.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /announcements:
 *   get:
 *     tags: [Announcements]
 *     summary: List announcements visible to the current user (global + own batches; admin sees all)
 *     responses:
 *       200: { description: Paginated announcements with per-user read state }
 */
router.get('/', validate({ query: listAnnouncementsQuerySchema }), listAnnouncementsHandler);

/**
 * @openapi
 * /announcements:
 *   post:
 *     tags: [Announcements]
 *     summary: Publish an announcement (admin anywhere; facilitator only to own batches)
 *     responses:
 *       201: { description: Announcement created }
 */
router.post('/', requireRole('admin', 'facilitator'), validate({ body: createAnnouncementSchema }), createAnnouncementHandler);

/**
 * @openapi
 * /announcements/{id}:
 *   patch:
 *     tags: [Announcements]
 *     summary: Update an announcement (author or admin)
 *     responses:
 *       200: { description: Announcement updated }
 *   delete:
 *     tags: [Announcements]
 *     summary: Soft-delete an announcement (author or admin)
 *     responses:
 *       204: { description: Announcement deleted }
 */
router.patch(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: announcementIdParamsSchema, body: updateAnnouncementSchema }),
  updateAnnouncementHandler
);
router.delete('/:id', requireRole('admin', 'facilitator'), validate({ params: announcementIdParamsSchema }), deleteAnnouncementHandler);

/**
 * @openapi
 * /announcements/{id}/read:
 *   post:
 *     tags: [Announcements]
 *     summary: Mark an announcement as read for the current user
 *     responses:
 *       204: { description: Marked read }
 */
router.post('/:id/read', validate({ params: announcementIdParamsSchema }), markAnnouncementReadHandler);

export default router;
