import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '../utils/hash';
import { signRefreshToken } from '../utils/jwt';

const refreshTokenFindUnique = vi.fn();
const refreshTokenUpdate = vi.fn();
const refreshTokenCreate = vi.fn();
const userFindUnique = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    refreshToken: {
      findUnique: (...args: unknown[]) => refreshTokenFindUnique(...args),
      update: (...args: unknown[]) => refreshTokenUpdate(...args),
      create: (...args: unknown[]) => refreshTokenCreate(...args)
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args)
    }
  }
}));

const tokenId = 'refresh-row-1';
const rawToken = signRefreshToken({ sub: 'user-1', tokenId }, 3600);

const storedRow = {
  id: tokenId,
  userId: 'user-1',
  tokenHash: sha256(rawToken),
  rememberMe: false,
  expiresAt: new Date(Date.now() + 3600_000),
  revokedAt: null as Date | null
};

const activeUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  isActive: true,
  deletedAt: null as Date | null,
  role: { name: 'trainee', permissions: [] },
  profile: null
};

describe('auth.service refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshTokenUpdate.mockResolvedValue({});
    refreshTokenCreate.mockResolvedValue({});
  });

  it('rejects a missing token', async () => {
    const { refresh } = await import('../services/auth.service');
    const err = await refresh(undefined).catch((e) => e);
    expect(err.statusCode).toBe(401);
  });

  it('rejects a syntactically invalid token', async () => {
    const { refresh } = await import('../services/auth.service');
    const err = await refresh('not-a-real-jwt').catch((e) => e);
    expect(err.statusCode).toBe(401);
  });

  it('rejects a token whose DB row was already revoked', async () => {
    refreshTokenFindUnique.mockResolvedValueOnce({ ...storedRow, revokedAt: new Date() });
    const { refresh } = await import('../services/auth.service');
    const err = await refresh(rawToken).catch((e) => e);
    expect(err.statusCode).toBe(401);
  });

  it('rejects a token with no matching DB row (e.g. logged out elsewhere)', async () => {
    refreshTokenFindUnique.mockResolvedValueOnce(null);
    const { refresh } = await import('../services/auth.service');
    const err = await refresh(rawToken).catch((e) => e);
    expect(err.statusCode).toBe(401);
  });

  it('rotates a valid token: revokes the old row and issues a new pair', async () => {
    refreshTokenFindUnique.mockResolvedValueOnce({ ...storedRow });
    userFindUnique.mockResolvedValueOnce(activeUser);

    const { refresh } = await import('../services/auth.service');
    const result = await refresh(rawToken);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(rawToken);
    expect(refreshTokenUpdate).toHaveBeenCalledWith({ where: { id: tokenId }, data: { revokedAt: expect.any(Date) } });
    expect(refreshTokenCreate).toHaveBeenCalledOnce();
  });

  it('rejects when the account has since been deactivated', async () => {
    refreshTokenFindUnique.mockResolvedValueOnce({ ...storedRow });
    userFindUnique.mockResolvedValueOnce({ ...activeUser, isActive: false });

    const { refresh } = await import('../services/auth.service');
    const err = await refresh(rawToken).catch((e) => e);
    expect(err.statusCode).toBe(401);
  });
});
