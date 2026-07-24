import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationFindMany = vi.fn();
const notificationCount = vi.fn();
const notificationUpdateMany = vi.fn();
const notificationCreate = vi.fn();
const notificationCreateMany = vi.fn();
const batchTraineeFindMany = vi.fn();
const batchFindFirst = vi.fn();
const userFindMany = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    notification: {
      findMany: (...args: unknown[]) => notificationFindMany(...args),
      count: (...args: unknown[]) => notificationCount(...args),
      updateMany: (...args: unknown[]) => notificationUpdateMany(...args),
      create: (...args: unknown[]) => notificationCreate(...args),
      createMany: (...args: unknown[]) => notificationCreateMany(...args)
    },
    batchTrainee: { findMany: (...args: unknown[]) => batchTraineeFindMany(...args) },
    batch: { findFirst: (...args: unknown[]) => batchFindFirst(...args) },
    user: { findMany: (...args: unknown[]) => userFindMany(...args) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

describe('notifications authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('list()', () => {
    it("scopes every query to the caller's own recipientId, never another user's", async () => {
      const { list } = await import('../services/notifications.service');
      notificationFindMany.mockResolvedValue([]);
      notificationCount.mockResolvedValue(0);

      await list('trainee-a', { page: 1, pageSize: 20, unreadOnly: false });

      expect(notificationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: 'trainee-a' } }));
      expect(notificationCount).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: 'trainee-a' } }));
      // No call anywhere asks for a different user's id or omits the recipientId filter entirely.
      for (const call of notificationFindMany.mock.calls) {
        expect(call[0].where.recipientId).toBe('trainee-a');
      }
    });

    it('adds an unread-only filter without weakening the recipient scope', async () => {
      const { list } = await import('../services/notifications.service');
      notificationFindMany.mockResolvedValue([]);
      notificationCount.mockResolvedValue(0);

      await list('trainee-a', { page: 1, pageSize: 20, unreadOnly: true });

      expect(notificationFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: 'trainee-a', readAt: null } }));
    });
  });

  describe('markRead() / markAllRead()', () => {
    it("markRead can only touch the caller's own notification, never someone else's by id", async () => {
      const { markRead } = await import('../services/notifications.service');
      notificationUpdateMany.mockResolvedValue({ count: 0 });

      await markRead('trainee-a', 'notif-belonging-to-trainee-b');

      expect(notificationUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'notif-belonging-to-trainee-b', recipientId: 'trainee-a', readAt: null } })
      );
      // updateMany with a recipientId mismatch matches zero rows -- it can never mark, or even
      // confirm the existence of, another user's notification.
    });

    it('markAllRead only ever scopes by the caller', async () => {
      const { markAllRead } = await import('../services/notifications.service');
      notificationUpdateMany.mockResolvedValue({ count: 3 });

      await markAllRead('trainee-a');

      expect(notificationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: 'trainee-a', readAt: null } }));
    });
  });

  describe('notifyBatch()', () => {
    it('only notifies trainees currently enrolled (excludes soft-removed enrollments)', async () => {
      const { notifyBatch } = await import('../services/notifications.service');
      batchTraineeFindMany.mockResolvedValue([{ traineeId: 'trainee-active' }]);

      await notifyBatch('batch-1', { type: 'Test', title: 't', message: 'm' }, { trainees: true });

      expect(batchTraineeFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { batchId: 'batch-1', removedAt: null } }));
      expect(notificationCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ recipientId: 'trainee-active' })] });
    });

    it("notifies the batch's current facilitator when requested", async () => {
      const { notifyBatch } = await import('../services/notifications.service');
      batchTraineeFindMany.mockResolvedValue([]);
      batchFindFirst.mockResolvedValue({ facilitatorId: 'facilitator-1' });

      await notifyBatch('batch-1', { type: 'Test', title: 't', message: 'm' }, { facilitator: true });

      expect(notificationCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ recipientId: 'facilitator-1' })] });
    });

    it('sends nothing when the batch has no facilitator and trainees are not requested', async () => {
      const { notifyBatch } = await import('../services/notifications.service');
      batchFindFirst.mockResolvedValue({ facilitatorId: null });

      await notifyBatch('batch-1', { type: 'Test', title: 't', message: 'm' }, { facilitator: true });

      expect(notificationCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('notifyRole()', () => {
    it('fans out only to users with the given role, not other roles', async () => {
      const { notifyRole } = await import('../services/notifications.service');
      userFindMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      await notifyRole('admin', { type: 'Test', title: 't', message: 'm' });

      expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: { name: 'admin' } }) }));
      expect(notificationCreateMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ recipientId: 'admin-1' }), expect.objectContaining({ recipientId: 'admin-2' })]
      });
    });
  });
});
