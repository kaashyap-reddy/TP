import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { getStorageProvider } from './storage';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { createResourceSchema, listResourcesQuerySchema, updateResourceSchema } from '../validators/resources.validator';

const include = {
  uploader: { select: { id: true, name: true, email: true } },
  batch: { select: { id: true, name: true, code: true } }
} satisfies Prisma.ResourceInclude;

function assertOwnerOrAdmin(actor: AuthenticatedUser, uploadedBy: string) {
  if (actor.role === 'admin') return;
  if (actor.role === 'facilitator' && actor.id === uploadedBy) return;
  throw ApiError.forbidden('You do not own this resource.');
}

function serialize(resource: Prisma.ResourceGetPayload<{ include: typeof include }>) {
  return { ...resource, sizeBytes: resource.sizeBytes.toString() };
}

export async function list(query: z.infer<typeof listResourcesQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.ResourceWhereInput = {
    deletedAt: null,
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.verified !== undefined ? { verified: query.verified } : {}),
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {})
  };

  const [resources, total] = await prisma.$transaction([
    prisma.resource.findMany({ where, include, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.resource.count({ where })
  ]);

  return buildPaginatedResponse(resources.map(serialize), total, page, pageSize);
}

export async function getById(id: string) {
  const resource = await prisma.resource.findFirst({ where: { id, deletedAt: null }, include });
  if (!resource) throw ApiError.notFound('Resource not found.');
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

export async function getForDownload(id: string) {
  const resource = await prisma.resource.findFirst({ where: { id, deletedAt: null } });
  if (!resource) throw ApiError.notFound('Resource not found.');

  await prisma.resource.update({ where: { id }, data: { downloadCount: { increment: 1 } } });

  return resource;
}
