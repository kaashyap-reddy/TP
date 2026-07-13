import { Router } from 'express';
import {
  acceptInviteHandler,
  changePasswordHandler,
  createInviteHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler
} from '../controllers/auth.controller';
import { forgotPasswordRateLimiter, loginRateLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  acceptInviteSchema,
  changePasswordSchema,
  createInviteSchema,
  forgotPasswordSchema,
  loginSchema
} from '../validators/auth.validator';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               rememberMe: { type: boolean }
 *     responses:
 *       200: { description: Access token issued, refresh token set as httpOnly cookie }
 *       401: { description: Invalid credentials }
 */
router.post('/login', loginRateLimiter, validate({ body: loginSchema }), loginHandler);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current refresh token and clear the session cookie
 *     responses:
 *       204: { description: Logged out }
 */
router.post('/logout', logoutHandler);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a valid refresh token cookie for a new access token
 *     security: []
 *     responses:
 *       200: { description: New access token issued }
 *       401: { description: Refresh token missing, invalid, or expired }
 */
router.post('/refresh', refreshHandler);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/me', requireAuth, meHandler);

/**
 * @openapi
 * /auth/invite:
 *   post:
 *     tags: [Auth]
 *     summary: Invite a new user by email (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [admin, facilitator, trainee] }
 *     responses:
 *       201: { description: Invite created }
 *       409: { description: An account with this email already exists }
 */
router.post('/invite', requireAuth, requireRole('admin'), validate({ body: createInviteSchema }), createInviteHandler);

/**
 * @openapi
 * /auth/invite/accept:
 *   post:
 *     tags: [Auth]
 *     summary: Accept an invite and set a password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Account activated }
 *       400: { description: Invite invalid or expired }
 */
router.post('/invite/accept', validate({ body: acceptInviteSchema }), acceptInviteHandler);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset a password for an active account by email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset }
 *       404: { description: No active account found for that email }
 */
router.post('/forgot-password', forgotPasswordRateLimiter, validate({ body: forgotPasswordSchema }), forgotPasswordHandler);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change the current user's password (requires current password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       204: { description: Password changed }
 *       400: { description: Current password is incorrect }
 */
router.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), changePasswordHandler);

export default router;
