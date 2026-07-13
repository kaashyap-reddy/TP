import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindMany = vi.fn();
const assignmentCreate = vi.fn();
const assignmentFindFirst = vi.fn();
const assignmentBatchDeleteMany = vi.fn();
const assignmentBatchCreateMany = vi.fn();
const assignmentUpdate = vi.fn();
const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({
    assignmentBatch: { deleteMany: assignmentBatchDeleteMany, createMany: assignmentBatchCreateMany },
    assignment: { update: assignmentUpdate }
  })
);

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: { findMany: (...a: unknown[]) => batchFindMany(...a) },
    assignment: {
      create: (...a: unknown[]) => assignmentCreate(...a),
      findFirst: (...a: unknown[]) => assignmentFindFirst(...a)
    },
    $transaction: (...a: unknown[]) => transaction(a[0] as never)
  }
}));

vi.mock('../services/storage', () => ({
  getStorageProvider: () => ({ save: vi.fn(), remove: vi.fn() })
}));

const actor = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };

describe('assignments.service — multi-batch assignment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates one AssignmentBatch join row per selected batch, and sets batchId to the first as the primary batch', async () => {
    batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }, { id: 'batch-2' }]);
    assignmentCreate.mockResolvedValueOnce({
      id: 'assignment-1',
      title: 'Homework',
      batchId: 'batch-1',
      attachmentStorageKey: null,
      batches: [
        { batch: { id: 'batch-1', name: 'Batch 1', code: 'b1' } },
        { batch: { id: 'batch-2', name: 'Batch 2', code: 'b2' } }
      ],
      submissions: []
    });

    const { create } = await import('../services/assignments.service');
    const result = await create(actor, {
      batchIds: ['batch-1', 'batch-2'],
      title: 'Homework',
      description: '',
      deadline: new Date('2026-08-01'),
      status: 'Draft'
    });

    expect(assignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          batchId: 'batch-1',
          batches: { create: [{ batchId: 'batch-1' }, { batchId: 'batch-2' }] }
        })
      })
    );
    expect(result.batches).toEqual([
      { id: 'batch-1', name: 'Batch 1', code: 'b1' },
      { id: 'batch-2', name: 'Batch 2', code: 'b2' }
    ]);
  });

  it('rejects creation when a selected batch does not exist', async () => {
    batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]); // only 1 of 2 requested ids found

    const { create } = await import('../services/assignments.service');
    const err = await create(actor, {
      batchIds: ['batch-1', 'batch-missing'],
      title: 'Homework',
      description: '',
      deadline: new Date('2026-08-01'),
      status: 'Draft'
    }).catch((e) => e);

    expect(err.statusCode).toBe(400);
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it('replaces the join rows (delete + recreate) when updating batchIds, and updates the primary batchId', async () => {
    assignmentFindFirst.mockResolvedValueOnce({ id: 'assignment-1', facilitatorId: actor.id, attachmentStorageKey: null });
    batchFindMany.mockResolvedValueOnce([{ id: 'batch-3' }]);
    assignmentUpdate.mockResolvedValueOnce({
      id: 'assignment-1',
      title: 'Homework',
      batchId: 'batch-3',
      attachmentStorageKey: null,
      batches: [{ batch: { id: 'batch-3', name: 'Batch 3', code: 'b3' } }],
      submissions: []
    });

    const { update } = await import('../services/assignments.service');
    await update(actor, 'assignment-1', { batchIds: ['batch-3'] });

    expect(assignmentBatchDeleteMany).toHaveBeenCalledWith({ where: { assignmentId: 'assignment-1' } });
    expect(assignmentBatchCreateMany).toHaveBeenCalledWith({ data: [{ assignmentId: 'assignment-1', batchId: 'batch-3' }] });
    expect(assignmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ batchId: 'batch-3' }) })
    );
  });

  it('leaves batch assignment untouched when updating fields unrelated to batches (existing single-batch assignments keep working)', async () => {
    assignmentFindFirst.mockResolvedValueOnce({ id: 'assignment-1', facilitatorId: actor.id, attachmentStorageKey: null });
    assignmentUpdate.mockResolvedValueOnce({
      id: 'assignment-1',
      title: 'Updated title',
      batchId: 'batch-1',
      attachmentStorageKey: null,
      batches: [{ batch: { id: 'batch-1', name: 'Batch 1', code: 'b1' } }],
      submissions: []
    });

    const { update } = await import('../services/assignments.service');
    const result = await update(actor, 'assignment-1', { title: 'Updated title' });

    expect(assignmentBatchDeleteMany).not.toHaveBeenCalled();
    expect(batchFindMany).not.toHaveBeenCalled();
    expect(result.title).toBe('Updated title');
  });
});
