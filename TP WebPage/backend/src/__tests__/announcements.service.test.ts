import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../types/auth';

const announcementFindMany = vi.fn();
const announcementFindFirst = vi.fn();
const announcementCount = vi.fn();
const announcementCreate = vi.fn();
const announcementUpdate = vi.fn();
const readFindMany = vi.fn();
const readFindUnique = vi.fn();
const readUpsert = vi.fn();
const batchFindFirst = vi.fn();
const batchFindMany = vi.fn();
const batchTraineeFindMany = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    announcement: {
      findMany: (...a: unknown[]) => announcementFindMany(...a),
      findFirst: (...a: unknown[]) => announcementFindFirst(...a),
      count: (...a: unknown[]) => announcementCount(...a),
      create: (...a: unknown[]) => announcementCreate(...a),
      update: (...a: unknown[]) => announcementUpdate(...a)
    },
    announcementRead: {
      findMany: (...a: unknown[]) => readFindMany(...a),
      findUnique: (...a: unknown[]) => readFindUnique(...a),
      upsert: (...a: unknown[]) => readUpsert(...a)
    },
    batch: {
      findFirst: (...a: unknown[]) => batchFindFirst(...a),
      findMany: (...a: unknown[]) => batchFindMany(...a)
    },
    batchTrainee: {
      findMany: (...a: unknown[]) => batchTraineeFindMany(...a)
    },
    $transaction: (ops: unknown[]) => Promise.all(ops)
  }
}));

const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', role: 'admin', permissions: [] };
const facilitator: AuthenticatedUser = { id: 'fac-1', email: 'f@x.com', role: 'facilitator', permissions: [] };
const trainee: AuthenticatedUser = { id: 'tr-1', email: 't@x.com', role: 'trainee', permissions: [] };

const row = {
  id: 'ann-1',
  authorId: 'admin-1',
  batchId: null,
  title: 'Welcome',
  message: 'Hello',
  priority: 'Normal',
  audience: 'All',
  pinned: false,
  deletedAt: null,
  author: { id: 'admin-1', name: 'Admin', email: 'a@x.com' },
  batch: null,
  _count: { reads: 3 }
};

beforeEach(() => {
  vi.clearAllMocks();
  announcementFindMany.mockResolvedValue([row]);
  announcementCount.mockResolvedValue(1);
  readFindMany.mockResolvedValue([]);
});

const baseQuery = { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' } as never;

describe('announcements list scoping', () => {
  it('admin sees everything — no visibility constraints added', async () => {
    const { list } = await import('../services/announcements.service');
    await list(admin, baseQuery);
    const where = announcementFindMany.mock.calls[0][0].where;
    expect(where.AND).toBeUndefined();
    expect(where.deletedAt).toBeNull();
  });

  it('trainee is limited to global + enrolled batches, live window only', async () => {
    const { list } = await import('../services/announcements.service');
    batchTraineeFindMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

    await list(trainee, baseQuery);

    const where = announcementFindMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toEqual([{ batchId: null }, { batchId: { in: ['batch-1'] } }]);
    // scheduled/expiry windows applied
    expect(where.AND).toHaveLength(3);
  });

  it('serializes readByCount from the reads count and per-user isRead', async () => {
    const { list } = await import('../services/announcements.service');
    readFindMany.mockResolvedValueOnce([{ announcementId: 'ann-1' }]);

    const res = (await list(admin, baseQuery)) as { data: { readByCount: number; isRead: boolean }[] };
    expect(res.data[0].readByCount).toBe(3);
    expect(res.data[0].isRead).toBe(true);
  });
});

describe('announcements create permissions', () => {
  const input = { title: 'T', message: 'M', priority: 'Normal', audience: 'All', pinned: false } as never;

  it('forbids a facilitator from posting a global announcement', async () => {
    const { create } = await import('../services/announcements.service');
    const err = await create(facilitator, input).catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it("forbids a facilitator from posting to someone else's batch", async () => {
    const { create } = await import('../services/announcements.service');
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: 'someone-else' });
    const err = await create(facilitator, { ...(input as object), batchId: 'batch-1' } as never).catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it('lets a facilitator post to their own batch', async () => {
    const { create } = await import('../services/announcements.service');
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: facilitator.id });
    announcementCreate.mockResolvedValueOnce({ ...row, batchId: 'batch-1', authorId: facilitator.id });

    const created = await create(facilitator, { ...(input as object), batchId: 'batch-1' } as never);
    expect(created.readByCount).toBe(3);
    expect(announcementCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: facilitator.id, batchId: 'batch-1' }) })
    );
  });
});

describe('announcements update/delete ownership', () => {
  it('forbids a facilitator from editing an announcement they did not author', async () => {
    const { update } = await import('../services/announcements.service');
    announcementFindFirst.mockResolvedValueOnce({ ...row, authorId: 'someone-else' });
    const err = await update(facilitator, 'ann-1', { title: 'New' } as never).catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it('soft-deletes instead of removing the row', async () => {
    const { remove } = await import('../services/announcements.service');
    announcementFindFirst.mockResolvedValueOnce(row);
    announcementUpdate.mockResolvedValueOnce({ ...row, deletedAt: new Date() });

    await remove(admin, 'ann-1');
    expect(announcementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ann-1' }, data: { deletedAt: expect.any(Date) } })
    );
  });
});

describe('mark read', () => {
  it('upserts so a double-read stays a single row', async () => {
    const { markRead } = await import('../services/announcements.service');
    announcementFindFirst.mockResolvedValue(row);
    readUpsert.mockResolvedValue({});

    await markRead(trainee, 'ann-1');
    await markRead(trainee, 'ann-1');

    expect(readUpsert).toHaveBeenCalledTimes(2);
    expect(readUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { announcementId_userId: { announcementId: 'ann-1', userId: trainee.id } },
        update: {}
      })
    );
  });
});
