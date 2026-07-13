import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindUnique = vi.fn();
const batchFindFirst = vi.fn();
const batchCreate = vi.fn();
const batchUpdate = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: {
      findUnique: (...args: unknown[]) => batchFindUnique(...args),
      findFirst: (...args: unknown[]) => batchFindFirst(...args),
      create: (...args: unknown[]) => batchCreate(...args),
      update: (...args: unknown[]) => batchUpdate(...args)
    },
    user: { findFirst: vi.fn() }
  }
}));

const newBatch = { code: 'de-1', name: 'Data Eng 1', program: 'DataEngineering' as const, track: 'BTech' as const, status: 'Upcoming' as const };

describe('batches.service (core CRUD)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects creating a batch with a duplicate code (409, not a silent overwrite)', async () => {
    const { create } = await import('../services/batches.service');
    batchFindUnique.mockResolvedValueOnce({ id: 'existing-batch', code: 'de-1' });

    const err = await create(newBatch).catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(batchCreate).not.toHaveBeenCalled();
  });

  it('creates a batch when the code is unique', async () => {
    const { create } = await import('../services/batches.service');
    batchFindUnique.mockResolvedValueOnce(null);
    batchCreate.mockResolvedValueOnce({ id: 'new-batch', ...newBatch });

    const result = await create(newBatch);
    expect(result.id).toBe('new-batch');
    expect(batchCreate).toHaveBeenCalledOnce();
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
