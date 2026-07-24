import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AppRole } from '../types/auth';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { listNotificationsQuerySchema } from '../validators/notifications.validator';

// Every read/write below is scoped to `recipientId: userId` -- the notification was assigned to
// exactly this recipient when it was generated (see notifyUser/notifyUsers/notifyRole/
// notifyBatch), so there is no dynamic scope-resolution path here that could leak another
// user's notifications. Do not add a batch/role-based WHERE clause to these read paths --
// authorize by recipientId only.

export async function list(userId: string, query: z.infer<typeof listNotificationsQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);
  const where = { recipientId: userId, ...(query.unreadOnly ? { readAt: null } : {}) };

  const [entries, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where })
  ]);

  return buildPaginatedResponse(entries, total, page, pageSize);
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientId: userId, readAt: null } });
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  // updateMany (not update) so a notification id that exists but belongs to someone else is a
  // silent no-op rather than a 500 from a failed where-by-id-and-owner lookup -- it also means
  // this can never be used to probe for another user's notification ids.
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId, readAt: null },
    data: { readAt: new Date() }
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() }
  });
}

interface NotifyPayload {
  type: string;
  title: string;
  message: string;
  targetUrl?: string;
  severity?: 'Info' | 'Warning' | 'Critical';
  batchId?: string;
}

export async function notifyUser(recipientId: string, payload: NotifyPayload): Promise<void> {
  await prisma.notification.create({ data: { recipientId, ...payload } });
}

export async function notifyUsers(recipientIds: string[], payload: NotifyPayload): Promise<void> {
  if (recipientIds.length === 0) return;
  await prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({ recipientId, ...payload }))
  });
}

export async function notifyRole(role: AppRole, payload: NotifyPayload): Promise<void> {
  const recipients = await prisma.user.findMany({ where: { role: { name: role }, deletedAt: null }, select: { id: true } });
  await notifyUsers(recipients.map((r) => r.id), payload);
}

/**
 * Fans out to a batch's currently-enrolled trainees and/or its assigned facilitator. Enrollment
 * is checked at call time (`removedAt: null`) so a trainee who has since been removed from the
 * batch never receives it, regardless of how stale the caller's own batch reference is.
 */
export async function notifyBatch(
  batchId: string,
  payload: NotifyPayload,
  targets: { trainees?: boolean; facilitator?: boolean }
): Promise<void> {
  const recipientIds: string[] = [];

  if (targets.trainees) {
    const enrolled = await prisma.batchTrainee.findMany({ where: { batchId, removedAt: null }, select: { traineeId: true } });
    recipientIds.push(...enrolled.map((e) => e.traineeId));
  }

  if (targets.facilitator) {
    const batch = await prisma.batch.findFirst({ where: { id: batchId, deletedAt: null }, select: { facilitatorId: true } });
    if (batch?.facilitatorId) recipientIds.push(batch.facilitatorId);
  }

  await notifyUsers(recipientIds, { ...payload, batchId });
}
