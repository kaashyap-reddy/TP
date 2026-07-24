import {
  FacilitatorAssignmentStatus as PrismaFacilitatorAssignmentStatus,
  FacilitatorRole as PrismaFacilitatorRole,
  Prisma
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import {
  createFacilitatorAssignmentSchema,
  listFacilitatorAssignmentsQuerySchema,
  updateFacilitatorAssignmentSchema
} from '../validators/facilitatorAssignments.validator';

// The API wire contract (frontend/src/types/facilitatorAssignment.ts) uses human-readable display
// strings for role/status, matching what Demo Mode already sends. Prisma's generated enum members
// use PascalCase names instead -- the display strings only exist as each member's @map'd DB value
// and are invisible to the generated TS types -- so both directions need an explicit table.
const ROLE_TO_PRISMA: Record<string, PrismaFacilitatorRole> = {
  'Primary Coordinator': PrismaFacilitatorRole.PrimaryCoordinator,
  'Lead Facilitator': PrismaFacilitatorRole.LeadFacilitator,
  Trainer: PrismaFacilitatorRole.Trainer,
  'Guest Trainer': PrismaFacilitatorRole.GuestTrainer,
  'Assignment Reviewer': PrismaFacilitatorRole.AssignmentReviewer,
  'Backup Facilitator': PrismaFacilitatorRole.BackupFacilitator
};
const ROLE_FROM_PRISMA = Object.fromEntries(Object.entries(ROLE_TO_PRISMA).map(([wire, value]) => [value, wire])) as Record<
  PrismaFacilitatorRole,
  string
>;

const STATUS_TO_PRISMA: Record<string, PrismaFacilitatorAssignmentStatus> = {
  Active: PrismaFacilitatorAssignmentStatus.Active,
  Upcoming: PrismaFacilitatorAssignmentStatus.Upcoming,
  'Temporarily Unavailable': PrismaFacilitatorAssignmentStatus.TemporarilyUnavailable,
  Completed: PrismaFacilitatorAssignmentStatus.Completed,
  Removed: PrismaFacilitatorAssignmentStatus.Removed
};
const STATUS_FROM_PRISMA = Object.fromEntries(Object.entries(STATUS_TO_PRISMA).map(([wire, value]) => [value, wire])) as Record<
  PrismaFacilitatorAssignmentStatus,
  string
>;

const include = {
  facilitator: { select: { id: true, name: true, email: true } },
  assignedByUser: { select: { name: true } }
} satisfies Prisma.BatchFacilitatorInclude;

type RowWithRelations = Prisma.BatchFacilitatorGetPayload<{ include: typeof include }>;

async function toDto(row: RowWithRelations) {
  const [sessionCount, upcomingSessionCount] = await Promise.all([
    prisma.session.count({ where: { batchId: row.batchId, facilitatorId: row.facilitatorId } }),
    prisma.session.count({ where: { batchId: row.batchId, facilitatorId: row.facilitatorId, scheduledAt: { gt: new Date() } } })
  ]);

  return {
    id: row.id,
    batchId: row.batchId,
    facilitatorId: row.facilitatorId,
    facilitatorName: row.facilitator.name,
    facilitatorEmail: row.facilitator.email,
    role: ROLE_FROM_PRISMA[row.role],
    isPrimaryCoordinator: row.isPrimaryCoordinator,
    status: STATUS_FROM_PRISMA[row.status],
    assignedAt: row.assignedAt,
    // The frontend type carries a display name here, not an id -- see Stage 5 plan.
    assignedBy: row.assignedByUser?.name ?? null,
    sessionCount,
    upcomingSessionCount,
    notes: row.notes
  };
}

/** Used by batches/sessions/assignments services to widen single-facilitatorId access checks to
 * "is this actor an active member of the batch's facilitator team." */
export async function isOnBatchTeam(actorId: string, batchId: string): Promise<boolean> {
  const row = await prisma.batchFacilitator.findFirst({ where: { batchId, facilitatorId: actorId, status: { not: 'Removed' } } });
  return !!row;
}

/** Same as isOnBatchTeam, but for actions scoped to any of several batches at once (e.g. a
 * multi-batch assignment) -- true if the actor is an active team member of at least one. */
export async function isOnAnyBatchTeam(actorId: string, batchIds: string[]): Promise<boolean> {
  if (batchIds.length === 0) return false;
  const row = await prisma.batchFacilitator.findFirst({
    where: { facilitatorId: actorId, batchId: { in: batchIds }, status: { not: 'Removed' } }
  });
  return !!row;
}

async function assertFacilitatorUser(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.badRequest('No such user.');
  if (user.role.name !== 'facilitator') throw ApiError.badRequest('User is not a facilitator.');
}

/** Keeps Batch.facilitatorId in sync with whichever assignment (if any) currently holds
 * isPrimaryCoordinator for that batch -- the one place that denormalized cache gets written from
 * this table, so every existing single-facilitator check elsewhere keeps working unchanged. */
async function syncBatchPrimaryCoordinator(tx: Prisma.TransactionClient, batchId: string): Promise<void> {
  const primary = await tx.batchFacilitator.findFirst({ where: { batchId, isPrimaryCoordinator: true, status: { not: 'Removed' } } });
  await tx.batch.update({ where: { id: batchId }, data: { facilitatorId: primary?.facilitatorId ?? null } });
}

export async function list(query: z.infer<typeof listFacilitatorAssignmentsQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);
  const where: Prisma.BatchFacilitatorWhereInput = {
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.facilitatorId ? { facilitatorId: query.facilitatorId } : {})
  };

  const [rows, total] = await prisma.$transaction([
    prisma.batchFacilitator.findMany({ where, include, skip, take, orderBy: { assignedAt: 'desc' } }),
    prisma.batchFacilitator.count({ where })
  ]);

  const data = await Promise.all(rows.map(toDto));
  return buildPaginatedResponse(data, total, page, pageSize);
}

