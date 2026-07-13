import { Request, Response } from 'express';
import * as calendarService from '../services/calendar.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listCalendarEventsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const events = await calendarService.getEvents(req.user, req.query as never);
  res.status(200).json({ events });
});
