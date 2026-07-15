import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { ApiError } from '../utils/ApiError';
import {
  createTrainingPlanAnnouncementSchema,
  createTrainingPlanAssignmentSchema,
  createTrainingPlanResourceSchema,
  createTrainingPlanSessionSchema,
  updateTrainingPlanAnnouncementSchema,
  updateTrainingPlanAssignmentSchema,
  updateTrainingPlanResourceSchema,
  updateTrainingPlanSchema,
  updateTrainingPlanSessionSchema
} from '../validators/trainingPlans.validator';

const detailInclude = {
  sessions: { orderBy: { order: 'asc' } },
  assignments: { orderBy: { dueDayOffset: 'asc' }, include: { relatedSession: { select: { id: true, title: true } } } },
  resources: true,
  announcements: true
} satisfies Prisma.TrainingPlanInclude;

export async function list() {
  return prisma.trainingPlan.findMany({
    include: {
      _count: { select: { sessions: true, assignments: true, resources: true, announcements: true, batches: true } }
    },
    orderBy: { name: 'asc' }
  });
}

export async function getById(id: string) {
  const plan = await prisma.trainingPlan.findUnique({ where: { id }, include: detailInclude });
  if (!plan) throw ApiError.notFound('Training plan not found.');
  return plan;
}

export async function update(id: string, input: z.infer<typeof updateTrainingPlanSchema>) {
  await getById(id);
  return prisma.trainingPlan.update({ where: { id }, data: input, include: detailInclude });
}

export async function createSession(trainingPlanId: string, input: z.infer<typeof createTrainingPlanSessionSchema>) {
  await getById(trainingPlanId);
  return prisma.trainingPlanSession.create({ data: { trainingPlanId, ...input } });
}

export async function updateSession(
  trainingPlanId: string,
  sessionId: string,
  input: z.infer<typeof updateTrainingPlanSessionSchema>
) {
  const existing = await prisma.trainingPlanSession.findFirst({ where: { id: sessionId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan session not found.');
  return prisma.trainingPlanSession.update({ where: { id: sessionId }, data: input });
}

export async function deleteSession(trainingPlanId: string, sessionId: string): Promise<void> {
  const existing = await prisma.trainingPlanSession.findFirst({ where: { id: sessionId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan session not found.');
  await prisma.trainingPlanSession.delete({ where: { id: sessionId } });
}

export async function createAssignment(
  trainingPlanId: string,
  input: z.infer<typeof createTrainingPlanAssignmentSchema>
) {
  await getById(trainingPlanId);
  return prisma.trainingPlanAssignment.create({ data: { trainingPlanId, ...input } });
}

export async function updateAssignment(
  trainingPlanId: string,
  assignmentId: string,
  input: z.infer<typeof updateTrainingPlanAssignmentSchema>
) {
  const existing = await prisma.trainingPlanAssignment.findFirst({ where: { id: assignmentId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan assignment not found.');
  return prisma.trainingPlanAssignment.update({ where: { id: assignmentId }, data: input });
}

export async function deleteAssignment(trainingPlanId: string, assignmentId: string): Promise<void> {
  const existing = await prisma.trainingPlanAssignment.findFirst({ where: { id: assignmentId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan assignment not found.');
  await prisma.trainingPlanAssignment.delete({ where: { id: assignmentId } });
}

export async function createResource(trainingPlanId: string, input: z.infer<typeof createTrainingPlanResourceSchema>) {
  await getById(trainingPlanId);
  return prisma.trainingPlanResource.create({ data: { trainingPlanId, ...input } });
}

export async function updateResource(trainingPlanId: string, resourceId: string, input: z.infer<typeof updateTrainingPlanResourceSchema>) {
  const existing = await prisma.trainingPlanResource.findFirst({ where: { id: resourceId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan resource not found.');
  return prisma.trainingPlanResource.update({ where: { id: resourceId }, data: input });
}

export async function deleteResource(trainingPlanId: string, resourceId: string): Promise<void> {
  const existing = await prisma.trainingPlanResource.findFirst({ where: { id: resourceId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan resource not found.');
  await prisma.trainingPlanResource.delete({ where: { id: resourceId } });
}

export async function createAnnouncement(trainingPlanId: string, input: z.infer<typeof createTrainingPlanAnnouncementSchema>) {
  await getById(trainingPlanId);
  return prisma.trainingPlanAnnouncement.create({ data: { trainingPlanId, ...input } });
}

export async function updateAnnouncement(
  trainingPlanId: string,
  announcementId: string,
  input: z.infer<typeof updateTrainingPlanAnnouncementSchema>
) {
  const existing = await prisma.trainingPlanAnnouncement.findFirst({ where: { id: announcementId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan announcement not found.');
  return prisma.trainingPlanAnnouncement.update({ where: { id: announcementId }, data: input });
}

export async function deleteAnnouncement(trainingPlanId: string, announcementId: string): Promise<void> {
  const existing = await prisma.trainingPlanAnnouncement.findFirst({ where: { id: announcementId, trainingPlanId } });
  if (!existing) throw ApiError.notFound('Training plan announcement not found.');
  await prisma.trainingPlanAnnouncement.delete({ where: { id: announcementId } });
}
