import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindMany = vi.fn();
const batchCount = vi.fn();
const batchTraineeGroupBy = vi.fn();
const submissionFindMany = vi.fn();
const attendanceFindMany = vi.fn();
const feedbackGroupBy = vi.fn();
const assignmentFindMany = vi.fn();
const assignmentCount = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    batch: { findMany: (...a: unknown[]) => batchFindMany(...a), count: (...a: unknown[]) => batchCount(...a) },
    batchTrainee: { groupBy: (...a: unknown[]) => batchTraineeGroupBy(...a) },
    submission: { findMany: (...a: unknown[]) => submissionFindMany(...a) },
    attendance: { findMany: (...a: unknown[]) => attendanceFindMany(...a) },
    feedbackEntry: { groupBy: (...a: unknown[]) => feedbackGroupBy(...a) },
    assignment: { findMany: (...a: unknown[]) => assignmentFindMany(...a), count: (...a: unknown[]) => assignmentCount(...a) }
  }
}));

describe('batches.service list (N+1 fix)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes metrics for an entire page of batches with a fixed number of queries, not one per batch', async () => {
    const batches = [
      { id: 'batch-1', code: 'b1', name: 'Batch 1', trainees: [{ trainee: { name: 'Alice' } }, { trainee: { name: 'Bob' } }] },
      { id: 'batch-2', code: 'b2', name: 'Batch 2', trainees: [{ trainee: { name: 'Carol' } }] },
      { id: 'batch-3', code: 'b3', name: 'Batch 3', trainees: [] }
    ];
    batchFindMany.mockResolvedValueOnce(batches);
    batchCount.mockResolvedValueOnce(3);
    batchTraineeGroupBy.mockResolvedValueOnce([
      { batchId: 'batch-1', _count: 2 },
      { batchId: 'batch-2', _count: 1 }
    ]);
    submissionFindMany.mockResolvedValueOnce([
      { grade: '90', status: 'Completed', assignment: { batchId: 'batch-1' } },
      { grade: '80', status: 'Completed', assignment: { batchId: 'batch-1' } },
      { grade: null, status: 'NotStarted', assignment: { batchId: 'batch-1' } },
      { grade: '70', status: 'UnderReview', assignment: { batchId: 'batch-2' } }
    ]);
    attendanceFindMany.mockResolvedValueOnce([
      { status: 'Present', session: { batchId: 'batch-1' } },
      { status: 'Absent', session: { batchId: 'batch-1' } }
    ]);
    feedbackGroupBy.mockResolvedValueOnce([{ batchId: 'batch-1', _avg: { rating: 4.5 } }]);

    const { list } = await import('../services/batches.service');
    const result = await list({ page: 1, pageSize: 20, sortOrder: 'desc', sortBy: 'createdAt' } as never);

    // Exactly one query per relation for the whole page — this is the actual fix under test.
    expect(submissionFindMany).toHaveBeenCalledTimes(1);
    expect(attendanceFindMany).toHaveBeenCalledTimes(1);
    expect(feedbackGroupBy).toHaveBeenCalledTimes(1);
    expect(batchTraineeGroupBy).toHaveBeenCalledTimes(1);

    const batch1 = result.data.find((b: { id: string }) => b.id === 'batch-1') as {
      members: string[];
      metrics: { traineeCount: number; avgScore: number | null; completionPct: number | null; attendanceRate: number | null; feedbackRating: number | null };
    };
    expect(batch1.members).toEqual(['Alice', 'Bob']);
    expect(batch1.metrics.traineeCount).toBe(2);
    expect(batch1.metrics.avgScore).toBe(85); // (90 + 80) / 2
    expect(batch1.metrics.completionPct).toBe(66.67); // 2 of 3 submissions completed
    expect(batch1.metrics.attendanceRate).toBe(50); // 1 of 2 present
    expect(batch1.metrics.feedbackRating).toBe(4.5);

    const batch3 = result.data.find((b: { id: string }) => b.id === 'batch-3') as {
      metrics: { traineeCount: number; avgScore: number | null; completionPct: number | null };
    };
    expect(batch3.metrics.traineeCount).toBe(0);
    expect(batch3.metrics.avgScore).toBeNull();
    expect(batch3.metrics.completionPct).toBeNull(); // 0/0 — no submissions, not a divide-by-zero crash
  });

  it('skips the aggregate queries entirely for an empty page', async () => {
    batchFindMany.mockResolvedValueOnce([]);
    batchCount.mockResolvedValueOnce(0);

    const { list } = await import('../services/batches.service');
    await list({ page: 1, pageSize: 20, sortOrder: 'desc', sortBy: 'createdAt' } as never);

    expect(submissionFindMany).not.toHaveBeenCalled();
    expect(attendanceFindMany).not.toHaveBeenCalled();
  });
});

describe('assignments.service list (N+1 fix)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embeds submissions directly on each assignment instead of requiring a follow-up fetch', async () => {
    const assignments = [
      {
        id: 'assignment-1',
        title: 'Homework 1',
        batches: [{ batch: { id: 'batch-1', name: 'Batch 1', code: 'b1' } }],
        submissions: [
          { id: 'sub-1', status: 'Completed', grade: '95', trainee: { id: 't1', name: 'Alice', email: 'a@x.com' } }
        ]
      }
    ];
    assignmentFindMany.mockResolvedValueOnce(assignments);
    assignmentCount.mockResolvedValueOnce(1);

    const { list } = await import('../services/assignments.service');
    const result = await list({ page: 1, pageSize: 20, sortOrder: 'desc', sortBy: 'createdAt' } as never);

    // The whole point: one query for the page, no per-assignment follow-up.
    expect(assignmentFindMany).toHaveBeenCalledTimes(1);
    expect((result.data[0] as { submissions: unknown[] }).submissions).toHaveLength(1);
  });
});
