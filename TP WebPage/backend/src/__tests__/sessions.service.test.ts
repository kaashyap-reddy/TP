import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionFindFirst = vi.fn();
const sessionUpdate = vi.fn();
const userFindFirst = vi.fn();
const batchFacilitatorFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    session: {
      findFirst: (...a: unknown[]) => sessionFindFirst(...a),
      update: (...a: unknown[]) => sessionUpdate(...a)
    },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    // assertOwnerOrAdmin widens facilitator ownership to active batch-team membership via
    // isOnBatchTeam(), which queries this table.
    batchFacilitator: { findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a) }
  }
}));

const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };
const owningFacilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };

const session = { id: 'session-1', batchId: 'batch-1', facilitatorId: 'facilitator-1', deletedAt: null };
const facilitatorUser = { id: 'facilitator-2', deletedAt: null, role: { name: 'facilitator' } };
const traineeUser = { id: 'trainee-1', deletedAt: null, role: { name: 'trainee' } };

describe('sessions.service — trainer reassignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionFindFirst.mockResolvedValue(session);
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

  it('reassigns the trainer to a real facilitator user', async () => {
    userFindFirst.mockResolvedValueOnce(facilitatorUser);
    sessionUpdate.mockResolvedValueOnce({ ...session, facilitatorId: 'facilitator-2' });

    const { update } = await import('../services/sessions.service');
    await update(admin, 'session-1', { facilitatorId: 'facilitator-2' });

    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-1' }, data: { facilitatorId: 'facilitator-2' } })
    );
  });

  it('rejects reassigning to a user who is not a facilitator', async () => {
    userFindFirst.mockResolvedValueOnce(traineeUser);

    const { update } = await import('../services/sessions.service');
    const err = await update(admin, 'session-1', { facilitatorId: 'trainee-1' }).catch((e) => e);

    expect(err.statusCode).toBe(400);
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it('rejects reassigning to a nonexistent user id', async () => {
    userFindFirst.mockResolvedValueOnce(null);

    const { update } = await import('../services/sessions.service');
    const err = await update(admin, 'session-1', { facilitatorId: 'ghost-1' }).catch((e) => e);

    expect(err.statusCode).toBe(400);
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it('allows clearing the trainer (facilitatorId: null) without a lookup', async () => {
    sessionUpdate.mockResolvedValueOnce({ ...session, facilitatorId: null });

    const { update } = await import('../services/sessions.service');
    await update(admin, 'session-1', { facilitatorId: null });

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(sessionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { facilitatorId: null } }));
  });

  it('still enforces ownership before touching facilitatorId — a non-owning, non-team facilitator is denied', async () => {
    const outsider = { id: 'facilitator-9', email: 'f9@x.com', role: 'facilitator' as const, permissions: [] };

    const { update } = await import('../services/sessions.service');
    const err = await update(outsider, 'session-1', { facilitatorId: 'facilitator-2' }).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it('allows the owning facilitator to reassign to someone else', async () => {
    userFindFirst.mockResolvedValueOnce(facilitatorUser);
    sessionUpdate.mockResolvedValueOnce({ ...session, facilitatorId: 'facilitator-2' });

    const { update } = await import('../services/sessions.service');
    await expect(update(owningFacilitator, 'session-1', { facilitatorId: 'facilitator-2' })).resolves.toBeDefined();
  });
});
