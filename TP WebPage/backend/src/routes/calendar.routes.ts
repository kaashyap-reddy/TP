import { Router } from 'express';
import { listCalendarEventsHandler } from '../controllers/calendar.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { listCalendarQuerySchema } from '../validators/calendar.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /calendar:
 *   get:
 *     tags: [Calendar]
 *     summary: Normalized calendar events (sessions + assignment deadlines) — scoped to batches the caller can see (all for admin, managed batches for a facilitator, enrolled batches for a trainee)
 *     responses:
 *       200: { description: Calendar events }
 */
router.get('/', validate({ query: listCalendarQuerySchema }), listCalendarEventsHandler);

export default router;
