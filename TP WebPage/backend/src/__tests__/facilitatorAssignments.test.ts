import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFacilitatorFindFirst = vi.fn();
const batchFacilitatorFindMany = vi.fn();
const batchFacilitatorFindUnique = vi.fn();
const batchFacilitatorFindUniqueOrThrow = vi.fn();
const batchFacilitatorCount = vi.fn();
const batchFacilitatorCreate = vi.fn();
const batchFacilitatorUpdate = vi.fn();
const batchFindFirst = vi.fn();
const batchUpdate = vi.fn();
const userFindFirst = vi.fn();
const sessionCount = vi.fn();

function makeTx() {
  return {
    batchFacilitator: {
      findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a),
      update: (...a: unknown[]) => batchFacilitatorUpdate(...a)
    },
    batch: { update: (...a: unknown[]) => batchUpdate(...a) }
  };
}

vi.mock('../prisma/client', () => ({
  prisma: {
    batchFacilitator: {
      findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a),
      findMany: (...a: unknown[]) => batchFacilitatorFindMany(...a),
      findUnique: (...a: unknown[]) => batchFacilitatorFindUnique(...a),
      findUniqueOrThrow: (...a: unknown[]) => batchFacilitatorFindUniqueOrThrow(...a),
      count: (...a: unknown[]) => batchFacilitatorCount(...a),
      create: (...a: unknown[]) => batchFacilitatorCreate(...a),
      update: (...a: unknown[]) => batchFacilitatorUpdate(...a)
    },
    batch: {
      findFirst: (...a: unknown[]) => batchFindFirst(...a),
      update: (...a: unknown[]) => batchUpdate(...a)
    },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
    session: { count: (...a: unknown[]) => sessionCount(...a) },
    $transaction: (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(makeTx());
      return Promise.all(arg as Promise<unknown>[]);
    }
  }
}));

const admin = { id: 'admin-1', email: 'admin@x.com', role: 'admin' as const, permissions: [] };

const batch = { id: 'batch-1', deletedAt: null };
const facilitatorUser = { id: 'facilitator-2', deletedAt: null, role: { name: 'facilitator' } };

const rowInclude = {
  facilitator: { id: 'facilitator-2', name: 'Jordan Lee', email: 'jordan@x.com' },
  assignedByUser: { name: 'Admin One' }
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment-1',
    batchId: 'batch-1',
    facilitatorId: 'facilitator-2',
    role: 'Trainer',
    isPrimaryCoordinator: false,
    status: 'Active',
    assignedAt: new Date('2026-01-01'),
    assignedBy: 'admin-1',
    notes: null,
    ...rowInclude,
    ...overrides
  };
}

