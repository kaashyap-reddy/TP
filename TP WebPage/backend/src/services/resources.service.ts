import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { getStorageProvider } from './storage';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { isOnBatchTeam } from './facilitatorAssignments.service';
import { createResourceSchema, listResourcesQuerySchema, updateResourceSchema } from '../validators/resources.validator';

const include = {
  uploader: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } }
} satisfies Prisma.ResourceInclude;

// This is deliberately NOT widened to team-membership — it gates who may edit/delete a
// specific uploaded file, a different policy question ("who personally uploaded this") than
// "who's on the batch team," unlike the read-side check below. See Stage 6 plan notes.
function assertOwnerOrAdmin(actor: AuthenticatedUser, uploadedBy: string) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === uploadedBy) return;
  throw ApiError.forbidden('You do not own this resource.');
}

/** Batches a facilitator owns (denormalized POC cache) or is an active team member of. */
async function accessibleBatchIdsForFacilitator(facilitatorId: string): Promise<string[]> {
  const [ownedBatches, teamAssignments] = await Promise.all([
    prisma.batch.findMany({ where: { facilitatorId, deletedAt: null }, select: { id: true } }),
    prisma.batchFacilitator.findMany({ where: { facilitatorId, status: { not: 'Removed' } }, select: { batchId: true } })
  ]);
  return [...new Set([...ownedBatches.map((b) => b.id), ...teamAssignments.map((a) => a.batchId)])];
}

/** Read-side access: a global resource (batchId null) is visible to everyone; a batch-scoped one
 * requires the facilitator to own/team-member the batch, or the trainee to be enrolled in it. */
async function assertReadAccess(actor: AuthenticatedUser, batchId: string | null): Promise<void> {
  if (actor.role === 'admin' || batchId === null) return;
  if (actor.role === 'facilitator') {
    const batch = await prisma.batch.findFirst({ where: { id: batchId } });
    if (batch?.facilitatorId === actor.id) return;
    if (await isOnBatchTeam(actor.id, batchId)) return;
    throw ApiError.forbidden('You do not have access to this resource.');
  }
  const enrollment = await prisma.batchTrainee.findUnique({ where: { batchId_traineeId: { batchId, traineeId: actor.id } } });
  if (!enrollment || enrollment.removedAt) throw ApiError.forbidden('You do not have access to this resource.');
}

function serialize(resource: Prisma.ResourceGetPayload<{ include: typeof include }>) {
  return { ...resource, sizeBytes: resource.sizeBytes?.toString() ?? null };
}

export async function list(actor: AuthenticatedUser, query: z.infer<typeof listResourcesQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.ResourceWhereInput = {
    deletedAt: null,
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.verified !== undefined ? { verified: query.verified } : {}),
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {})
  };

  // Previously unscoped — any authenticated user could list every resource system-wide. A global
  // resource (batchId null) stays visible to everyone; a batch-scoped one is restricted to a
  // facilitator's own/team batches, or a trainee's enrolled batches.
  if (actor.role !== 'admin') {
    const accessibleBatchIds =
      actor.role === 'facilitator'
        ? await accessibleBatchIdsForFacilitator(actor.id)
        : (await prisma.batchTrainee.findMany({ where: { traineeId: actor.id, removedAt: null }, select: { batchId: true } })).map(
            (e) => e.batchId
          );

    if (query.batchId) {
      if (!accessibleBatchIds.includes(query.batchId)) throw ApiError.forbidden('You do not have access to this batch.');
    } else {
      where.OR = [{ batchId: null }, { batchId: { in: accessibleBatchIds } }];
    }
  }

  const [resources, total] = await prisma.$transaction([
    prisma.resource.findMany({ where, include, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.resource.count({ where })
  ]);

  return buildPaginatedResponse(resources.map(serialize), total, page, pageSize);
}

export async function getById(actor: AuthenticatedUser, id: string) {
  const resource = await prisma.resource.findFirst({ where: { id, deletedAt: null }, include });
  if (!resource) throw ApiError.notFound('Resource not found.');
  await assertReadAccess(actor, resource.batchId);
  return serialize(resource);
}

export async function create(actor: AuthenticatedUser, input: z.infer<typeof createResourceSchema>, file: Express.Multer.File) {
  if (input.batchId) {
    const batch = await prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
    if (!batch) throw ApiError.badRequest('No such batch.');
  }

  const storageKey = await getStorageProvider().save(file, 'resources');

  try {
    const resource = await prisma.resource.create({
      data: {
        ...input,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        uploadedBy: actor.id
      },
      include
    });

    return serialize(resource);
  } catch (err) {
    // The file already landed in storage before the DB write failed — don't leave it orphaned.
    await getStorageProvider().remove(storageKey);
    throw err;
  }
}

export async function update(actor: AuthenticatedUser, id: string, input: z.infer<typeof updateResourceSchema>) {
  const existing = await prisma.resource.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Resource not found.');
  assertOwnerOrAdmin(actor, existing.uploadedBy);

  const resource = await prisma.resource.update({ where: { id }, data: input, include });
  return serialize(resource);
}

export async function softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
  const existing = await prisma.resource.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Resource not found.');
  assertOwnerOrAdmin(actor, existing.uploadedBy);

  await prisma.resource.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function getForDownload(actor: AuthenticatedUser, id: string) {
  const resource = await prisma.resource.findFirst({ where: { id, deletedAt: null } });
  if (!resource) throw ApiError.notFound('Resource not found.');
  await assertReadAccess(actor, resource.batchId);

  await prisma.resource.update({ where: { id }, data: { downloadCount: { increment: 1 } } });

  return resource;
}
