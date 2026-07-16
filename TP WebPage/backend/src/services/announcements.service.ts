import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import {
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementSchema
} from '../validators/announcements.validator';

const include = {
  author: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } },
  _count: { select: { reads: true } }
} satisfies Prisma.AnnouncementInclude;

type AnnouncementRow = Prisma.AnnouncementGetPayload<{ include: typeof include }>;

/** readByCount comes from the reads relation; isRead is per-caller. */
function serialize(row: AnnouncementRow, readIds: Set<string>) {
  const { _count, ...rest } = row;
  return { ...rest, readByCount: _count.reads, isRead: readIds.has(row.id) };
}

/** Which batches this non-admin actor belongs to (facilitator: owns; trainee: enrolled). */
async function visibleBatchIds(actor: AuthenticatedUser): Promise<string[]> {
  if (actor.role === 'facilitator') {
    const batches = await prisma.batch.findMany({ where: { facilitatorId: actor.id, deletedAt: null }, select: { id: true } });
    return batches.map((b) => b.id);
  }
  const enrollments = await prisma.batchTrainee.findMany({ where: { traineeId: actor.id, removedAt: null }, select: { batchId: true } });
  return enrollments.map((e) => e.batchId);
}

export async function list(actor: AuthenticatedUser, query: z.infer<typeof listAnnouncementsQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);
  const now = new Date();

  const where: Prisma.AnnouncementWhereInput = {
    deletedAt: null,
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.pinned !== undefined ? { pinned: query.pinned } : {})
  };

  if (actor.role !== 'admin') {
    // Global announcements plus those scoped to a batch the actor actually belongs to;
    // scheduled-for-later and already-expired ones stay hidden from non-admins.
    const batchIds = await visibleBatchIds(actor);
    where.AND = [
      { OR: [{ batchId: null }, { batchId: { in: batchIds } }] },
      { OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
    ];
  }

  const [rows, total, reads] = await prisma.$transaction([
    prisma.announcement.findMany({
      where,
      include,
      skip,
      take,
      orderBy: [{ pinned: 'desc' }, { [query.sortBy]: 'desc' }]
    }),
    prisma.announcement.count({ where }),
    prisma.announcementRead.findMany({ where: { userId: actor.id }, select: { announcementId: true } })
  ]);

  const readIds = new Set(reads.map((r) => r.announcementId));
  return buildPaginatedResponse(rows.map((row) => serialize(row, readIds)), total, page, pageSize);
}

export async function create(actor: AuthenticatedUser, input: z.infer<typeof createAnnouncementSchema>) {
  if (input.batchId) {
    const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
    if (!batch) throw ApiError.badRequest('No such batch.');
    if (actor.role === 'facilitator' && batch.facilitatorId !== actor.id) {
      throw ApiError.forbidden('You may only post announcements to your own batches.');
    }
  } else if (actor.role !== 'admin') {
    throw ApiError.forbidden('Only admins may post global announcements.');
  }

  const created = await prisma.announcement.create({
    data: { ...input, authorId: actor.id },
    include
  });
  return serialize(created, new Set());
}

async function getOwnedOrThrow(actor: AuthenticatedUser, id: string) {
  const announcement = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  if (actor.role !== 'admin' && announcement.authorId !== actor.id) {
    throw ApiError.forbidden('Only the author or an admin may modify this announcement.');
  }
  return announcement;
}

export async function update(actor: AuthenticatedUser, id: string, input: z.infer<typeof updateAnnouncementSchema>) {
  await getOwnedOrThrow(actor, id);
  const updated = await prisma.announcement.update({ where: { id }, data: input, include });
  const read = await prisma.announcementRead.findUnique({
    where: { announcementId_userId: { announcementId: id, userId: actor.id } }
  });
  return serialize(updated, new Set(read ? [id] : []));
}

export async function remove(actor: AuthenticatedUser, id: string): Promise<void> {
  await getOwnedOrThrow(actor, id);
  await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function markRead(actor: AuthenticatedUser, id: string): Promise<void> {
  const announcement = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });
  if (!announcement) throw ApiError.notFound('Announcement not found.');

  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: id, userId: actor.id } },
    create: { announcementId: id, userId: actor.id },
    update: {}
  });
}
