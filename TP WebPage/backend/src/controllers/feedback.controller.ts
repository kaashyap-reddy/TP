import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import * as feedbackService from '../services/feedback.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.status(200).json(await feedbackService.list(req.user, req.query as never));
});

export const createFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const feedback = await feedbackService.create(req.user, req.body);
  await recordAuditEvent({
    eventType: 'FeedbackSubmitted',
    message:
      feedback.direction === 'TraineeToFacilitator'
        ? `Trainee feedback (${feedback.rating}/5) was submitted about a facilitator.`
        : `Feedback (${feedback.rating}/5) was recorded for a trainee.`,
    actorId: req.user.id,
    module: 'Feedback'
  });
  res.status(201).json({ feedback });
});

export const getFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const feedback = await feedbackService.getById(req.user, req.params.id);
  res.status(200).json({ feedback });
});
