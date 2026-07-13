import { Router } from 'express';
import {
  addAttachmentHandler,
  downloadAttachmentHandler,
  getSubmissionHandler,
  gradeSubmissionHandler
} from '../controllers/submissions.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { createUploader } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  gradeSubmissionSchema,
  submissionAttachmentParamsSchema,
  submissionIdParamsSchema
} from '../validators/submissions.validator';

const router = Router();
const upload = createUploader('submissions');

router.use(requireAuth);

/**
 * @openapi
 * /submissions/{id}:
 *   get:
 *     tags: [Submissions]
 *     summary: Get a submission (owning trainee, the assignment's facilitator, or admin)
 *     responses:
 *       200: { description: Submission }
 *   patch:
 *     tags: [Submissions]
 *     summary: Grade a submission — set grade/feedback/status (owning facilitator or admin)
 *     responses:
 *       200: { description: Updated submission }
 */
router.get('/:id', validate({ params: submissionIdParamsSchema }), getSubmissionHandler);
router.patch(
  '/:id',
  requireRole('admin', 'facilitator'),
  validate({ params: submissionIdParamsSchema, body: gradeSubmissionSchema }),
  gradeSubmissionHandler
);

/**
 * @openapi
 * /submissions/{id}/attachments:
 *   post:
 *     tags: [Submissions]
 *     summary: Upload a file attachment to the current trainee's own submission
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Attachment stored }
 */
router.post(
  '/:id/attachments',
  requireRole('trainee'),
  validate({ params: submissionIdParamsSchema }),
  upload.single('file'),
  addAttachmentHandler
);

/**
 * @openapi
 * /submissions/{id}/attachments/{attachmentId}:
 *   get:
 *     tags: [Submissions]
 *     summary: Download a submission attachment
 *     responses:
 *       200: { description: File stream }
 */
router.get(
  '/:id/attachments/:attachmentId',
  validate({ params: submissionAttachmentParamsSchema }),
  downloadAttachmentHandler
);

export default router;
