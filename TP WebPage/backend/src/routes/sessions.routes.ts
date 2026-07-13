import { Router } from 'express';
import {
  bulkMarkAttendanceHandler,
  listAttendanceForSessionHandler
} from '../controllers/attendance.controller';
import {
  createSessionHandler,
  deleteSessionHandler,
  getSessionHandler,
  listSessionsHandler,
  updateSessionHandler
} from '../controllers/sessions.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { bulkMarkAttendanceSchema } from '../validators/attendance.validator';
import {
  createSessionSchema,
  listSessionsQuerySchema,
  sessionIdParamsSchema,
  updateSessionSchema
} from '../validators/sessions.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: List sessions — paginated, filterable by batch/status, searchable, sortable
 *     responses:
 *       200: { description: Paginated session list }
 *   post:
 *     tags: [Sessions]
 *     summary: Create a session (facilitator/admin)
 *     responses:
 *       201: { description: Session created }
 */
router.get('/', validate({ query: listSessionsQuerySchema }), listSessionsHandler);
router.post('/', requireRole('admin', 'facilitator'), validate({ body: createSessionSchema }), createSessionHandler);

/**
 * @openapi
 * /sessions/{id}:
 *   get:
 *     tags: [Sessions]
 *     summary: Get a session by id
 *     responses:
 *       200: { description: Session }
 *   patch:
 *     tags: [Sessions]
 *     summary: Update a session (owning facilitator or admin)
 *     responses:
 *       200: { description: Updated session }
 *   delete:
 *     tags: [Sessions]
 *     summary: Soft-delete a session (owning facilitator or admin)
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/:id', validate({ params: sessionIdParamsSchema }), getSessionHandler);
router.patch(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema, body: updateSessionSchema }),
  updateSessionHandler
);
router.delete(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema }),
  deleteSessionHandler
);

/**
 * @openapi
 * /sessions/{id}/attendance:
 *   get:
 *     tags: [Attendance]
 *     summary: List attendance records for a session (owning facilitator or admin)
 *     responses:
 *       200: { description: Attendance records }
 *   put:
 *     tags: [Attendance]
 *     summary: Bulk mark attendance for a session (owning facilitator or admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     traineeId: { type: string, format: uuid }
 *                     status: { type: string, enum: [Present, Absent, Late, Excused] }
 *     responses:
 *       200: { description: Attendance recorded }
 */
router.get(
  '/:id/attendance',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema }),
  listAttendanceForSessionHandler
);
router.put(
  '/:id/attendance',
  requireRole('admin', 'facilitator'),
  validate({ params: sessionIdParamsSchema, body: bulkMarkAttendanceSchema }),
  bulkMarkAttendanceHandler
);

export default router;
