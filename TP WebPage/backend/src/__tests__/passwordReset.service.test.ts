import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '../utils/hash';
import { verifyPassword } from '../utils/password';

const userRow = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  roleId: 1,
  isActive: true,
  deletedAt: null,
  passwordHash: 'old-hash',
  role: { name: 'trainee', permissions: [] },
  profile: null
};

const userFindFirst = vi.fn();
const userUpdate = vi.fn();
const resetTokenCreate = vi.fn();
const resetTokenUpdate = vi.fn();
const resetTokenUpdateMany = vi.fn();
const resetTokenFindUnique = vi.fn();
const refreshTokenUpdateMany = vi.fn();
const emailSend = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    user: {
      findFirst: (...a: unknown[]) => userFindFirst(...a),
      update: (...a: unknown[]) => userUpdate(...a)
    },
    passwordResetToken: {
      create: (...a: unknown[]) => resetTokenCreate(...a),
      update: (...a: unknown[]) => resetTokenUpdate(...a),
      updateMany: (...a: unknown[]) => resetTokenUpdateMany(...a),
      findUnique: (...a: unknown[]) => resetTokenFindUnique(...a)
    },
    refreshToken: {
      updateMany: (...a: unknown[]) => refreshTokenUpdateMany(...a)
    },
    $transaction: (ops: unknown[]) => Promise.all(ops)
  }
}));

vi.mock('../services/email', () => ({
  getEmailProvider: () => ({ send: (...a: unknown[]) => emailSend(...a) })
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetTokenCreate.mockResolvedValue({});
  resetTokenUpdate.mockResolvedValue({});
  resetTokenUpdateMany.mockResolvedValue({ count: 0 });
  refreshTokenUpdateMany.mockResolvedValue({ count: 0 });
  userUpdate.mockResolvedValue(userRow);
  emailSend.mockResolvedValue(undefined);
});

describe('requestPasswordReset', () => {
  it('returns null (still 200 upstream) for an unknown email and sends nothing — no enumeration', async () => {
    const { requestPasswordReset } = await import('../services/auth.service');
    userFindFirst.mockResolvedValueOnce(null);

    const result = await requestPasswordReset('nobody@example.com');
    expect(result).toBeNull();
    expect(emailSend).not.toHaveBeenCalled();
    expect(resetTokenCreate).not.toHaveBeenCalled();
  });

  it('stores only the token hash, invalidates prior tokens, and emails a reset link', async () => {
    const { requestPasswordReset } = await import('../services/auth.service');
    userFindFirst.mockResolvedValueOnce(userRow);

    const result = await requestPasswordReset(userRow.email);
    expect(result).not.toBeNull();
    expect(result!.token).toMatch(/^[0-9a-f]{64}$/);

    // Older outstanding links are killed before the new one is issued.
    expect(resetTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: userRow.id, usedAt: null } })
    );

    const stored = resetTokenCreate.mock.calls[0][0] as { data: { tokenHash: string } };
    expect(stored.data.tokenHash).toBe(sha256(result!.token));
    expect(stored.data.tokenHash).not.toBe(result!.token);

    const sent = emailSend.mock.calls[0][0] as { to: string; text: string };
    expect(sent.to).toBe(userRow.email);
    expect(sent.text).toContain(`/reset-password?token=${result!.token}`);
  });
});

describe('resetPassword', () => {
  const validStored = () => ({
    id: 'reset-1',
    userId: userRow.id,
    tokenHash: sha256('the-token'),
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: userRow
  });

  it('rejects an unknown, used, or expired token with the same message', async () => {
    const { resetPassword } = await import('../services/auth.service');

    resetTokenFindUnique.mockResolvedValueOnce(null);
    const unknown = await resetPassword('nope', 'NewPassword1').catch((e) => e);

    resetTokenFindUnique.mockResolvedValueOnce({ ...validStored(), usedAt: new Date() });
    const used = await resetPassword('the-token', 'NewPassword1').catch((e) => e);

    resetTokenFindUnique.mockResolvedValueOnce({ ...validStored(), expiresAt: new Date(Date.now() - 1) });
    const expired = await resetPassword('the-token', 'NewPassword1').catch((e) => e);

    for (const err of [unknown, used, expired]) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe(unknown.message);
    }
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('sets the new password (hashed), marks the token used, and revokes all sessions', async () => {
    const { resetPassword } = await import('../services/auth.service');
    resetTokenFindUnique.mockResolvedValueOnce(validStored());

    await resetPassword('the-token', 'NewPassword1');

    const updated = userUpdate.mock.calls[0][0] as { where: { id: string }; data: { passwordHash: string } };
    expect(updated.where.id).toBe(userRow.id);
    expect(updated.data.passwordHash).not.toBe('NewPassword1');
    expect(await verifyPassword('NewPassword1', updated.data.passwordHash)).toBe(true);

    expect(resetTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'reset-1' }, data: expect.objectContaining({ usedAt: expect.any(Date) }) })
    );
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: userRow.id, revokedAt: null } })
    );
  });

  it('rejects a valid token whose account has been deactivated', async () => {
    const { resetPassword } = await import('../services/auth.service');
    resetTokenFindUnique.mockResolvedValueOnce({ ...validStored(), user: { ...userRow, isActive: false } });

    const err = await resetPassword('the-token', 'NewPassword1').catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
