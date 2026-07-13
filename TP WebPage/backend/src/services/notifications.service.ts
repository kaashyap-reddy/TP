import { z } from 'zod';
import { prisma } from '../prisma/client';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { listNotificationsQuerySchema } from '../validators/notifications.validator';

export async function list(userId: string, query: z.infer<typeof listNotificationsQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const readIds = await prisma.notificationRead.findMany({
    where: { userId },
    select: { auditLogId: true }
  });
  const readSet = new Set(readIds.map((r) => r.auditLogId));

  const where = query.unreadOnly ? { id: { notIn: Array.from(readSet) } } : {};

  const [entries, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, skip, take, orderBy: { occurredAt: 'desc' } }),
    prisma.auditLog.count({ where })
  ]);

  const data = entries.map((entry) => ({ ...entry, isRead: readSet.has(entry.id) }));
  return buildPaginatedResponse(data, total, page, pageSize);
}

export async function unreadCount(userId: string): Promise<number> {
  const readIds = await prisma.notificationRead.findMany({ where: { userId }, select: { auditLogId: true } });
  return prisma.auditLog.count({ where: { id: { notIn: readIds.map((r) => r.auditLogId) } } });
}

export async function markRead(userId: string, auditLogId: string): Promise<void> {
  await prisma.notificationRead.upsert({
    where: { auditLogId_userId: { auditLogId, userId } },
    create: { auditLogId, userId },
    update: {}
  });
}

export async function markAllRead(userId: string): Promise<void> {
  const readIds = await prisma.notificationRead.findMany({ where: { userId }, select: { auditLogId: true } });
  const unread = await prisma.auditLog.findMany({
    where: { id: { notIn: readIds.map((r) => r.auditLogId) } },
    select: { id: true }
  });

  if (unread.length === 0) return;

  await prisma.notificationRead.createMany({
    data: unread.map((entry) => ({ auditLogId: entry.id, userId })),
    skipDuplicates: true
  });
}
