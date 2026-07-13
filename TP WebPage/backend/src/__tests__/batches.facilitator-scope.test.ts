import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindFirst = vi.fn();
const batchFindMany = vi.fn();
const batchCount = vi.fn();
const batchTraineeFindMany = vi.fn();
const batchTraineeCount = vi.fn();
const assignmentFindMany = vi.fn();
const submissionAggregate = vi.fn();
const submissionCount = vi.fn();
const attendanceFindMany = vi.fn();
const attendanceCount = vi.fn();
const feedbackEntryFindMany = vi.fn();
const feedbackEntryAggregate = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: {
      findFirst: (...a: unknown[]) => batchFindFirst(...a),
      findMany: (...a: unknown[]) => batchFindMany(...a),
      count: (...a: unknown[]) => batchCount(...a)
    },
    batchTrainee: {
      findMany: (...a: unknown[]) => batchTraineeFindMany(...a),
      count: (...a: unknown[]) => batchTraineeCount(...a)
    },
    assignment: { findMany: (...a: unknown[]) => assignmentFindMany(...a) },
    submission: {
      aggregate: (...a: unknown[]) => submissionAggregate(...a),
      count: (...a: unknown[]) => submissionCount(...a)
    },
    attendance: {
      findMany: (...a: unknown[]) => attendanceFindMany(...a),
      count: (...a: unknown[]) => attendanceCount(...a)
    },
    feedbackEntry: {
      findMany: (...a: unknown[]) => feedbackEntryFindMany(...a),
      aggregate: (...a: unknown[]) => feedbackEntryAggregate(...a)
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

const batchQuery = { page: 1, pageSize: 20, sortOrder: 'desc' as const, sortBy: 'createdAt' as const, search: undefined };
const traineesQuery = { page: 1, pageSize: 20, search: undefined };

const ownedBatch = { id: 'batch-1', facilitatorId: 'facilitator-1', deletedAt: null };
const facilitatorOwner = { id: 'facilitator-1', email: 'owner@x.com', role: 'facilitator' as const, permissions: [] };
const facilitatorOutsider = { id: 'facilitator-2', email: 'outsider@x.com', role: 'facilitator' as const, permissions: [] };
const admin = { id: 'admin-1', email: 'admin@x.com', role: 'admin' as const, permissions: [] };
const trainee = { id: 'trainee-1', email: 'trainee@x.com', role: 'trainee' as const, permissions: [] };

function pctRounded(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 10000) / 100;
}

