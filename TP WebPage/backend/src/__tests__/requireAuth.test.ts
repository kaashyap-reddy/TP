import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../config';

vi.mock('../prisma/client', () => ({
  prisma: { user: { findUnique: vi.fn() } }
}));

function fakeReq(header?: string): Request {
  return { headers: { authorization: header } } as unknown as Request;
}

describe('requireAuth', () => {
  it('rejects a missing Authorization header', async () => {
    const { requireAuth } = await import('../middleware/requireAuth');
    const next = vi.fn();
    await requireAuth(fakeReq(undefined), {} as Response, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('rejects a header that is not a Bearer token', async () => {
    const { requireAuth } = await import('../middleware/requireAuth');
    const next = vi.fn();
    await requireAuth(fakeReq('Basic somevalue'), {} as Response, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('rejects a garbage/invalid JWT', async () => {
    const { requireAuth } = await import('../middleware/requireAuth');
    const next = vi.fn();
    await requireAuth(fakeReq('Bearer not-a-real-token'), {} as Response, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    // Sign one that's already expired instead of waiting for TTL to elapse.
    const expired = jwt.sign({ sub: 'user-1', email: 'a@a.com', role: 'trainee' }, config.jwt.accessSecret, {
      expiresIn: -10
    });

    const { requireAuth } = await import('../middleware/requireAuth');
    const next = vi.fn();
    await requireAuth(fakeReq(`Bearer ${expired}`), {} as Response, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});
