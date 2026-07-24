import { Router } from 'express';
import {
  deleteUserHandler,
  getAvatarHandler,
  getMeHandler,
  getUserHandler,
  listUsersHandler,
  removeAvatarHandler,
  updateMeHandler,
  updateUserHandler,
  uploadAvatarHandler
} from '../controllers/users.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { createUploader } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { listUsersQuerySchema, updateSelfSchema, updateUserByAdminSchema, userIdParamsSchema } from '../validators/users.validator';

const router = Router();
// Avatars get their own 1MB cap, independent of the general MAX_UPLOAD_SIZE_MB used by
// resources/submissions — a profile photo has no business being as large as course material.
const avatarUpload = createUploader('avatars', { maxSizeBytes: 1_000_000 });

router.use(requireAuth);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (admin only) — paginated, filterable, searchable, sortable
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [admin, facilitator, trainee] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, email, createdAt, lastLoginAt] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200: { description: Paginated user list }
 */
router.get('/', requireRole('admin'), validate({ query: listUsersQuerySchema }), listUsersHandler);

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get the current user's profile
 *     responses:
 *       200: { description: Current user }
 *   patch:
 *     tags: [Users]
 *     summary: Update the current user's own name/email/phone/location
 *     responses:
 *       200: { description: Updated user }
 */
router.get('/me', getMeHandler);
router.patch('/me', validate({ body: updateSelfSchema }), updateMeHandler);

/**
 * @openapi
 * /users/me/avatar:
 *   get:
 *     tags: [Users]
 *     summary: Stream the current user's avatar image
 *     responses:
 *       200: { description: Image stream }
 *       404: { description: No avatar uploaded }
 *   post:
 *     tags: [Users]
 *     summary: Upload/replace the current user's avatar (JPG/PNG, max 1MB, max 4096x4096px)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated user }
 *   delete:
 *     tags: [Users]
 *     summary: Remove the current user's avatar
 *     responses:
 *       200: { description: Updated user }
 */
router.get('/me/avatar', getAvatarHandler);
router.post('/me/avatar', avatarUpload.single('avatar'), uploadAvatarHandler);
router.delete('/me/avatar', removeAvatarHandler);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by id (admin, or self)
 *     responses:
 *       200: { description: User }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Users]
 *     summary: Update any user, including role/isActive (admin only)
 *     responses:
 *       200: { description: Updated user }
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (admin only)
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/:id', validate({ params: userIdParamsSchema }), getUserHandler);
router.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: userIdParamsSchema, body: updateUserByAdminSchema }),
  updateUserHandler
);
router.delete('/:id', requireRole('admin'), validate({ params: userIdParamsSchema }), deleteUserHandler);

export default router;
