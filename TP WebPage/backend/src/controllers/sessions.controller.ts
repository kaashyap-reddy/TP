import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import * as sessionsService from '../services/sessions.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await sessionsService.list(req.query as never));
});

export const createSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const session = await sessionsService.create(req.user, req.body);
  await recordAuditEvent({
    eventType: 'SessionCreated',
    message: `Session "${session.title}" was scheduled.`,
    actorId: req.user.id,
    module: 'Sessions'
  });
  res.status(201).json({ session });
});

export const getSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = await sessionsService.getById(req.params.id);
  res.status(200).json({ session });
});

export const updateSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const session = await sessionsService.update(req.user, req.params.id, req.body);
  await recordAuditEvent({
    eventType: 'SessionUpdated',
    message: `Session "${session.title}" was updated.`,
    actorId: req.user.id,
    module: 'Sessions'
  });
  res.status(200).json({ session });
});

export const deleteSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const session = await sessionsService.getById(req.params.id);
  await sessionsService.softDelete(req.user, req.params.id);
  await recordAuditEvent({
    eventType: 'SessionDeleted',
    message: `Session "${session.title}" was deleted.`,
    actorId: req.user.id,
    module: 'Sessions'
  });
  res.status(204).send();
});
