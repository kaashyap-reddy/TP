import { beforeEach, describe, expect, it, vi } from 'vitest';

const resourceFindMany = vi.fn();
const resourceCount = vi.fn();
const resourceFindFirst = vi.fn();
const resourceUpdate = vi.fn();
const batchFindMany = vi.fn();
const batchFindFirst = vi.fn();
const batchFacilitatorFindMany = vi.fn();
const batchFacilitatorFindFirst = vi.fn();
const batchTraineeFindUnique = vi.fn();
const batchTraineeFindMany = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    resource: {
      findMany: (...a: unknown[]) => resourceFindMany(...a),
      count: (...a: unknown[]) => resourceCount(...a),
      findFirst: (...a: unknown[]) => resourceFindFirst(...a),
      update: (...a: unknown[]) => resourceUpdate(...a)
    },
    batch: {
      findMany: (...a: unknown[]) => batchFindMany(...a),
      findFirst: (...a: unknown[]) => batchFindFirst(...a)
    },
    // list()/getById()/getForDownload() previously had no actor-based scoping at all -- all three
    // now widen via this table (owned batches from Batch.facilitatorId, team batches from here).
    batchFacilitator: {
      findMany: (...a: unknown[]) => batchFacilitatorFindMany(...a),
      findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a)
    },
    batchTrainee: {
      findUnique: (...a: unknown[]) => batchTraineeFindUnique(...a),
      findMany: (...a: unknown[]) => batchTraineeFindMany(...a)
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };
const facilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };
const trainee = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };

const baseQuery = { page: 1, pageSize: 20, sortOrder: 'desc' as const, sortBy: 'createdAt' };

const globalResource = { id: 'res-global', batchId: null, deletedAt: null, sizeBytes: null };
const scopedResource = { id: 'res-1', batchId: 'batch-9', deletedAt: null, sizeBytes: null };

describe('resources.service — read-side scoping (previously unrestricted)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resourceFindMany.mockResolvedValue([]);
    resourceCount.mockResolvedValue(0);
    batchFindMany.mockResolvedValue([]);
    batchFacilitatorFindMany.mockResolvedValue([]);
    batchFacilitatorFindFirst.mockResolvedValue(null);
    batchTraineeFindMany.mockResolvedValue([]);
  });

  describe('list', () => {
    it("scopes an unfiltered query to global resources plus the facilitator's owned + team batches", async () => {
      batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]);
      batchFacilitatorFindMany.mockResolvedValueOnce([{ batchId: 'batch-2' }]);

      const { list } = await import('../services/resources.service');
      await list(facilitator, { ...baseQuery } as never);

      const where = resourceFindMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ batchId: null }, { batchId: { in: ['batch-1', 'batch-2'] } }]);
    });

    it('denies an explicit batchId filter a trainee is not enrolled in', async () => {
      const { list } = await import('../services/resources.service');
      const err = await list(trainee, { ...baseQuery, batchId: 'batch-9' } as never).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(resourceFindMany).not.toHaveBeenCalled();
    });

    it('does not restrict admin', async () => {
      const { list } = await import('../services/resources.service');
      await list(admin, { ...baseQuery } as never);

      const where = resourceFindMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
      expect(batchFindMany).not.toHaveBeenCalled();
    });
  });

  describe('getById / getForDownload', () => {
    it('allows any authenticated role to read a global resource', async () => {
      resourceFindFirst.mockResolvedValueOnce(globalResource);

      const { getById } = await import('../services/resources.service');
      await expect(getById(trainee, 'res-global')).resolves.toBeDefined();
    });

    it('denies a trainee not enrolled in the resource batch', async () => {
      resourceFindFirst.mockResolvedValueOnce(scopedResource);
      batchTraineeFindUnique.mockResolvedValueOnce(null);

      const { getById } = await import('../services/resources.service');
      const err = await getById(trainee, 'res-1').catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('allows an enrolled trainee', async () => {
      resourceFindFirst.mockResolvedValueOnce(scopedResource);
      batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });

      const { getById } = await import('../services/resources.service');
      await expect(getById(trainee, 'res-1')).resolves.toBeDefined();
    });

    it('denies a facilitator with no relationship to the resource batch', async () => {
      resourceFindFirst.mockResolvedValueOnce(scopedResource);
      batchFindFirst.mockResolvedValueOnce({ id: 'batch-9', facilitatorId: 'someone-else' });

      const { getById } = await import('../services/resources.service');
      const err = await getById(facilitator, 'res-1').catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    it('allows a facilitator who is an active team member of the resource batch', async () => {
      resourceFindFirst.mockResolvedValueOnce(scopedResource);
      batchFindFirst.mockResolvedValueOnce({ id: 'batch-9', facilitatorId: 'someone-else' });
      batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });

      const { getById } = await import('../services/resources.service');
      await expect(getById(facilitator, 'res-1')).resolves.toBeDefined();
    });

    it('getForDownload enforces the same access rule as getById', async () => {
      resourceFindFirst.mockResolvedValueOnce(scopedResource);
      batchTraineeFindUnique.mockResolvedValueOnce(null);

      const { getForDownload } = await import('../services/resources.service');
      const err = await getForDownload(trainee, 'res-1').catch((e) => e);
      expect(err.statusCode).toBe(403);
      expect(resourceUpdate).not.toHaveBeenCalled();
    });
  });
});
