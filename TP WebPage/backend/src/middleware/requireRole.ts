import { NextFunction, Request, Response } from 'express';
import { AppRole } from '../types/auth';
import { ApiError } from '../utils/ApiError';

/** Must run after requireAuth. */
export function requireRole(...roles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden('You do not have access to this resource.'));
      return;
    }
    next();
  };
}

/** Must run after requireAuth. Checks the caller's role-derived permission set. */
export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    const hasAll = permissions.every((permission) => req.user!.permissions.includes(permission));
    if (!hasAll) {
      next(ApiError.forbidden('You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}
