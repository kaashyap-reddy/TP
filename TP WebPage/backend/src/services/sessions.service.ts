import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { createSessionSchema, listSessionsQuerySchema, updateSessionSchema } from '../validators/sessions.validator';
import { isOnBatchTeam } from './facilitatorAssignments.service';

const include = {
  facilitator: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } },
  relatedAssignments: { select: { id: true, title: true } },
  feedbackForm: {
    select: { id: true, name: true, description: true, formUrl: true, audience: true, _count: { select: { submissions: true } } }
  }
} satisfies Prisma.SessionInclude;

// facilitatorId is nullable — a session generated from a Training Plan template often has no
// Trainer assigned yet. A null facilitatorId can never match an actor, so only admin can manage
// an unowned session; once a trainer is set, that facilitator (or admin) can. Also passes for any
// facilitator who is an active member of the session's batch team (not just its primary
// coordinator) -- shared with sessionFeedback.service.ts and attendance.service.ts, which import
// this same function, so widening it here widens theirs too.
export async function assertOwnerOrAdmin(actor: AuthenticatedUser, facilitatorId: string | null, batchId: string) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === facilitatorId) return;
  if (actor.role === 'facilitator' && (await isOnBatchTeam(actor.id, batchId))) return;
  throw ApiError.forbidden('You do not own this session.');
}

// A session's bulk/detail response embeds its feedback form, but that embed shouldn't leak a
// form scoped to the other role — e.g. a Facilitators-only form showing up (and being usable) on
// a trainee's calendar. Admin and the session's owning facilitator always see it (they manage
// it); everyone else only sees it if the form's audience actually includes their role. Mirrors
// the same rule in sessionFeedback.service.ts's getForSession().
async function withFeedbackFormVisibility<T extends { facilitatorId: string | null; feedbackForm: { audience: string } | null; batchId: string }>(
  actor: AuthenticatedUser,
  session: T
): Promise<T> {
  if (!session.feedbackForm) return session;
  const isManager =
    actor.role === 'admin' ||
    (actor.role === 'facilitator' && (actor.id === session.facilitatorId || (await isOnBatchTeam(actor.id, session.batchId))));
  if (isManager) return session;
  if (actor.role === 'trainee' && session.feedbackForm.audience === 'Facilitators') return { ...session, feedbackForm: null };
  if (actor.role === 'facilitator' && session.feedbackForm.audience === 'Trainees') return { ...session, feedbackForm: null };
  return session;
}

export async function list(actor: AuthenticatedUser, query: z.infer<typeof listSessionsQuerySchema>) {
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

  const visible = await Promise.all(sessions.map((s) => withFeedbackFormVisibility(actor, s)));
  return buildPaginatedResponse(visible, total, page, pageSize);
}

export async function getById(actor: AuthenticatedUser, id: string) {
  const session = await prisma.session.findFirst({ where: { id, deletedAt: null }, include });
  if (!session) throw ApiError.notFound('Session not found.');
  return withFeedbackFormVisibility(actor, session);
}

export async function create(actor: AuthenticatedUser, input: z.infer<typeof createSessionSchema>) {
  const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
  if (!batch) throw ApiError.badRequest('No such batch.');

  return prisma.session.create({ data: { ...input, facilitatorId: actor.id }, include });
}

async function assertFacilitatorUser(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.badRequest('No such user.');
  if (user.role.name !== 'facilitator') throw ApiError.badRequest('User is not a facilitator.');
}

export async function update(actor: AuthenticatedUser, id: string, input: z.infer<typeof updateSessionSchema>) {
  const existing = await prisma.session.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Session not found.');
  await assertOwnerOrAdmin(actor, existing.facilitatorId, existing.batchId);

  if (input.facilitatorId) await assertFacilitatorUser(input.facilitatorId);

  return prisma.session.update({ where: { id }, data: input, include });
}

export async function softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
  const existing = await prisma.session.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Session not found.');
  await assertOwnerOrAdmin(actor, existing.facilitatorId, existing.batchId);

  await prisma.session.update({ where: { id }, data: { deletedAt: new Date() } });
}
