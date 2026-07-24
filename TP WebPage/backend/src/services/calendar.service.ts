import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { listCalendarQuerySchema } from '../validators/calendar.validator';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'session' | 'assignment-deadline';
  start: string;
  end: string | null;
  batchIds: string[];
  batchNames: string[];
  relatedEntityId: string;
  status: string;
  metadata: Record<string, unknown>;
}

/**
 * Resolves which batches the caller may see events for — one query, not one per role branch's
 * downstream use. `null` means "no restriction" (admin, unfiltered); an empty array means the
 * caller can see nothing (e.g. a trainee in zero batches) and callers should short-circuit.
 */
async function resolveScopedBatchIds(actor: AuthenticatedUser, requestedBatchId?: string): Promise<string[] | null> {
  if (actor.role === 'admin') {
    return requestedBatchId ? [requestedBatchId] : null;
  }
  if (actor.role === 'facilitator') {
    const [ownedBatches, teamAssignments] = await Promise.all([
      prisma.batch.findMany({
        where: { facilitatorId: actor.id, deletedAt: null, ...(requestedBatchId ? { id: requestedBatchId } : {}) },
        select: { id: true }
      }),
      prisma.batchFacilitator.findMany({
        where: { facilitatorId: actor.id, status: { not: 'Removed' }, ...(requestedBatchId ? { batchId: requestedBatchId } : {}) },
        select: { batchId: true }
      })
    ]);
    return [...new Set([...ownedBatches.map((b) => b.id), ...teamAssignments.map((a) => a.batchId)])];
  }
  const enrollments = await prisma.batchTrainee.findMany({
    where: { traineeId: actor.id, removedAt: null, ...(requestedBatchId ? { batchId: requestedBatchId } : {}) },
    select: { batchId: true }
  });
  return enrollments.map((e) => e.batchId);
}

/**
 * Returns normalized calendar events (sessions + assignment deadlines) in a fixed, small number
 * of queries — not one request per assignment/session — scoped to whatever batches the caller
 * may see (all of them for admin, managed batches for a facilitator, enrolled batches for a
 * trainee).
 */
export async function getEvents(actor: AuthenticatedUser, query: z.infer<typeof listCalendarQuerySchema>): Promise<CalendarEvent[]> {
  const batchIds = await resolveScopedBatchIds(actor, query.batchId);
  if (batchIds !== null && batchIds.length === 0) return [];

  const includeSessions = query.type === 'all' || query.type === 'session';
  const includeAssignments = query.type === 'all' || query.type === 'assignment-deadline';

  const [sessions, assignments] = await Promise.all([
    includeSessions
      ? prisma.session.findMany({
          where: { deletedAt: null, ...(batchIds ? { batchId: { in: batchIds } } : {}) },
          include: { batch: { select: { id: true, name: true } }, facilitator: { select: { id: true, name: true } } }
        })
      : Promise.resolve([]),
    includeAssignments
      ? prisma.assignment.findMany({
          where: { deletedAt: null, ...(batchIds ? { batches: { some: { batchId: { in: batchIds } } } } : {}) },
          include: {
            batches: { include: { batch: { select: { id: true, name: true } } } },
            facilitator: { select: { id: true, name: true } }
          }
        })
      : Promise.resolve([])
  ]);

  const sessionEvents: CalendarEvent[] = sessions.map((s) => ({
    id: `session-${s.id}`,
    title: s.title,
    type: 'session',
    start: s.scheduledAt.toISOString(),
    end: null,
    batchIds: [s.batch.id],
    batchNames: [s.batch.name],
    relatedEntityId: s.id,
    status: s.status,
    metadata: { platform: s.platform, meetingLink: s.meetingLink, facilitatorName: s.facilitator?.name ?? null }
  }));

  const assignmentEvents: CalendarEvent[] = assignments.map((a) => ({
    id: `assignment-${a.id}`,
    title: a.title,
    type: 'assignment-deadline',
    start: a.deadline.toISOString(),
    end: null,
    batchIds: a.batches.map((b) => b.batch.id),
    batchNames: a.batches.map((b) => b.batch.name),
    relatedEntityId: a.id,
    status: a.status,
    metadata: { facilitatorName: a.facilitator?.name ?? null }
  }));

  return [...sessionEvents, ...assignmentEvents].sort((x, y) => x.start.localeCompare(y.start));
}
