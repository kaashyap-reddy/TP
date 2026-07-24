import { beforeEach, describe, expect, it, vi } from 'vitest';

const assignmentFindFirst = vi.fn();
const formFindUnique = vi.fn();
const formCreate = vi.fn();
const formUpdate = vi.fn();
const submissionCount = vi.fn();
const submissionFindUnique = vi.fn();
const submissionUpsert = vi.fn();
const batchTraineeCount = vi.fn();
const batchTraineeFindFirst = vi.fn();
const batchFacilitatorFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    assignment: { findFirst: (...a: unknown[]) => assignmentFindFirst(...a) },
    assignmentFeedbackForm: {
      findUnique: (...a: unknown[]) => formFindUnique(...a),
      create: (...a: unknown[]) => formCreate(...a),
      update: (...a: unknown[]) => formUpdate(...a)
    },
    assignmentFeedbackSubmission: {
      count: (...a: unknown[]) => submissionCount(...a),
      findUnique: (...a: unknown[]) => submissionFindUnique(...a),
      upsert: (...a: unknown[]) => submissionUpsert(...a)
    },
    batchTrainee: {
      count: (...a: unknown[]) => batchTraineeCount(...a),
      findFirst: (...a: unknown[]) => batchTraineeFindFirst(...a)
    },
    // assertOwnerOrAdmin/getForAssignment widen facilitator ownership to active batch-team
    // membership via isOnAnyBatchTeam(), which queries this table.
    batchFacilitator: { findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a) }
  }
}));

const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };
const owningFacilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };
const otherFacilitator = { id: 'facilitator-2', email: 'f2@x.com', role: 'facilitator' as const, permissions: [] };
const trainee = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };

const assignment = {
  id: 'assignment-1',
  batchId: 'batch-1',
  facilitatorId: 'facilitator-1',
  deletedAt: null,
  batches: [{ batchId: 'batch-1' }, { batchId: 'batch-2' }]
};

describe('assignmentFeedback.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

  it('lets the owning facilitator attach a feedback form', async () => {
    const { attach } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    formFindUnique.mockResolvedValueOnce(null);
    formCreate.mockResolvedValueOnce({ id: 'form-1', assignmentId: 'assignment-1', formUrl: 'https://forms.gle/x' });
    submissionCount.mockResolvedValueOnce(0);
    batchTraineeCount.mockResolvedValueOnce(8);

    const result = await attach(owningFacilitator, 'assignment-1', { formUrl: 'https://forms.gle/x' } as never);

    expect(formCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignmentId: 'assignment-1', formUrl: 'https://forms.gle/x', createdBy: owningFacilitator.id }) })
    );
    expect(result.submittedCount).toBe(0);
    expect(result.totalTrainees).toBe(8);
  });

  it('counts totalTrainees across every batch the assignment is assigned to', async () => {
    const { attach } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    formFindUnique.mockResolvedValueOnce(null);
    formCreate.mockResolvedValueOnce({ id: 'form-1' });
    submissionCount.mockResolvedValueOnce(0);
    batchTraineeCount.mockResolvedValueOnce(8);

    await attach(admin, 'assignment-1', { formUrl: 'https://forms.gle/x' } as never);

    expect(batchTraineeCount).toHaveBeenCalledWith({
      where: { batchId: { in: ['batch-1', 'batch-2'] }, removedAt: null }
    });
  });

  it('blocks a facilitator who does not own the assignment from attaching a form', async () => {
    const { attach } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);

    const err = await attach(otherFacilitator, 'assignment-1', { formUrl: 'https://forms.gle/x' } as never).catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(formCreate).not.toHaveBeenCalled();
  });

  it('allows a non-owning facilitator who is an active team member of one of the assignment batches', async () => {
    const { attach } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    formFindUnique.mockResolvedValueOnce(null);
    formCreate.mockResolvedValueOnce({ id: 'form-1' });
    submissionCount.mockResolvedValueOnce(0);
    batchTraineeCount.mockResolvedValueOnce(8);
    batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });

    await expect(attach(otherFacilitator, 'assignment-1', { formUrl: 'https://forms.gle/x' } as never)).resolves.toBeDefined();
    expect(formCreate).toHaveBeenCalled();
  });

  it('rejects attaching a second form to an assignment that already has one', async () => {
    const { attach } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    formFindUnique.mockResolvedValueOnce({ id: 'form-existing' });

    const err = await attach(admin, 'assignment-1', { formUrl: 'https://forms.gle/y' } as never).catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(formCreate).not.toHaveBeenCalled();
  });

  it('404s update() when no form is attached yet', async () => {
    const { update } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    formFindUnique.mockResolvedValueOnce(null);

    const err = await update(admin, 'assignment-1', { formUrl: 'https://forms.gle/y' } as never).catch((e) => e);
    expect(err.statusCode).toBe(404);
  });

  it('reports whether the requesting trainee has already submitted', async () => {
    const { getForAssignment } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    batchTraineeFindFirst.mockResolvedValueOnce({ id: 'enrollment-1' });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', formUrl: 'https://forms.gle/x', audience: 'Trainees' });
    submissionFindUnique.mockResolvedValueOnce({ id: 'submission-1' });
    submissionCount.mockResolvedValueOnce(3);
    batchTraineeCount.mockResolvedValueOnce(10);

    const result = await getForAssignment(trainee, 'assignment-1');
    expect(result?.mySubmitted).toBe(true);
  });

  it('blocks a trainee not enrolled in any of the assignment batches from viewing the form', async () => {
    const { getForAssignment } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    batchTraineeFindFirst.mockResolvedValueOnce(null);

    const err = await getForAssignment(trainee, 'assignment-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it('hides a Facilitators-only form from an enrolled trainee', async () => {
    const { getForAssignment } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    batchTraineeFindFirst.mockResolvedValueOnce({ id: 'enrollment-1' });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', audience: 'Facilitators' });

    const result = await getForAssignment(trainee, 'assignment-1');
    expect(result).toBeNull();
  });

  it('blocks admins from submitting', async () => {
    const { submit } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);

    const err = await submit(admin, 'assignment-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(submissionUpsert).not.toHaveBeenCalled();
  });

  it('blocks a trainee from submitting a Facilitators-only form', async () => {
    const { submit } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    batchTraineeFindFirst.mockResolvedValueOnce({ id: 'enrollment-1' });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', audience: 'Facilitators' });

    const err = await submit(trainee, 'assignment-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(submissionUpsert).not.toHaveBeenCalled();
  });

  it('submit() is idempotent (upsert, not create)', async () => {
    const { submit } = await import('../services/assignmentFeedback.service');
    assignmentFindFirst.mockResolvedValueOnce(assignment);
    batchTraineeFindFirst.mockResolvedValueOnce({ id: 'enrollment-1' });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', audience: 'Trainees' });
    submissionUpsert.mockResolvedValueOnce({ id: 'submission-1' });

    await submit(trainee, 'assignment-1');

    expect(submissionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId_submitterId: { formId: 'form-1', submitterId: trainee.id } },
        create: { formId: 'form-1', submitterId: trainee.id },
        update: {}
      })
    );
  });
});
