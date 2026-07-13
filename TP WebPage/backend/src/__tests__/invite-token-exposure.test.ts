import { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createInvite = vi.fn();
vi.mock('../services/auth.service', () => ({ createInvite: (...args: unknown[]) => createInvite(...args) }));
vi.mock('../services/audit', () => ({ recordAuditEvent: vi.fn().mockResolvedValue(undefined) }));

function fakeReqRes() {
  let resolveDone: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const req = { user: { id: 'admin-1' }, body: { email: 'new@x.com', role: 'trainee' } } as unknown as Request;
  const jsonBody = { current: undefined as unknown };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn((body: unknown) => {
      jsonBody.current = body;
      resolveDone();
    })
  } as unknown as Response;
  return { req, res, done, jsonBody };
}

describe('invite token exposure', () => {
  beforeEach(() => {
    vi.resetModules();
    createInvite.mockReset();
    createInvite.mockResolvedValue({ email: 'new@x.com', expiresAt: new Date('2026-01-01'), token: 'super-secret-raw-token' });
  });

  afterEach(() => {
    vi.doUnmock('../config');
  });

  it('omits the token from the response when exposeAuthTokens is false (production default)', async () => {
    vi.doMock('../config', () => ({ config: { exposeAuthTokens: false } }));
    const { createInviteHandler } = await import('../controllers/auth.controller');
    const { req, res, done, jsonBody } = fakeReqRes();

    await createInviteHandler(req, res, vi.fn());
    await done;

    expect(JSON.stringify(jsonBody.current)).not.toContain('super-secret-raw-token');
    expect((jsonBody.current as { token?: string }).token).toBeUndefined();
    expect((jsonBody.current as { email: string }).email).toBe('new@x.com');
  });

  it('includes the token when exposeAuthTokens is true (dev/test)', async () => {
    vi.doMock('../config', () => ({ config: { exposeAuthTokens: true } }));
    const { createInviteHandler } = await import('../controllers/auth.controller');
    const { req, res, done, jsonBody } = fakeReqRes();

    await createInviteHandler(req, res, vi.fn());
    await done;

    expect((jsonBody.current as { token?: string }).token).toBe('super-secret-raw-token');
  });
});
