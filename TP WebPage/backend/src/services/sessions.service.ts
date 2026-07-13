import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { createSessionSchema, listSessionsQuerySchema, updateSessionSchema } from '../validators/sessions.validator';

const include = {
  facilitator: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } }
} satisfies Prisma.SessionInclude;

export function assertOwnerOrAdmin(actor: AuthenticatedUser, facilitatorId: string) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === facilitatorId) return;
  throw ApiError.forbidden('You do not own this session.');
}

export async function list(query: z.infer<typeof listSessionsQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.SessionWhereInput = {
    deletedAt: null,
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {})
  };

  const [sessions, total] = await prisma.$transaction([
    prisma.session.findMany({ where, include, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.session.count({ where })
  ]);

  return buildPaginatedResponse(sessions, total, page, pageSize);
}

export async function getById(id: string) {
  const session = await prisma.session.findFirst({ where: { id, deletedAt: null }, include });
  if (!session) throw ApiError.notFound('Session not found.');
  return session;
}

export async function create(actor: AuthenticatedUser, input: z.infer<typeof createSessionSchema>) {
  const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
  if (!batch) throw ApiError.badRequest('No such batch.');

  return prisma.session.create({ data: { ...input, facilitatorId: actor.id }, include });
}

export async function update(actor: AuthenticatedUser, id: string, input: z.infer<typeof updateSessionSchema>) {
  const existing = await prisma.session.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Session not found.');
  assertOwnerOrAdmin(actor, existing.facilitatorId);

  return prisma.session.update({ where: { id }, data: input, include });
}

export async function softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
  const existing = await prisma.session.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Session not found.');
  assertOwnerOrAdmin(actor, existing.facilitatorId);

  await prisma.session.update({ where: { id }, data: { deletedAt: new Date() } });
}
