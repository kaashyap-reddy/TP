import { beforeEach, describe, expect, it, vi } from 'vitest';

const assignmentFindMany = vi.fn();
const assignmentCount = vi.fn();
const assignmentFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    assignment: {
      findMany: (...a: unknown[]) => assignmentFindMany(...a),
      count: (...a: unknown[]) => assignmentCount(...a),
      findFirst: (...a: unknown[]) => assignmentFindFirst(...a)
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

const rawAssignment = {
  id: 'assignment-1',
  title: 'Case Study',
  facilitatorId: 'facilitator-1',
  sessionId: 'session-1',
  session: { id: 'session-1', title: 'Requirements Workshop' },
  batch: { id: 'batch-1', name: 'BA BTech - July 2026', code: 'ba-btech-1', trainingPlan: { id: 'plan-1', name: 'BA BTech' } },
  batches: [
    {
      batch: {
        id: 'batch-1',
        name: 'BA BTech - July 2026',
        code: 'ba-btech-1',
        trainingPlan: { id: 'plan-1', name: 'BA BTech' }
      }
    }
  ],
  attachmentStorageKey: null,
  submissions: []
};

describe('assignments.service — simplified response shape (no per-facilitator ownership column)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never asks Prisma to join the facilitator on list()', async () => {
    assignmentFindMany.mockResolvedValueOnce([rawAssignment]);
    assignmentCount.mockResolvedValueOnce(1);

    const { list } = await import('../services/assignments.service');
    await list({ page: 1, pageSize: 20, sortOrder: 'desc', sortBy: 'deadline' } as never);

    const [[callArgs]] = assignmentFindMany.mock.calls;
    expect(callArgs.include).not.toHaveProperty('facilitator');
    expect(callArgs.include).toHaveProperty('session');
  });

  it('surfaces the related session and each batch’s Training Plan instead of a facilitator', async () => {
    assignmentFindFirst.mockResolvedValueOnce(rawAssignment);

    const { getById } = await import('../services/assignments.service');
    const result = await getById('assignment-1');

    expect(result).not.toHaveProperty('facilitator');
    expect(result.session).toEqual({ id: 'session-1', title: 'Requirements Workshop' });
    expect(result.batches[0].trainingPlan).toEqual({ id: 'plan-1', name: 'BA BTech' });
  });
});
