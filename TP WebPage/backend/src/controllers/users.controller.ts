import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import * as usersService from '../services/users.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await usersService.list(req.query as never);
  res.status(200).json(result);
});

export const getMeHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await usersService.getById(req.user.id);
  res.status(200).json({ user });
});

export const updateMeHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await usersService.updateSelf(req.user.id, req.body);
  res.status(200).json({ user });
});

export const getUserHandler = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.id !== req.params.id) {
    throw ApiError.forbidden();
  }
  const user = await usersService.getById(req.params.id);
  res.status(200).json({ user });
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.updateByAdmin(req.params.id, req.body);
  await recordAuditEvent({
    eventType: req.body.role ? 'RoleChanged' : 'UserUpdated',
    message: req.body.role ? `${user.name}'s role was changed to ${req.body.role}.` : `${user.name}'s account was updated.`,
    actorId: req.user?.id ?? null,
    module: 'Users',
    newValue: req.body.role ?? null
  });
  res.status(200).json({ user });
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getById(req.params.id);
  await usersService.softDelete(req.params.id);
  await recordAuditEvent({
    eventType: 'UserDeleted',
    message: `${user.name} (${user.email}) was deleted.`,
    actorId: req.user?.id ?? null,
    module: 'Users'
  });
  res.status(204).send();
});
