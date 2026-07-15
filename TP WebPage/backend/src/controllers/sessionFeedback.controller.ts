import { Request, Response } from 'express';
import * as sessionFeedbackService from '../services/sessionFeedback.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const attachSessionFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await sessionFeedbackService.attach(req.user, req.params.id, req.body);
  res.status(201).json({ form });
});

export const updateSessionFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await sessionFeedbackService.update(req.user, req.params.id, req.body);
  res.status(200).json({ form });
});

export const removeSessionFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await sessionFeedbackService.remove(req.user, req.params.id);
  res.status(204).send();
});

export const getSessionFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await sessionFeedbackService.getForSession(req.user, req.params.id);
  res.status(200).json({ form });
});

export const submitSessionFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const submission = await sessionFeedbackService.submit(req.user, req.params.id);
  res.status(201).json({ submission });
});
