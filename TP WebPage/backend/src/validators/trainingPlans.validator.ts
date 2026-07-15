import { z } from 'zod';

const platformEnum = z.enum(['GoogleMeet', 'MicrosoftTeams', 'Zoom', 'Other']);

export const trainingPlanIdParamsSchema = z.object({ id: z.string().uuid() });

const minuteOfDay = z.number().int().min(0).max(1440);

export const updateTrainingPlanSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  durationMonths: z.number().int().positive().optional(),
  defaultSessionStartMinute: minuteOfDay.optional(),
  defaultSessionEndMinute: minuteOfDay.optional(),
  defaultAssignmentStartMinute: minuteOfDay.optional(),
  defaultAssignmentDeadlineMinute: minuteOfDay.optional()
});

export const trainingPlanSessionParamsSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid()
});

const trainingPlanSessionFields = z.object({
  title: z.string().trim().min(1),
  agenda: z.string().trim().optional().default(''),
  dayOffset: z.number().int().min(0),
  startMinute: minuteOfDay,
  endMinute: minuteOfDay,
  platform: platformEnum.optional().default('Other'),
  order: z.number().int().min(0),
  feedbackFormUrl: z.string().trim().url().optional()
});

export const createTrainingPlanSessionSchema = trainingPlanSessionFields.refine((data) => data.endMinute > data.startMinute, {
  message: 'End time must be after start time.',
  path: ['endMinute']
});

export const updateTrainingPlanSessionSchema = trainingPlanSessionFields
  .partial()
  .refine((data) => data.startMinute === undefined || data.endMinute === undefined || data.endMinute > data.startMinute, {
    message: 'End time must be after start time.',
    path: ['endMinute']
  });

export const trainingPlanAssignmentParamsSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid()
});

export const createTrainingPlanAssignmentSchema = z.object({
  title: z.string().trim().min(1),
  // What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics").
  agenda: z.string().trim().optional().default(''),
  description: z.string().optional().default(''),
  dueDayOffset: z.number().int().min(0),
  relatedSessionId: z.string().uuid().optional()
});

export const updateTrainingPlanAssignmentSchema = createTrainingPlanAssignmentSchema.partial();

export const trainingPlanResourceParamsSchema = z.object({
  id: z.string().uuid(),
  resourceId: z.string().uuid()
});

export const createTrainingPlanResourceSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  url: z.string().trim().url()
});

export const updateTrainingPlanResourceSchema = createTrainingPlanResourceSchema.partial();

export const trainingPlanAnnouncementParamsSchema = z.object({
  id: z.string().uuid(),
  announcementId: z.string().uuid()
});

const announcementPriorityEnum = z.enum(['Normal', 'Important', 'Critical']);

export const createTrainingPlanAnnouncementSchema = z.object({
  title: z.string().trim().min(1),
  message: z.string().trim().min(1),
  priority: announcementPriorityEnum.optional().default('Normal')
});

export const updateTrainingPlanAnnouncementSchema = createTrainingPlanAnnouncementSchema.partial();
