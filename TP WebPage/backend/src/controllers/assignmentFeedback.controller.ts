import { Request, Response } from 'express';
import * as assignmentFeedbackService from '../services/assignmentFeedback.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const attachAssignmentFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await assignmentFeedbackService.attach(req.user, req.params.id, req.body);
  res.status(201).json({ form });
});

export const updateAssignmentFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await assignmentFeedbackService.update(req.user, req.params.id, req.body);
  res.status(200).json({ form });
});

export const removeAssignmentFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await assignmentFeedbackService.remove(req.user, req.params.id);
  res.status(204).send();
});

export const getAssignmentFeedbackFormHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await assignmentFeedbackService.getForAssignment(req.user, req.params.id);
  res.status(200).json({ form });
});

export const submitAssignmentFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const submission = await assignmentFeedbackService.submit(req.user, req.params.id);
  res.status(201).json({ submission });
});
