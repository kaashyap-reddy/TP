import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../utils/password';

const userRow = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  roleId: 1,
  isActive: true,
  deletedAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
  passwordHash: '',
  role: { name: 'trainee', permissions: [] },
  profile: null
};

const findFirst = vi.fn();
const update = vi.fn();
const refreshTokenCreate = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => update(...args)
    },
    refreshToken: {
      create: (...args: unknown[]) => refreshTokenCreate(...args)
    }
  }
}));

describe('auth.service login', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    userRow.passwordHash = await hashPassword('CorrectHorse123');
    userRow.failedLoginAttempts = 0;
    userRow.lockedUntil = null;
    update.mockImplementation(({ data }: { data: Partial<typeof userRow> }) => {
      Object.assign(userRow, data);
      return Promise.resolve(userRow);
    });
    refreshTokenCreate.mockResolvedValue({});
  });

  it('rejects an unknown email with the same generic message as a wrong password (no account enumeration)', async () => {
    const { login } = await import('../services/auth.service');
    findFirst.mockResolvedValueOnce(null);
    const unknownEmailError = await login('nobody@example.com', 'whatever123', false).catch((e) => e);

    findFirst.mockResolvedValueOnce(userRow);
    const wrongPasswordError = await login(userRow.email, 'wrongpassword1', false).catch((e) => e);

    expect(unknownEmailError.message).toBe(wrongPasswordError.message);
    expect(unknownEmailError.statusCode).toBe(401);
  });

  it('locks the account after the configured number of failed attempts', async () => {
    const { login } = await import('../services/auth.service');
    const { config } = await import('../config');

    for (let i = 0; i < config.login.maxAttempts; i++) {
      findFirst.mockResolvedValueOnce({ ...userRow });
      await login(userRow.email, 'wrongpassword1', false).catch(() => undefined);
    }

    expect(userRow.lockedUntil).not.toBeNull();

    findFirst.mockResolvedValueOnce({ ...userRow });
    const err = await login(userRow.email, 'CorrectHorse123', false).catch((e) => e);
    expect(err.statusCode).toBe(423);
  });

  it('resets failed attempts on a successful login', async () => {
    const { login } = await import('../services/auth.service');
    userRow.failedLoginAttempts = 2;

    findFirst.mockResolvedValueOnce({ ...userRow });
    const result = await login(userRow.email, 'CorrectHorse123', false);

    expect(result.user.email).toBe(userRow.email);
    expect(userRow.failedLoginAttempts).toBe(0);
    expect(userRow.lockedUntil).toBeNull();
  });
});
