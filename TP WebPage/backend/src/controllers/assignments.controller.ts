import { Request, Response } from 'express';
import * as assignmentsService from '../services/assignments.service';
import { recordAuditEvent } from '../services/audit';
import { getStorageProvider } from '../services/storage';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { isInlineViewable } from '../utils/fileDisposition';
import { logger } from '../utils/logger';

export const listAssignmentsHandler = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await assignmentsService.list(req.query as never, req.user));
});

export const createAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const assignment = await assignmentsService.create(req.user, req.body, req.file);
  await recordAuditEvent({
    eventType: 'AssignmentCreated',
    message: `Assignment "${assignment.title}" was created for ${assignment.batches.length} batch(es).`,
    actorId: req.user.id,
    module: 'Assignments'
  });
  res.status(201).json({ assignment });
});

export const getAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentsService.getById(req.params.id, req.user);
  res.status(200).json({ assignment });
});

export const updateAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const assignment = await assignmentsService.update(req.user, req.params.id, req.body, req.file);
  await recordAuditEvent({
    eventType: 'AssignmentUpdated',
    message: `Assignment "${assignment.title}" was updated.`,
    actorId: req.user.id,
    module: 'Assignments'
  });
  res.status(200).json({ assignment });
});

export const deleteAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const assignment = await assignmentsService.getById(req.params.id);
  await assignmentsService.softDelete(req.user, req.params.id);
  await recordAuditEvent({
    eventType: 'AssignmentDeleted',
    message: `Assignment "${assignment.title}" was deleted.`,
    actorId: req.user.id,
    module: 'Assignments'
  });
  res.status(204).send();
});

export const viewAssignmentAttachmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const assignment = await assignmentsService.getAttachmentForView(req.user, req.params.id);
  logger.info('file.downloaded', { assignmentId: assignment.id, downloadedBy: req.user.id });
  await getStorageProvider().sendFile(
    res,
    assignment.attachmentStorageKey!,
    assignment.attachmentOriginalFilename!,
    { inline: isInlineViewable(assignment.attachmentMimeType) }
  );
});
