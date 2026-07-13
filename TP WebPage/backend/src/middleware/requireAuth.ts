import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { AppRole } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid Authorization header.');
  }
  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Access token is invalid or expired.');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: { include: { permission: true } } } } }
  });

  if (!user || user.deletedAt || !user.isActive) {
    throw ApiError.unauthorized('Account is no longer active.');
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role.name as AppRole,
    permissions: user.role.permissions.map((rolePermission) => rolePermission.permission.key)
  };

  next();
});
