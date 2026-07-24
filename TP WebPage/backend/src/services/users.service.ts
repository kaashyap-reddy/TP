import fs from 'fs';
import { Prisma } from '@prisma/client';
import { imageSize } from 'image-size';
import { prisma } from '../prisma/client';
import { getStorageProvider } from './storage';
import { AppRole } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { z } from 'zod';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_DIMENSION_PX,
  listUsersQuerySchema,
  updateSelfSchema,
  updateUserByAdminSchema
} from '../validators/users.validator';

const include = { role: true, profile: true } satisfies Prisma.UserInclude;

function toDto(user: Prisma.UserGetPayload<{ include: typeof include }>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name as AppRole,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    profile: user.profile
      ? {
          phone: user.profile.phone,
          location: user.profile.location,
          company: user.profile.company,
          department: user.profile.department,
          idNumber: user.profile.idNumber,
          avatarStorageKey: user.profile.avatarStorageKey,
          avatarUpdatedAt: user.profile.avatarUpdatedAt
        }
      : null
  };
}

export async function list(query: z.infer<typeof listUsersQuerySchema>) {
  const { skip, take, page, pageSize } = getPagination(query);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role ? { role: { name: query.role } } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, include, skip, take, orderBy: { [query.sortBy]: query.sortOrder } }),
    prisma.user.count({ where })
  ]);

  return buildPaginatedResponse(users.map(toDto), total, page, pageSize);
}

export async function getById(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, include });
  if (!user) throw ApiError.notFound('User not found.');
  return toDto(user);
}

export async function updateSelf(id: string, input: z.infer<typeof updateSelfSchema>) {
  const { phone, location, ...userFields } = input;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userFields).length > 0) {
      await tx.user.update({ where: { id }, data: userFields });
    }
    if (phone !== undefined || location !== undefined) {
      await tx.userProfile.upsert({
        where: { userId: id },
        create: { userId: id, phone, location },
        update: { phone, location }
      });
    }
  });

  return getById(id);
}

export async function updateByAdmin(id: string, input: z.infer<typeof updateUserByAdminSchema>) {
  const { phone, location, company, department, idNumber, role, ...userFields } = input;

  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('User not found.');

  await prisma.$transaction(async (tx) => {
    const data: Prisma.UserUpdateInput = { ...userFields };
    if (role) {
      const roleRow = await tx.role.findUnique({ where: { name: role } });
      if (!roleRow) throw ApiError.badRequest('Unknown role.');
      data.role = { connect: { id: roleRow.id } };
    }
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id }, data });
    }

    const profileFields = { phone, location, company, department, idNumber };
    if (Object.values(profileFields).some((v) => v !== undefined)) {
      await tx.userProfile.upsert({
        where: { userId: id },
        create: { userId: id, ...profileFields },
        update: profileFields
      });
    }
  });

  return getById(id);
}

export async function softDelete(id: string): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('User not found.');

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);
}

function readFileBytes(file: Express.Multer.File): Buffer {
  // multer gives a Buffer on memoryStorage (cloud providers) or writes straight to disk (local
  // provider) — dimension validation needs the bytes either way, see middleware/upload.ts.
  return file.buffer ?? fs.readFileSync(file.path);
}

export async function uploadAvatar(userId: string, file: Express.Multer.File) {
  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof AVATAR_ALLOWED_MIME_TYPES)[number])) {
    throw ApiError.badRequest('Avatar must be a JPG or PNG image.');
  }

  const { width, height } = imageSize(readFileBytes(file));
  if (width > AVATAR_MAX_DIMENSION_PX || height > AVATAR_MAX_DIMENSION_PX) {
    throw ApiError.badRequest(`Avatar image is too large (max ${AVATAR_MAX_DIMENSION_PX}x${AVATAR_MAX_DIMENSION_PX}px).`);
  }

  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  const storageKey = await getStorageProvider().save(file, 'avatars');

  try {
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, avatarStorageKey: storageKey, avatarMimeType: file.mimetype, avatarSizeBytes: file.size, avatarUpdatedAt: new Date() },
      update: { avatarStorageKey: storageKey, avatarMimeType: file.mimetype, avatarSizeBytes: file.size, avatarUpdatedAt: new Date() }
    });
  } catch (err) {
    await getStorageProvider().remove(storageKey);
    throw err;
  }

  if (existing?.avatarStorageKey) {
    await getStorageProvider().remove(existing.avatarStorageKey);
  }

  return getById(userId);
}

export async function removeAvatar(userId: string) {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing?.avatarStorageKey) {
    await getStorageProvider().remove(existing.avatarStorageKey);
  }

  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, avatarStorageKey: null, avatarMimeType: null, avatarSizeBytes: null, avatarUpdatedAt: null },
    update: { avatarStorageKey: null, avatarMimeType: null, avatarSizeBytes: null, avatarUpdatedAt: null }
  });

  return getById(userId);
}

export async function getAvatarForStreaming(userId: string): Promise<{ storageKey: string; mimeType: string }> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile?.avatarStorageKey) throw ApiError.notFound('No avatar uploaded.');
  return { storageKey: profile.avatarStorageKey, mimeType: profile.avatarMimeType ?? 'image/jpeg' };
}
