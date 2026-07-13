import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';
import { AppRole } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { buildPaginatedResponse, getPagination } from '../utils/pagination';
import { z } from 'zod';
import { listUsersQuerySchema, updateSelfSchema, updateUserByAdminSchema } from '../validators/users.validator';

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
          avatarStorageKey: user.profile.avatarStorageKey
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
