import { Request, Response } from 'express';
import * as facilitatorAssignmentsService from '../services/facilitatorAssignments.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listFacilitatorAssignmentsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const query = req.query as never as Parameters<typeof facilitatorAssignmentsService.list>[0];
  // A facilitator may only ever list their own assignments, regardless of what was requested.
  const scopedQuery = req.user.role === 'facilitator' ? { ...query, facilitatorId: req.user.id } : query;
  const result = await facilitatorAssignmentsService.list(scopedQuery);
  res.status(200).json(result);
});

export const createFacilitatorAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const assignment = await facilitatorAssignmentsService.create(req.user.id, req.body);
  res.status(201).json({ assignment });
});

export const updateFacilitatorAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await facilitatorAssignmentsService.update(req.params.id, req.body);
  res.status(200).json({ assignment });
});

export const setPrimaryFacilitatorAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await facilitatorAssignmentsService.setPrimary(req.params.id);
  res.status(200).json({ assignment });
});

export const removeFacilitatorAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  await facilitatorAssignmentsService.remove(req.params.id);
  res.status(204).send();
});
