import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import { getStorageProvider } from '../services/storage';
import * as submissionsService from '../services/submissions.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { isInlineViewable } from '../utils/fileDisposition';
import { logger } from '../utils/logger';

export const listSubmissionsForAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.status(200).json(await submissionsService.listForAssignment(req.user, req.params.id, req.query as never));
});

export const submitOwnHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const submission = await submissionsService.submitOwn(req.user, req.params.id);
  res.status(201).json({ submission });
});

export const getSubmissionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const submission = await submissionsService.getById(req.user, req.params.id);
  res.status(200).json({ submission });
});

export const gradeSubmissionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const submission = await submissionsService.grade(req.user, req.params.id, req.body);
  await recordAuditEvent({
    eventType: 'SubmissionGraded',
    message: `A submission was graded${typeof req.body.grade === 'number' ? ` (${req.body.grade})` : ''}.`,
    actorId: req.user.id,
    module: 'Submissions',
    newValue: submission.grade !== null ? String(submission.grade) : null
  });
  res.status(200).json({ submission });
});

export const addAttachmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest('A file is required.');
  const attachment = await submissionsService.addAttachment(req.user, req.params.id, req.file);
  logger.info('file.uploaded', { attachmentId: attachment.id, uploadedBy: req.user.id, sizeBytes: attachment.sizeBytes });
  res.status(201).json({ attachment });
});

export const downloadAttachmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const attachment = await submissionsService.getAttachmentForDownload(req.user, req.params.id, req.params.attachmentId);
  logger.info('file.downloaded', { attachmentId: attachment.id, downloadedBy: req.user.id });
  await getStorageProvider().sendFile(res, attachment.storageKey, attachment.originalFilename, {
    inline: isInlineViewable(attachment.mimeType)
  });
});
