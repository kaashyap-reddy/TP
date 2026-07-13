import { Router } from 'express';
import {
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler
} from '../controllers/notifications.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { listNotificationsQuerySchema, notificationIdParamsSchema } from '../validators/notifications.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications for the current user (derived from the audit log), with per-user read state
 *     responses:
 *       200: { description: Paginated notifications with unreadCount }
 */
router.get('/', validate({ query: listNotificationsQuerySchema }), listNotificationsHandler);

/**
 * @openapi
 * /notifications/{id}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read for the current user
 *     responses:
 *       204: { description: Marked read }
 */
router.post('/:id/read', validate({ params: notificationIdParamsSchema }), markNotificationReadHandler);

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read for the current user
 *     responses:
 *       204: { description: Marked read }
 */
router.post('/read-all', markAllNotificationsReadHandler);

export default router;
