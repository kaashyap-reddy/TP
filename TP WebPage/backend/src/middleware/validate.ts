import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

interface ValidationSchemas {
  // ZodTypeAny (not AnyZodObject) so schemas built with .refine() (e.g. cross-field time-range
  // checks) — which return ZodEffects, not ZodObject — can still be passed here.
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as unknown as Request['query'];
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as unknown as Request['params'];
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(ApiError.badRequest('Validation failed.', err.flatten().fieldErrors));
        return;
      }
      next(err);
    }
  };
}