export async function create(actorId: string, input: z.infer<typeof createFacilitatorAssignmentSchema>) {
  const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
  if (!batch) throw ApiError.badRequest('No such batch.');
  await assertFacilitatorUser(input.facilitatorId);

  const existing = await prisma.batchFacilitator.findFirst({
    where: { batchId: input.batchId, facilitatorId: input.facilitatorId, status: { not: 'Removed' } }
  });
  if (existing) throw ApiError.conflict('This facilitator is already on the batch\'s team.');

  const row = await prisma.batchFacilitator.create({
    data: {
      batchId: input.batchId,
      facilitatorId: input.facilitatorId,
      role: ROLE_TO_PRISMA[input.role],
      notes: input.notes ?? null,
      assignedBy: actorId
    },
    include
  });
  return toDto(row);
}

export async function update(id: string, input: z.infer<typeof updateFacilitatorAssignmentSchema>) {
  const existing = await prisma.batchFacilitator.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Assignment not found.');

  const data: Prisma.BatchFacilitatorUpdateInput = {
    ...(input.role !== undefined ? { role: ROLE_TO_PRISMA[input.role] } : {}),
    ...(input.status !== undefined ? { status: STATUS_TO_PRISMA[input.status] } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {})
  };

  const row = await prisma.batchFacilitator.update({ where: { id }, data, include });
  return toDto(row);
}

export async function setPrimary(id: string) {
  const target = await prisma.batchFacilitator.findUnique({ where: { id } });
  if (!target) throw ApiError.notFound('Assignment not found.');
  if (target.status === 'Removed') throw ApiError.badRequest('Cannot make a removed assignment the primary coordinator.');

  await prisma.$transaction(async (tx) => {
    const currentPrimary = await tx.batchFacilitator.findFirst({
      where: { batchId: target.batchId, isPrimaryCoordinator: true, status: { not: 'Removed' } }
    });
    if (currentPrimary && currentPrimary.id !== target.id) {
      await tx.batchFacilitator.update({
        where: { id: currentPrimary.id },
        data: { isPrimaryCoordinator: false, role: 'LeadFacilitator' }
      });
    }
    await tx.batchFacilitator.update({ where: { id: target.id }, data: { isPrimaryCoordinator: true, role: 'PrimaryCoordinator' } });
    await syncBatchPrimaryCoordinator(tx, target.batchId);
  });

  const updated = await prisma.batchFacilitator.findUniqueOrThrow({ where: { id }, include });
  return toDto(updated);
}

export async function remove(id: string): Promise<void> {
  const existing = await prisma.batchFacilitator.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Assignment not found.');

  await prisma.$transaction(async (tx) => {
    await tx.batchFacilitator.update({ where: { id }, data: { status: 'Removed', isPrimaryCoordinator: false } });
    if (existing.isPrimaryCoordinator) {
      // No auto-promotion of a replacement -- an admin must explicitly call setPrimary next,
      // matching the Demo Mode reference this mirrors.
      await syncBatchPrimaryCoordinator(tx, existing.batchId);
    }
  });
}
