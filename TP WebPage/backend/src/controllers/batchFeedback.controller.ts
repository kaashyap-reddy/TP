import { Request, Response } from 'express';
import * as batchFeedbackService from '../services/batchFeedback.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listBatchFeedbackFormsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const forms = await batchFeedbackService.list(req.user, req.params.id);
  res.status(200).json({ forms });
});

export const attachBatchFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await batchFeedbackService.create(req.user, req.params.id, req.body);
  res.status(201).json({ form });
});

export const updateBatchFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await batchFeedbackService.update(req.user, req.params.id, req.params.formId, req.body);
  res.status(200).json({ form });
});

export const removeBatchFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await batchFeedbackService.remove(req.user, req.params.id, req.params.formId);
  res.status(204).send();
});

export const submitBatchFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const submission = await batchFeedbackService.submit(req.user, req.params.id, req.params.formId);
  res.status(201).json({ submission });
});
