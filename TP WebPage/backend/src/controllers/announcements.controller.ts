import { Request, Response } from 'express';
import * as announcementsService from '../services/announcements.service';
import { recordAuditEvent } from '../services/audit';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listAnnouncementsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.status(200).json(await announcementsService.list(req.user, req.query as never));
});

export const createAnnouncementHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const announcement = await announcementsService.create(req.user, req.body);
  await recordAuditEvent({
    eventType: 'AnnouncementCreated',
    message: `Announcement "${announcement.title}" was published.`,
    actorId: req.user.id,
    module: 'Announcements'
  });
  res.status(201).json({ announcement });
});

export const updateAnnouncementHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const announcement = await announcementsService.update(req.user, req.params.id, req.body);
  await recordAuditEvent({
    eventType: 'AnnouncementUpdated',
    message: `Announcement "${announcement.title}" was updated.`,
    actorId: req.user.id,
    module: 'Announcements'
  });
  res.status(200).json({ announcement });
});

export const deleteAnnouncementHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await announcementsService.remove(req.user, req.params.id);
  await recordAuditEvent({
    eventType: 'AnnouncementDeleted',
    message: 'An announcement was deleted.',
    actorId: req.user.id,
    module: 'Announcements'
  });
  res.status(204).send();
});

export const markAnnouncementReadHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await announcementsService.markRead(req.user, req.params.id);
  res.status(204).send();
});
