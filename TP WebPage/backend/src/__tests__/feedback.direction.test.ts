import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchTraineeFindUnique = vi.fn();
const batchFindFirst = vi.fn();
const feedbackEntryCreate = vi.fn();
const feedbackEntryFindMany = vi.fn();
const feedbackEntryCount = vi.fn();
const batchFacilitatorFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batchTrainee: { findUnique: (...a: unknown[]) => batchTraineeFindUnique(...a) },
    batch: { findFirst: (...a: unknown[]) => batchFindFirst(...a) },
    feedbackEntry: {
      create: (...a: unknown[]) => feedbackEntryCreate(...a),
      findMany: (...a: unknown[]) => feedbackEntryFindMany(...a),
      count: (...a: unknown[]) => feedbackEntryCount(...a)
    },
    // create()'s facilitator/admin branch widens ownership to active batch-team membership via
    // isOnBatchTeam(), which queries this table.
    batchFacilitator: { findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops)
  }
}));

const trainee = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };
const facilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };

describe('feedback.service — bidirectional feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

  it('lets a trainee submit feedback about the facilitator assigned to their batch', async () => {
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: 'facilitator-1', deletedAt: null });
    feedbackEntryCreate.mockResolvedValueOnce({ id: 'fb-1', direction: 'TraineeToFacilitator', rating: 5 });

    const { create } = await import('../services/feedback.service');
    const result = await create(trainee, {
      batchId: 'batch-1',
      facilitatorId: 'facilitator-1',
      category: 'Teaching',
      rating: 5,
      comment: 'Great mentor'
    });

    expect(feedbackEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ traineeId: trainee.id, facilitatorId: 'facilitator-1', direction: 'TraineeToFacilitator' })
      })
    );
    expect(result.direction).toBe('TraineeToFacilitator');
  });

  it('blocks a trainee from giving feedback about a facilitator not assigned to their batch', async () => {
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: 'someone-else', deletedAt: null });

    const { create } = await import('../services/feedback.service');
    const err = await create(trainee, {
      batchId: 'batch-1',
      facilitatorId: 'facilitator-1',
      category: 'Teaching',
      rating: 5
    }).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(feedbackEntryCreate).not.toHaveBeenCalled();
  });

  it('blocks a trainee from giving feedback in a batch they are not enrolled in', async () => {
    batchTraineeFindUnique.mockResolvedValueOnce(null);

    const { create } = await import('../services/feedback.service');
    const err = await create(trainee, {
      batchId: 'batch-1',
      facilitatorId: 'facilitator-1',
      category: 'Teaching',
      rating: 5
    }).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(feedbackEntryCreate).not.toHaveBeenCalled();
  });

  it('keeps facilitator-authored feedback about a trainee working as before (direction stamped automatically)', async () => {
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: facilitator.id, deletedAt: null });
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    feedbackEntryCreate.mockResolvedValueOnce({ id: 'fb-2', direction: 'FacilitatorToTrainee', rating: 4 });

    const { create } = await import('../services/feedback.service');
    const result = await create(facilitator, {
      batchId: 'batch-1',
      traineeId: 'trainee-1',
      category: 'Technical Skills',
      rating: 4
    });

    expect(feedbackEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ facilitatorId: facilitator.id, traineeId: 'trainee-1', direction: 'FacilitatorToTrainee' })
      })
    );
    expect(result.direction).toBe('FacilitatorToTrainee');
  });

  it('denies a facilitator with no relationship to the batch from authoring feedback about a trainee (previously unchecked)', async () => {
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: 'someone-else', deletedAt: null });

    const { create } = await import('../services/feedback.service');
    const err = await create(facilitator, {
      batchId: 'batch-1',
      traineeId: 'trainee-1',
      category: 'Technical Skills',
      rating: 4
    }).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(feedbackEntryCreate).not.toHaveBeenCalled();
  });

  it('allows a non-owning facilitator who is an active team member to author feedback about a trainee', async () => {
    batchFindFirst.mockResolvedValueOnce({ id: 'batch-1', facilitatorId: 'someone-else', deletedAt: null });
    batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    feedbackEntryCreate.mockResolvedValueOnce({ id: 'fb-3', direction: 'FacilitatorToTrainee', rating: 4 });

    const { create } = await import('../services/feedback.service');
    const result = await create(facilitator, {
      batchId: 'batch-1',
      traineeId: 'trainee-1',
      category: 'Technical Skills',
      rating: 4
    });

    expect(result.direction).toBe('FacilitatorToTrainee');
  });

  it("forces a trainee's list query to their own traineeId regardless of what was requested (no snooping on other trainees)", async () => {
    feedbackEntryFindMany.mockResolvedValueOnce([]);
    feedbackEntryCount.mockResolvedValueOnce(0);

    const { list } = await import('../services/feedback.service');
    await list(trainee, {
      traineeId: 'someone-elses-id',
      page: 1,
      pageSize: 20,
      sortOrder: 'desc',
      sortBy: 'createdAt'
    } as never);

    expect(feedbackEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ traineeId: trainee.id }) })
    );
  });
});
