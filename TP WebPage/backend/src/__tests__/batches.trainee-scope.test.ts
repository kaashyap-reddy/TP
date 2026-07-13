import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindFirst = vi.fn();
const batchTraineeFindUnique = vi.fn();
const batchTraineeFindMany = vi.fn();
const batchTraineeCount = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: { findFirst: (...a: unknown[]) => batchFindFirst(...a) },
    batchTrainee: {
      findUnique: (...a: unknown[]) => batchTraineeFindUnique(...a),
      findMany: (...a: unknown[]) => batchTraineeFindMany(...a),
      count: (...a: unknown[]) => batchTraineeCount(...a)
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

const query = { page: 1, pageSize: 20, sortOrder: 'desc' as const, search: undefined };
const batch = { id: 'batch-1', deletedAt: null };

describe('batches.service.listTrainees — trainee-scope authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies a trainee who is not enrolled in the batch', async () => {
    batchFindFirst.mockResolvedValueOnce(batch);
    batchTraineeFindUnique.mockResolvedValueOnce(null);
    const outsider = { id: 'trainee-outside', email: 'o@x.com', role: 'trainee' as const, permissions: [] };

    const { listTrainees } = await import('../services/batches.service');
    const err = await listTrainees(outsider, 'batch-1', query as never).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(batchTraineeFindMany).not.toHaveBeenCalled();
  });

  it('denies a trainee whose enrollment was removed', async () => {
    batchFindFirst.mockResolvedValueOnce(batch);
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: new Date('2026-01-01') });
    const removed = { id: 'trainee-removed', email: 'r@x.com', role: 'trainee' as const, permissions: [] };

    const { listTrainees } = await import('../services/batches.service');
    const err = await listTrainees(removed, 'batch-1', query as never).catch((e) => e);

    expect(err.statusCode).toBe(403);
  });

  it('allows a trainee who is actively enrolled in the batch', async () => {
    batchFindFirst.mockResolvedValueOnce(batch);
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    batchTraineeFindMany.mockResolvedValueOnce([]);
    batchTraineeCount.mockResolvedValueOnce(0);
    const member = { id: 'trainee-member', email: 'm@x.com', role: 'trainee' as const, permissions: [] };

    const { listTrainees } = await import('../services/batches.service');
    await listTrainees(member, 'batch-1', query as never);

    expect(batchTraineeFindMany).toHaveBeenCalled();
  });

  it('does not restrict admin or facilitator callers (no enrollment check performed)', async () => {
    batchFindFirst.mockResolvedValueOnce(batch);
    batchTraineeFindMany.mockResolvedValueOnce([]);
    batchTraineeCount.mockResolvedValueOnce(0);
    const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };

    const { listTrainees } = await import('../services/batches.service');
    await listTrainees(admin, 'batch-1', query as never);

    expect(batchTraineeFindUnique).not.toHaveBeenCalled();
    expect(batchTraineeFindMany).toHaveBeenCalled();
  });
});
