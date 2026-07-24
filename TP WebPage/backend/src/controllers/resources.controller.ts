import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import * as resourcesService from '../services/resources.service';
import { getStorageProvider } from '../services/storage';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

export const listResourcesHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.status(200).json(await resourcesService.list(req.user, req.query as never));
});

export const createResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest('A file is required.');
  const resource = await resourcesService.create(req.user, req.body, req.file);
  logger.info('file.uploaded', { resourceId: resource.id, uploadedBy: req.user.id, sizeBytes: resource.sizeBytes });
  res.status(201).json({ resource });
});

export const getResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const resource = await resourcesService.getById(req.user, req.params.id);
  res.status(200).json({ resource });
});

export const updateResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const resource = await resourcesService.update(req.user, req.params.id, req.body);
  if (req.body.verified === true) {
    await recordAuditEvent({
      eventType: 'ResourceVerified',
      message: `Resource "${resource.title}" was verified.`,
      actorId: req.user.id,
      module: 'Resources'
    });
  }
  res.status(200).json({ resource });
});

export const deleteResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const resource = await resourcesService.getById(req.user, req.params.id);
  await resourcesService.softDelete(req.user, req.params.id);
  await recordAuditEvent({
    eventType: 'FileDeleted',
    message: `Resource "${resource.title}" was deleted.`,
    actorId: req.user.id,
    module: 'Resources'
  });
  res.status(204).send();
});

export const downloadResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const resource = await resourcesService.getForDownload(req.user, req.params.id);
  logger.info('file.downloaded', { resourceId: resource.id, downloadedBy: req.user.id });
  // A Training-Plan-sourced resource is a shared external link (e.g. copied from a template),
  // not an uploaded file — redirect instead of trying to stream a file that doesn't exist here.
  if (resource.externalUrl) {
    res.redirect(resource.externalUrl);
    return;
  }
  if (!resource.storageKey) throw ApiError.notFound('This resource has no downloadable file.');
  await getStorageProvider().sendFile(res, resource.storageKey, resource.title);
});
