import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listAttendanceForSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const attendance = await attendanceService.listForSession(req.user, req.params.id);
  res.status(200).json({ attendance });
});

export const bulkMarkAttendanceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const attendance = await attendanceService.bulkMark(req.user, req.params.id, req.body);
  res.status(200).json({ attendance });
});

export const updateAttendanceHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const attendance = await attendanceService.updateOne(req.user, req.params.id, req.body);
  res.status(200).json({ attendance });
});
