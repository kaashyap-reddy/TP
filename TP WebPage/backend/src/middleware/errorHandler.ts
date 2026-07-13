import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { reportError } from '../utils/monitoring';

// Only route + method identify the request — never log headers/cookies/body, which may carry
// Authorization bearer tokens, refresh-token cookies, or user-submitted secrets.
function requestContext(req: Request) {
  return { method: req.method, path: req.path, userId: req.user?.id };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.statusCode === 401) logger.warn('auth.failure', { ...requestContext(req), status: 401 });
    else if (err.statusCode === 403) logger.warn('auth.permission_denied', { ...requestContext(req), status: 403 });
    else if (err.statusCode === 423) logger.warn('auth.account_locked', requestContext(req));
    res.status(err.statusCode).json({ message: err.message, details: err.details });
    return;
  }

  if (err instanceof MulterError) {
    logger.warn('upload.rejected', { ...requestContext(req), code: err.code });
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : err.message || 'File upload rejected.';
    res.status(400).json({ message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'A record with this value already exists.', details: err.meta });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Record not found.' });
      return;
    }
  }

  const isDbFailure = err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientKnownRequestError;
  logger.error(isDbFailure ? 'database.failure' : 'server.error', {
    ...requestContext(req),
    message: err instanceof Error ? err.message : String(err)
  });
  reportError(err, requestContext(req));

  if (isDbFailure) {
    // Connection strings/hostnames live in this error's message ("Can't reach database server
    // at `<host>:<port>`") — real infrastructure detail, not something worth showing a
    // developer over showing anyone else. Full detail is already in the log line above.
    res.status(503).json({ message: "We're having trouble connecting to the database. Please try again shortly." });
    return;
  }

  const message = !config.isProduction && err instanceof Error ? err.message : 'Internal server error.';
  res.status(500).json({ message });
}
