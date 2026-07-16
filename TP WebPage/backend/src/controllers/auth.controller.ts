import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { recordAuditEvent } from '../services/audit';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../utils/cookies';

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;
  const { user, accessToken, refreshToken, refreshTokenMaxAgeMs } = await authService.login(email, password, rememberMe);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(refreshTokenMaxAgeMs));
  res.status(200).json({ user, accessToken });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.signedCookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(raw);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(204).send();
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.signedCookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const { user, accessToken, refreshToken, refreshTokenMaxAgeMs } = await authService.refresh(raw);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(refreshTokenMaxAgeMs));
  res.status(200).json({ user, accessToken });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ user });
});

export const createInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { email, role } = req.body;
  const { token, ...safeResult } = await authService.createInvite(email, role, req.user.id);
  // No email provider is connected yet (see services/email/), so this is the only way to hand
  // the invite link to whoever's testing — but it must never leak in a real deployment, where
  // the (still-unconnected) email delivery is the only intended channel for it.
  res.status(201).json(config.exposeAuthTokens ? { ...safeResult, token } : safeResult);
});

export const acceptInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const result = await authService.acceptInvite(token, password);
  await recordAuditEvent({
    eventType: 'UserCreated',
    message: `A new ${result.role} account was created via invite.`,
    actorId: result.userId,
    module: 'Users'
  });
  res.status(200).json({ role: result.role });
});

export const forgotPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authService.requestPasswordReset(email);
  // Identical response whether or not the account exists — no enumeration. The raw token is
  // exposed only in dev/test (same policy and reason as createInviteHandler above).
  const body: Record<string, unknown> = { success: true };
  if (config.exposeAuthTokens && result) {
    body.token = result.token;
    body.expiresAt = result.expiresAt;
  }
  res.status(200).json(body);
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  res.status(200).json({ success: true });
});

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.status(204).send();
});
