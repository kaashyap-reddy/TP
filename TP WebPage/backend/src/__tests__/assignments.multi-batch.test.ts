import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindMany = vi.fn();
const assignmentCreate = vi.fn();
const assignmentFindFirst = vi.fn();
const assignmentBatchDeleteMany = vi.fn();
const assignmentBatchCreateMany = vi.fn();
const assignmentUpdate = vi.fn();
const batchFacilitatorFindFirst = vi.fn();
const batchTraineeFindFirst = vi.fn();
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
    // assertOwnerOrAdmin/getAttachmentForView widen facilitator ownership to active batch-team
    // membership (across every batch a multi-batch assignment spans) via isOnAnyBatchTeam().
    batchFacilitator: { findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a) },
    batchTrainee: { findFirst: (...a: unknown[]) => batchTraineeFindFirst(...a) },
    $transaction: (...a: unknown[]) => transaction(a[0] as never)
  }
}));

vi.mock('../services/storage', () => ({
  getStorageProvider: () => ({ save: vi.fn(), remove: vi.fn() })
}));

const actor = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };

describe('assignments.service — multi-batch assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

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
    assignmentFindFirst.mockResolvedValueOnce({
      id: 'assignment-1',
      facilitatorId: actor.id,
      batchId: 'batch-1',
      batches: [{ batchId: 'batch-1' }],
      attachmentStorageKey: null
    });
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
    assignmentFindFirst.mockResolvedValueOnce({
      id: 'assignment-1',
      facilitatorId: actor.id,
      batchId: 'batch-1',
      batches: [{ batchId: 'batch-1' }],
      attachmentStorageKey: null
    });
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

  it('allows a non-owning facilitator who is an active team member of a non-primary batch to update a multi-batch assignment', async () => {
    const teamMember = { id: 'facilitator-9', email: 'f9@x.com', role: 'facilitator' as const, permissions: [] };
    assignmentFindFirst.mockResolvedValueOnce({
      id: 'assignment-1',
      facilitatorId: actor.id,
      batchId: 'batch-1',
      batches: [{ batchId: 'batch-1' }, { batchId: 'batch-2' }],
      attachmentStorageKey: null
    });
    // Only on the team for the assignment's second (non-primary) batch.
    batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });
    assignmentUpdate.mockResolvedValueOnce({
      id: 'assignment-1',
      title: 'Updated title',
      batchId: 'batch-1',
      attachmentStorageKey: null,
      batches: [{ batch: { id: 'batch-1', name: 'Batch 1', code: 'b1' } }],
      submissions: []
    });

    const { update } = await import('../services/assignments.service');
    await expect(update(teamMember, 'assignment-1', { title: 'Updated title' })).resolves.toBeDefined();
    expect(batchFacilitatorFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ batchId: { in: ['batch-1', 'batch-2'] } }) })
    );
  });

  describe('getAttachmentForView', () => {
    const assignmentWithAttachment = {
      id: 'assignment-1',
      facilitatorId: actor.id,
      attachmentStorageKey: 'assignments/instructions.pdf',
      batches: [{ batchId: 'batch-1' }, { batchId: 'batch-2' }]
    };

    it('denies a facilitator with no relationship to any of the assignment batches', async () => {
      assignmentFindFirst.mockResolvedValueOnce(assignmentWithAttachment);
      const outsider = { id: 'facilitator-9', email: 'f9@x.com', role: 'facilitator' as const, permissions: [] };

      const { getAttachmentForView } = await import('../services/assignments.service');
      const err = await getAttachmentForView(outsider, 'assignment-1').catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('allows a non-owning facilitator who is an active team member of one of the assignment batches (team-membership parity)', async () => {
      assignmentFindFirst.mockResolvedValueOnce(assignmentWithAttachment);
      const teamMember = { id: 'facilitator-9', email: 'f9@x.com', role: 'facilitator' as const, permissions: [] };
      batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });

      const { getAttachmentForView } = await import('../services/assignments.service');
      const result = await getAttachmentForView(teamMember, 'assignment-1');
      expect(result.id).toBe('assignment-1');
    });
  });
});
