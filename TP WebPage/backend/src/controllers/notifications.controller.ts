import { Request, Response } from 'express';
import * as notificationsService from '../services/notifications.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listNotificationsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await notificationsService.list(req.user.id, req.query as never);
  const unreadCount = await notificationsService.unreadCount(req.user.id);
  res.status(200).json({ ...result, unreadCount });
});

export const markNotificationReadHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await notificationsService.markRead(req.user.id, req.params.id);
  res.status(204).send();
});

export const markAllNotificationsReadHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await notificationsService.markAllRead(req.user.id);
  res.status(204).send();
});
