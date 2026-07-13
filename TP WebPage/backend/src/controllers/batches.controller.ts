import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import * as batchesService from '../services/batches.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const listBatchesHandler = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await batchesService.list(req.query as never));
});

export const createBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchesService.create(req.body);
  await recordAuditEvent({
    eventType: 'BatchCreated',
    message: `Batch "${batch.name}" was created.`,
    actorId: req.user?.id ?? null,
    module: 'Batches'
  });
  res.status(201).json({ batch });
});

export const getBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchesService.getById(req.params.id);
  res.status(200).json({ batch });
});

export const updateBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchesService.update(req.params.id, req.body);
  await recordAuditEvent({
    eventType: 'BatchUpdated',
    message: `Batch "${batch.name}" was updated.`,
    actorId: req.user?.id ?? null,
    module: 'Batches'
  });
  res.status(200).json({ batch });
});

export const deleteBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const batch = await batchesService.getById(req.params.id);
  await batchesService.softDelete(req.params.id);
  await recordAuditEvent({
    eventType: 'BatchDeleted',
    message: `Batch "${batch.name}" was deleted.`,
    actorId: req.user?.id ?? null,
    module: 'Batches'
  });
  res.status(204).send();
});

export const getBatchMetricsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const metrics = await batchesService.getMetrics(req.user, req.params.id);
  res.status(200).json({ metrics });
});

export const listBatchTraineesHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.status(200).json(await batchesService.listTrainees(req.user, req.params.id, req.query as never));
});

export const listBatchTraineeStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const trainees = await batchesService.listTraineeStats(req.user, req.params.id);
  res.status(200).json({ trainees });
});

export const enrollTraineeHandler = asyncHandler(async (req: Request, res: Response) => {
  const enrollment = await batchesService.enrollTrainee(req.params.id, req.body);
  res.status(201).json({ enrollment });
});

export const unenrollTraineeHandler = asyncHandler(async (req: Request, res: Response) => {
  await batchesService.unenrollTrainee(req.params.id, req.params.traineeId);
  res.status(204).send();
});
