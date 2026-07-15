import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionFindFirst = vi.fn();
const formFindUnique = vi.fn();
const formCreate = vi.fn();
const formUpdate = vi.fn();
const submissionCount = vi.fn();
const submissionFindUnique = vi.fn();
const submissionUpsert = vi.fn();
const batchTraineeCount = vi.fn();
const batchTraineeFindUnique = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    session: { findFirst: (...a: unknown[]) => sessionFindFirst(...a) },
    sessionFeedbackForm: {
      findUnique: (...a: unknown[]) => formFindUnique(...a),
      create: (...a: unknown[]) => formCreate(...a),
      update: (...a: unknown[]) => formUpdate(...a)
    },
    sessionFeedbackSubmission: {
      count: (...a: unknown[]) => submissionCount(...a),
      findUnique: (...a: unknown[]) => submissionFindUnique(...a),
      upsert: (...a: unknown[]) => submissionUpsert(...a)
    },
    batchTrainee: {
      count: (...a: unknown[]) => batchTraineeCount(...a),
      findUnique: (...a: unknown[]) => batchTraineeFindUnique(...a)
    }
  }
}));

const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };
const owningFacilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };
const otherFacilitator = { id: 'facilitator-2', email: 'f2@x.com', role: 'facilitator' as const, permissions: [] };
const trainee = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };

const session = { id: 'session-1', batchId: 'batch-1', facilitatorId: 'facilitator-1', deletedAt: null };

describe('sessionFeedback.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets the owning facilitator attach a feedback form', async () => {
    const { attach } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    formFindUnique.mockResolvedValueOnce(null);
    formCreate.mockResolvedValueOnce({ id: 'form-1', sessionId: 'session-1', formUrl: 'https://forms.gle/x' });
    submissionCount.mockResolvedValueOnce(0);
    batchTraineeCount.mockResolvedValueOnce(5);

    const result = await attach(owningFacilitator, 'session-1', { formUrl: 'https://forms.gle/x' });

    expect(formCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sessionId: 'session-1', formUrl: 'https://forms.gle/x', createdBy: owningFacilitator.id } })
    );
    expect(result.submittedCount).toBe(0);
    expect(result.totalTrainees).toBe(5);
  });

  it('blocks a facilitator who does not own the session from attaching a form', async () => {
    const { attach } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);

    const err = await attach(otherFacilitator, 'session-1', { formUrl: 'https://forms.gle/x' }).catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(formCreate).not.toHaveBeenCalled();
  });

  it('rejects attaching a second form to a session that already has one', async () => {
    const { attach } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    formFindUnique.mockResolvedValueOnce({ id: 'form-existing' });

    const err = await attach(admin, 'session-1', { formUrl: 'https://forms.gle/y' }).catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(formCreate).not.toHaveBeenCalled();
  });

  it('404s update() when no form is attached yet', async () => {
    const { update } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    formFindUnique.mockResolvedValueOnce(null);

    const err = await update(admin, 'session-1', { formUrl: 'https://forms.gle/y' }).catch((e) => e);
    expect(err.statusCode).toBe(404);
  });

  it('reports whether the requesting trainee has already submitted', async () => {
    const { getForSession } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', formUrl: 'https://forms.gle/x', audience: 'Trainees' });
    submissionFindUnique.mockResolvedValueOnce({ id: 'submission-1' });
    submissionCount.mockResolvedValueOnce(3);
    batchTraineeCount.mockResolvedValueOnce(10);

    const result = await getForSession(trainee, 'session-1');
    expect(result?.mySubmitted).toBe(true);
  });

  it('blocks a trainee not enrolled in the batch from viewing the form', async () => {
    const { getForSession } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    batchTraineeFindUnique.mockResolvedValueOnce(null);

    const err = await getForSession(trainee, 'session-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it('blocks admins from submitting', async () => {
    const { submit } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);

    const err = await submit(admin, 'session-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(submissionUpsert).not.toHaveBeenCalled();
  });

  it('blocks a trainee from submitting a Facilitators-only form', async () => {
    const { submit } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', audience: 'Facilitators' });

    const err = await submit(trainee, 'session-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(submissionUpsert).not.toHaveBeenCalled();
  });

  it('lets the owning facilitator submit a Facilitators-audience form', async () => {
    const { submit } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', audience: 'Facilitators' });
    submissionUpsert.mockResolvedValueOnce({ id: 'submission-1' });

    await submit(owningFacilitator, 'session-1');

    expect(submissionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId_submitterId: { formId: 'form-1', submitterId: owningFacilitator.id } },
        create: { formId: 'form-1', submitterId: owningFacilitator.id },
        update: {}
      })
    );
  });

  it('submit() is idempotent (upsert, not create)', async () => {
    const { submit } = await import('../services/sessionFeedback.service');
    sessionFindFirst.mockResolvedValueOnce(session);
    batchTraineeFindUnique.mockResolvedValueOnce({ removedAt: null });
    formFindUnique.mockResolvedValueOnce({ id: 'form-1', audience: 'Trainees' });
    submissionUpsert.mockResolvedValueOnce({ id: 'submission-1' });

    await submit(trainee, 'session-1');

    expect(submissionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId_submitterId: { formId: 'form-1', submitterId: trainee.id } },
        create: { formId: 'form-1', submitterId: trainee.id },
        update: {}
      })
    );
  });
});
