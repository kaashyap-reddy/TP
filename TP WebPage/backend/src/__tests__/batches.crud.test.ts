import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindUnique = vi.fn();
const batchFindFirst = vi.fn();
const batchCreate = vi.fn();
const batchUpdate = vi.fn();
const userFindFirst = vi.fn();
const trainingPlanFindUnique = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: {
      findUnique: (...args: unknown[]) => batchFindUnique(...args),
      findFirst: (...args: unknown[]) => batchFindFirst(...args),
      create: (...args: unknown[]) => batchCreate(...args),
      update: (...args: unknown[]) => batchUpdate(...args)
    },
    user: { findFirst: (...args: unknown[]) => userFindFirst(...args) },
    trainingPlan: { findUnique: (...args: unknown[]) => trainingPlanFindUnique(...args) },
    $transaction: vi.fn()
  }
}));

const actorId = 'admin-1';
const facilitatorId = 'facilitator-1';
const trainingPlanId = 'plan-1';
const newBatch = { code: 'ba-btech-2', name: 'BA BTech 2', trainingPlanId, facilitatorId, status: 'Upcoming' as const };

describe('batches.service (core CRUD)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects creating a batch with a duplicate code (409, not a silent overwrite)', async () => {
    const { create } = await import('../services/batches.service');
    userFindFirst.mockResolvedValueOnce({ id: facilitatorId, role: { name: 'facilitator' } });
    batchFindUnique.mockResolvedValueOnce({ id: 'existing-batch', code: newBatch.code });

    const err = await create(actorId, newBatch).catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(trainingPlanFindUnique).not.toHaveBeenCalled();
  });

  it('rejects creating a batch against a non-existent training plan', async () => {
    const { create } = await import('../services/batches.service');
    userFindFirst.mockResolvedValueOnce({ id: facilitatorId, role: { name: 'facilitator' } });
    batchFindUnique.mockResolvedValueOnce(null);
    trainingPlanFindUnique.mockResolvedValueOnce(null);

    const err = await create(actorId, newBatch).catch((e) => e);
    expect(err.statusCode).toBe(400);
  });

  it('allows creating a batch with no facilitator (Trainer is optional)', async () => {
    const { create } = await import('../services/batches.service');
    batchFindUnique.mockResolvedValueOnce(null);
    trainingPlanFindUnique.mockResolvedValueOnce(null);

    const err = await create(actorId, { code: 'ba-btech-3', name: 'BA BTech 3', trainingPlanId, status: 'Upcoming' as const }).catch(
      (e) => e
    );
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(err.statusCode).toBe(400); // still fails here since no plan exists — the point is it never touched assertRole
  });

  it('returns 404 updating a batch that does not exist (not a silent no-op)', async () => {
    const { update } = await import('../services/batches.service');
    batchFindFirst.mockResolvedValueOnce(null);

    const err = await update('missing-id', { name: 'New Name' }).catch((e) => e);
    expect(err.statusCode).toBe(404);
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it('soft-deletes by setting deletedAt rather than removing the row', async () => {
    const { softDelete } = await import('../services/batches.service');
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1' });
    batchUpdate.mockResolvedValueOnce({});

    await softDelete('batch-1');

    expect(batchUpdate).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { deletedAt: expect.any(Date), archivedAt: expect.any(Date) }
    });
  });
});
