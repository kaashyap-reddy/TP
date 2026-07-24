import { beforeEach, describe, expect, it, vi } from 'vitest';

const feedbackEntryFindMany = vi.fn();
const feedbackEntryCount = vi.fn();
const feedbackEntryFindUnique = vi.fn();
const batchFindMany = vi.fn();
const batchFacilitatorFindMany = vi.fn();
const batchFacilitatorFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    feedbackEntry: {
      findMany: (...a: unknown[]) => feedbackEntryFindMany(...a),
      count: (...a: unknown[]) => feedbackEntryCount(...a),
      findUnique: (...a: unknown[]) => feedbackEntryFindUnique(...a)
    },
    batch: { findMany: (...a: unknown[]) => batchFindMany(...a) },
    // list()/getById() previously had no facilitator-side scoping at all -- both now widen via
    // this table (owned batches from Batch.facilitatorId, team batches from here).
    batchFacilitator: {
      findMany: (...a: unknown[]) => batchFacilitatorFindMany(...a),
      findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a)
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

const facilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };
const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };

const baseQuery = { page: 1, pageSize: 20, sortOrder: 'desc' as const, sortBy: 'createdAt' };

const entry = {
  id: 'fb-1',
  batchId: 'batch-9',
  traineeId: 'trainee-1',
  facilitatorId: 'someone-else',
  direction: 'FacilitatorToTrainee'
};

describe('feedback.service — facilitator scoping (previously unrestricted)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedbackEntryFindMany.mockResolvedValue([]);
    feedbackEntryCount.mockResolvedValue(0);
    batchFindMany.mockResolvedValue([]);
    batchFacilitatorFindMany.mockResolvedValue([]);
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

  describe('list', () => {
    it("scopes an unfiltered query to only the facilitator's owned + team batches", async () => {
      batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]);
      batchFacilitatorFindMany.mockResolvedValueOnce([{ batchId: 'batch-2' }]);

      const { list } = await import('../services/feedback.service');
      await list(facilitator, { ...baseQuery } as never);

      const where = feedbackEntryFindMany.mock.calls[0][0].where;
      expect(where.batchId).toEqual({ in: ['batch-1', 'batch-2'] });
    });

    it('denies an explicit batchId filter the facilitator has no relationship to', async () => {
      batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]);

      const { list } = await import('../services/feedback.service');
      const err = await list(facilitator, { ...baseQuery, batchId: 'batch-9' } as never).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(feedbackEntryFindMany).not.toHaveBeenCalled();
    });

    it('allows an explicit batchId filter the facilitator does have a relationship to', async () => {
      batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]);

      const { list } = await import('../services/feedback.service');
      await list(facilitator, { ...baseQuery, batchId: 'batch-1' } as never);

      const where = feedbackEntryFindMany.mock.calls[0][0].where;
      expect(where.batchId).toBe('batch-1');
    });

    it('does not restrict admin', async () => {
      const { list } = await import('../services/feedback.service');
      await list(admin, { ...baseQuery } as never);

      const where = feedbackEntryFindMany.mock.calls[0][0].where;
      expect(where.batchId).toBeUndefined();
      expect(batchFindMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('denies a facilitator with no relationship to the entry (previously unchecked)', async () => {
      feedbackEntryFindUnique.mockResolvedValueOnce(entry);

      const { getById } = await import('../services/feedback.service');
      const err = await getById(facilitator, 'fb-1').catch((e) => e);

      expect(err.statusCode).toBe(403);
    });

    it('allows the facilitator named as the entry facilitatorId', async () => {
      feedbackEntryFindUnique.mockResolvedValueOnce({ ...entry, facilitatorId: facilitator.id });

      const { getById } = await import('../services/feedback.service');
      await expect(getById(facilitator, 'fb-1')).resolves.toBeDefined();
    });

    it('allows a facilitator who is an active team member of the entry batch', async () => {
      feedbackEntryFindUnique.mockResolvedValueOnce(entry);
      batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });

      const { getById } = await import('../services/feedback.service');
      await expect(getById(facilitator, 'fb-1')).resolves.toBeDefined();
    });

    it('does not restrict admin', async () => {
      feedbackEntryFindUnique.mockResolvedValueOnce(entry);

      const { getById } = await import('../services/feedback.service');
      await expect(getById(admin, 'fb-1')).resolves.toBeDefined();
    });
  });
});