describe('batches.service — facilitator batch scoping', () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() scopes the query to only the given facilitator's batches", async () => {
    batchFindMany.mockResolvedValueOnce([]);
    batchCount.mockResolvedValueOnce(0);

    const { list } = await import('../services/batches.service');
    await list({ ...batchQuery, facilitatorId: 'facilitator-1' } as never);

    const whereArg = batchFindMany.mock.calls[0][0].where;
    expect(whereArg.facilitatorId).toBe('facilitator-1');
  });

  describe('getMetrics', () => {
    it('denies a facilitator who does not own the batch', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);

      const { getMetrics } = await import('../services/batches.service');
      const err = await getMetrics(facilitatorOutsider, 'batch-1').catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(batchTraineeCount).not.toHaveBeenCalled();
    });

    it('allows the owning facilitator', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);
      batchTraineeCount.mockResolvedValueOnce(2);
      submissionAggregate.mockResolvedValueOnce({ _avg: { grade: null } });
      submissionCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      attendanceCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      feedbackEntryAggregate.mockResolvedValueOnce({ _avg: { rating: null } });

      const { getMetrics } = await import('../services/batches.service');
      const metrics = await getMetrics(facilitatorOwner, 'batch-1');

      expect(metrics.traineeCount).toBe(2);
    });

    it('does not restrict admin', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);
      batchTraineeCount.mockResolvedValueOnce(0);
      submissionAggregate.mockResolvedValueOnce({ _avg: { grade: null } });
      submissionCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      attendanceCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      feedbackEntryAggregate.mockResolvedValueOnce({ _avg: { rating: null } });

      const { getMetrics } = await import('../services/batches.service');
      await expect(getMetrics(admin, 'batch-1')).resolves.toBeDefined();
    });
  });

  describe('listTrainees', () => {
    it('denies a facilitator who does not own the batch', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);

      const { listTrainees } = await import('../services/batches.service');
      const err = await listTrainees(facilitatorOutsider, 'batch-1', traineesQuery as never).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(batchTraineeFindMany).not.toHaveBeenCalled();
    });

    it('allows the owning facilitator', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);
      batchTraineeFindMany.mockResolvedValueOnce([]);
      batchTraineeCount.mockResolvedValueOnce(0);

      const { listTrainees } = await import('../services/batches.service');
      await listTrainees(facilitatorOwner, 'batch-1', traineesQuery as never);

      expect(batchTraineeFindMany).toHaveBeenCalled();
    });
  });

  describe('listTraineeStats', () => {
    it('denies a facilitator who does not own the batch, without querying trainees', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);

      const { listTraineeStats } = await import('../services/batches.service');
      const err = await listTraineeStats(facilitatorOutsider, 'batch-1').catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(batchTraineeFindMany).not.toHaveBeenCalled();
    });

    it('denies a trainee outright, even one enrolled in the batch', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);

      const { listTraineeStats } = await import('../services/batches.service');
      const err = await listTraineeStats(trainee, 'batch-1').catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(batchTraineeFindMany).not.toHaveBeenCalled();
    });

    it('returns only the trainees enrolled in that specific batch, not unrelated batches', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);
      batchTraineeFindMany.mockResolvedValueOnce([
        { traineeId: 'trainee-a', trainee: { id: 'trainee-a', name: 'Trainee A', email: 'a@x.com' } },
        { traineeId: 'trainee-b', trainee: { id: 'trainee-b', name: 'Trainee B', email: 'b@x.com' } }
      ]);
      assignmentFindMany.mockResolvedValueOnce([]);
      attendanceFindMany.mockResolvedValueOnce([]);
      feedbackEntryFindMany.mockResolvedValueOnce([]);

      const { listTraineeStats } = await import('../services/batches.service');
      const result = await listTraineeStats(facilitatorOwner, 'batch-1');

      expect(result.map((r) => r.id).sort()).toEqual(['trainee-a', 'trainee-b']);
      // Membership is enforced by scoping batchTrainee.findMany to this batch, not fetched globally.
      expect(batchTraineeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ batchId: 'batch-1', removedAt: null }) })
      );
    });

    it('calculates attendance %, completed/pending assignments, avg grade, and feedback-given correctly', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);
      batchTraineeFindMany.mockResolvedValueOnce([
        { traineeId: 'trainee-a', trainee: { id: 'trainee-a', name: 'Trainee A', email: 'a@x.com' } }
      ]);
      assignmentFindMany.mockResolvedValueOnce([
        { submissions: [{ traineeId: 'trainee-a', status: 'Completed', grade: 90, submittedAt: new Date('2026-07-01') }] },
        { submissions: [{ traineeId: 'trainee-a', status: 'Completed', grade: 80, submittedAt: new Date('2026-07-05') }] },
        { submissions: [] } // a 3rd assignment this trainee hasn't submitted -> counts toward "pending"
      ]);
      attendanceFindMany.mockResolvedValueOnce([
        { traineeId: 'trainee-a', status: 'Present' },
        { traineeId: 'trainee-a', status: 'Present' },
        { traineeId: 'trainee-a', status: 'Absent' },
        { traineeId: 'trainee-a', status: 'Present' }
      ]);
      feedbackEntryFindMany.mockResolvedValueOnce([{ traineeId: 'trainee-a' }]);

      const { listTraineeStats } = await import('../services/batches.service');
      const [stats] = await listTraineeStats(facilitatorOwner, 'batch-1');

      expect(stats.assignmentsCompleted).toBe(2);
      expect(stats.assignmentsPending).toBe(1); // 3 assignments total, 2 completed
      expect(stats.avgGrade).toBe(85); // (90 + 80) / 2
      expect(stats.attendancePercentage).toBe(75); // 3 present / 4 records
      expect(stats.overallProgress).toBe(pctRounded(2, 3));
      expect(stats.latestSubmissionStatus).toBe('Completed');
      expect(stats.feedbackGiven).toBe(true);
    });

    it('does not restrict admin', async () => {
      batchFindFirst.mockResolvedValueOnce(ownedBatch);
      batchTraineeFindMany.mockResolvedValueOnce([]);

      const { listTraineeStats } = await import('../services/batches.service');
      const result = await listTraineeStats(admin, 'batch-1');

      expect(result).toEqual([]);
    });
  });
});
