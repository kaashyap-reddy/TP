import { Router } from 'express';
import { updateAttendanceHandler } from '../controllers/attendance.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { attendanceIdParamsSchema, updateAttendanceSchema } from '../validators/attendance.validator';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /attendance/{id}:
 *   patch:
 *     tags: [Attendance]
 *     summary: Correct a single attendance record (owning facilitator or admin)
 *     responses:
 *       200: { description: Updated attendance record }
 */
router.patch(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: attendanceIdParamsSchema, body: updateAttendanceSchema }),
  updateAttendanceHandler
);

export default router;
