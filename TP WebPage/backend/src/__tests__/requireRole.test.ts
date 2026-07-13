import { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requirePermission, requireRole } from '../middleware/requireRole';
import { ApiError } from '../utils/ApiError';

function fakeReq(user?: { role: string; permissions: string[] }): Request {
  return { user } as unknown as Request;
}

describe('requireRole', () => {
  it('calls next() with a 401 when there is no authenticated user', () => {
    const next = vi.fn();
    requireRole('admin')(fakeReq(undefined), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect((next.mock.calls[0][0] as ApiError).statusCode).toBe(401);
  });

  it('calls next() with a 403 when the role does not match', () => {
    const next = vi.fn();
    requireRole('admin')(fakeReq({ role: 'trainee', permissions: [] }) as never, {} as Response, next);
    expect((next.mock.calls[0][0] as ApiError).statusCode).toBe(403);
  });

  it('calls next() with no error when the role matches', () => {
    const next = vi.fn();
    requireRole('admin', 'facilitator')(fakeReq({ role: 'facilitator', permissions: [] }) as never, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requirePermission', () => {
  it('rejects when a required permission is missing', () => {
    const next = vi.fn();
    requirePermission('manage_users')(fakeReq({ role: 'facilitator', permissions: ['view_trainees'] }) as never, {} as Response, next);
    expect((next.mock.calls[0][0] as ApiError).statusCode).toBe(403);
  });

  it('passes when all required permissions are present', () => {
    const next = vi.fn();
    requirePermission('view_trainees')(fakeReq({ role: 'facilitator', permissions: ['view_trainees', 'manage_sessions'] }) as never, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