describe('facilitatorAssignments.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionCount.mockResolvedValue(0);
  });

  describe('create', () => {
    it('rejects a duplicate active assignment with 409', async () => {
      batchFindFirst.mockResolvedValueOnce(batch);
      userFindFirst.mockResolvedValueOnce(facilitatorUser);
      batchFacilitatorFindFirst.mockResolvedValueOnce(row());

      const { create } = await import('../services/facilitatorAssignments.service');
      const err = await create(admin.id, { batchId: 'batch-1', facilitatorId: 'facilitator-2', role: 'Trainer' }).catch((e) => e);

      expect(err.statusCode).toBe(409);
      expect(batchFacilitatorCreate).not.toHaveBeenCalled();
    });

    it('allows re-adding a facilitator once their prior row was removed', async () => {
      batchFindFirst.mockResolvedValueOnce(batch);
      userFindFirst.mockResolvedValueOnce(facilitatorUser);
      batchFacilitatorFindFirst.mockResolvedValueOnce(null); // no active (non-Removed) row
      batchFacilitatorCreate.mockResolvedValueOnce(row());

      const { create } = await import('../services/facilitatorAssignments.service');
      const result = await create(admin.id, { batchId: 'batch-1', facilitatorId: 'facilitator-2', role: 'Trainer' });

      expect(result.id).toBe('assignment-1');
      expect(batchFacilitatorCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assignedBy: admin.id, role: 'Trainer' }) })
      );
    });

    it('serializes role/status back to their display-string wire values and assignedBy as a name', async () => {
      batchFindFirst.mockResolvedValueOnce(batch);
      userFindFirst.mockResolvedValueOnce(facilitatorUser);
      batchFacilitatorFindFirst.mockResolvedValueOnce(null);
      batchFacilitatorCreate.mockResolvedValueOnce(row({ role: 'PrimaryCoordinator', status: 'Active' }));

      const { create } = await import('../services/facilitatorAssignments.service');
      const result = await create(admin.id, { batchId: 'batch-1', facilitatorId: 'facilitator-2', role: 'Primary Coordinator' });

      expect(result.role).toBe('Primary Coordinator');
      expect(result.assignedBy).toBe('Admin One');
    });
  });

  describe('update', () => {
    it('only ever writes the allow-listed fields, never isPrimaryCoordinator/facilitatorId/batchId', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(row());
      batchFacilitatorUpdate.mockResolvedValueOnce(row({ notes: 'Reassigned to a new cohort' }));

      const { update } = await import('../services/facilitatorAssignments.service');
      await update('assignment-1', { notes: 'Reassigned to a new cohort' });

      const dataArg = batchFacilitatorUpdate.mock.calls[0][0].data;
      expect(dataArg).toEqual({ notes: 'Reassigned to a new cohort' });
      expect(dataArg.isPrimaryCoordinator).toBeUndefined();
      expect(dataArg.facilitatorId).toBeUndefined();
      expect(dataArg.batchId).toBeUndefined();
    });

    it('404s on an unknown assignment id', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(null);

      const { update } = await import('../services/facilitatorAssignments.service');
      const err = await update('missing', { notes: 'x' }).catch((e) => e);

      expect(err.statusCode).toBe(404);
    });
  });

  describe('setPrimary', () => {
    it('demotes the previous primary and promotes the target in the same operation, syncing Batch.facilitatorId', async () => {
      const target = row({ id: 'assignment-2', facilitatorId: 'facilitator-2', isPrimaryCoordinator: false, role: 'Trainer' });
      const currentPrimary = row({ id: 'assignment-1', facilitatorId: 'facilitator-3', isPrimaryCoordinator: true, role: 'PrimaryCoordinator' });

      batchFacilitatorFindUnique.mockResolvedValueOnce(target); // initial lookup of target
      batchFacilitatorFindFirst
        .mockResolvedValueOnce(currentPrimary) // find current primary inside tx
        .mockResolvedValueOnce({ ...target, isPrimaryCoordinator: true, facilitatorId: 'facilitator-2' }); // syncBatchPrimaryCoordinator's lookup
      batchFacilitatorFindUniqueOrThrow.mockResolvedValueOnce(row({ id: 'assignment-2', isPrimaryCoordinator: true, role: 'PrimaryCoordinator' }));

      const { setPrimary } = await import('../services/facilitatorAssignments.service');
      const result = await setPrimary('assignment-2');

      expect(batchFacilitatorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assignment-1' }, data: { isPrimaryCoordinator: false, role: 'LeadFacilitator' } })
      );
      expect(batchFacilitatorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assignment-2' }, data: { isPrimaryCoordinator: true, role: 'PrimaryCoordinator' } })
      );
      expect(batchUpdate).toHaveBeenCalledWith({ where: { id: 'batch-1' }, data: { facilitatorId: 'facilitator-2' } });
      expect(result.isPrimaryCoordinator).toBe(true);
    });

    it('404s on an unknown assignment id', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(null);

      const { setPrimary } = await import('../services/facilitatorAssignments.service');
      const err = await setPrimary('missing').catch((e) => e);

      expect(err.statusCode).toBe(404);
    });

    it('refuses to promote a removed assignment', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(row({ status: 'Removed' }));

      const { setPrimary } = await import('../services/facilitatorAssignments.service');
      const err = await setPrimary('assignment-1').catch((e) => e);

      expect(err.statusCode).toBe(400);
    });
  });

  describe('remove', () => {
    it('soft-deletes (keeps the row, marks status Removed) and clears Batch.facilitatorId when the removed row was primary', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(row({ isPrimaryCoordinator: true }));
      batchFacilitatorFindFirst.mockResolvedValueOnce(null); // no remaining primary after removal

      const { remove } = await import('../services/facilitatorAssignments.service');
      await remove('assignment-1');

      expect(batchFacilitatorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assignment-1' }, data: { status: 'Removed', isPrimaryCoordinator: false } })
      );
      // No auto-promotion of a replacement -- cache is cleared, not reassigned.
      expect(batchUpdate).toHaveBeenCalledWith({ where: { id: 'batch-1' }, data: { facilitatorId: null } });
    });

    it('does not touch Batch.facilitatorId when the removed row was not primary', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(row({ isPrimaryCoordinator: false }));

      const { remove } = await import('../services/facilitatorAssignments.service');
      await remove('assignment-1');

      expect(batchUpdate).not.toHaveBeenCalled();
    });

    it('404s on an unknown assignment id', async () => {
      batchFacilitatorFindUnique.mockResolvedValueOnce(null);

      const { remove } = await import('../services/facilitatorAssignments.service');
      const err = await remove('missing').catch((e) => e);

      expect(err.statusCode).toBe(404);
    });
  });

  describe('isOnBatchTeam', () => {
    it('is true for an active (non-Removed) team member', async () => {
      batchFacilitatorFindFirst.mockResolvedValueOnce(row());

      const { isOnBatchTeam } = await import('../services/facilitatorAssignments.service');
      await expect(isOnBatchTeam('facilitator-2', 'batch-1')).resolves.toBe(true);
      expect(batchFacilitatorFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { batchId: 'batch-1', facilitatorId: 'facilitator-2', status: { not: 'Removed' } } })
      );
    });

    it('is false for a facilitator with no assignment row on that batch', async () => {
      batchFacilitatorFindFirst.mockResolvedValueOnce(null);

      const { isOnBatchTeam } = await import('../services/facilitatorAssignments.service');
      await expect(isOnBatchTeam('facilitator-9', 'batch-1')).resolves.toBe(false);
    });
  });
});
