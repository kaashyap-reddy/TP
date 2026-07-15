import { Request, Response } from 'express';
import { recordAuditEvent } from '../services/audit';
import * as trainingPlansService from '../services/trainingPlans.service';
import { asyncHandler } from '../utils/asyncHandler';

export const listTrainingPlansHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ trainingPlans: await trainingPlansService.list() });
});

export const getTrainingPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ trainingPlan: await trainingPlansService.getById(req.params.id) });
});

export const updateTrainingPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  const trainingPlan = await trainingPlansService.update(req.params.id, req.body);
  await recordAuditEvent({
    eventType: 'TrainingPlanUpdated',
    message: `Training plan "${trainingPlan.name}" was updated.`,
    actorId: req.user?.id ?? null,
    module: 'TrainingPlans'
  });
  res.status(200).json({ trainingPlan });
});

export const createTrainingPlanSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = await trainingPlansService.createSession(req.params.id, req.body);
  res.status(201).json({ session });
});

export const updateTrainingPlanSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = await trainingPlansService.updateSession(req.params.id, req.params.sessionId, req.body);
  res.status(200).json({ session });
});

export const deleteTrainingPlanSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  await trainingPlansService.deleteSession(req.params.id, req.params.sessionId);
  res.status(204).send();
});

export const createTrainingPlanAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await trainingPlansService.createAssignment(req.params.id, req.body);
  res.status(201).json({ assignment });
});

export const updateTrainingPlanAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await trainingPlansService.updateAssignment(req.params.id, req.params.assignmentId, req.body);
  res.status(200).json({ assignment });
});

export const deleteTrainingPlanAssignmentHandler = asyncHandler(async (req: Request, res: Response) => {
  await trainingPlansService.deleteAssignment(req.params.id, req.params.assignmentId);
  res.status(204).send();
});

export const createTrainingPlanResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  const resource = await trainingPlansService.createResource(req.params.id, req.body);
  res.status(201).json({ resource });
});

export const updateTrainingPlanResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  const resource = await trainingPlansService.updateResource(req.params.id, req.params.resourceId, req.body);
  res.status(200).json({ resource });
});

export const deleteTrainingPlanResourceHandler = asyncHandler(async (req: Request, res: Response) => {
  await trainingPlansService.deleteResource(req.params.id, req.params.resourceId);
  res.status(204).send();
});

export const createTrainingPlanAnnouncementHandler = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await trainingPlansService.createAnnouncement(req.params.id, req.body);
  res.status(201).json({ announcement });
});

export const updateTrainingPlanAnnouncementHandler = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await trainingPlansService.updateAnnouncement(req.params.id, req.params.announcementId, req.body);
  res.status(200).json({ announcement });
});

export const deleteTrainingPlanAnnouncementHandler = asyncHandler(async (req: Request, res: Response) => {
  await trainingPlansService.deleteAnnouncement(req.params.id, req.params.announcementId);
  res.status(204).send();
});
