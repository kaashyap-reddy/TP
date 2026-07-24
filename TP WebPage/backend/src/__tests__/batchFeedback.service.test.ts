import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindFirst = vi.fn();
const formFindMany = vi.fn();
const formFindFirst = vi.fn();
const formCreate = vi.fn();
const formUpdate = vi.fn();
const formDelete = vi.fn();
const submissionCount = vi.fn();
const submissionFindUnique = vi.fn();
const submissionUpsert = vi.fn();
const traineeCount = vi.fn();
const batchFacilitatorFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: { findFirst: (...a: unknown[]) => batchFindFirst(...a) },
    batchFeedbackForm: {
      findMany: (...a: unknown[]) => formFindMany(...a),
      findFirst: (...a: unknown[]) => formFindFirst(...a),
      create: (...a: unknown[]) => formCreate(...a),
      update: (...a: unknown[]) => formUpdate(...a),
      delete: (...a: unknown[]) => formDelete(...a)
    },
    batchFeedbackSubmission: {
      count: (...a: unknown[]) => submissionCount(...a),
      findUnique: (...a: unknown[]) => submissionFindUnique(...a),
      upsert: (...a: unknown[]) => submissionUpsert(...a)
    },
    batchTrainee: { count: (...a: unknown[]) => traineeCount(...a) },
    // isOnBatchTeam() (facilitatorAssignments.service.ts) queries this table directly.
    batchFacilitator: { findFirst: (...a: unknown[]) => batchFacilitatorFindFirst(...a) }
  }
}));

const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };
const owningFacilitator = { id: 'facilitator-1', email: 'f1@x.com', role: 'facilitator' as const, permissions: [] };
const teamFacilitator = { id: 'facilitator-2', email: 'f2@x.com', role: 'facilitator' as const, permissions: [] };
const outsiderFacilitator = { id: 'facilitator-9', email: 'f9@x.com', role: 'facilitator' as const, permissions: [] };
const trainee = { id: 'trainee-1', email: 't1@x.com', role: 'trainee' as const, permissions: [] };

const batch = { id: 'batch-1', facilitatorId: 'facilitator-1', deletedAt: null };

function form(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'form-1',
    batchId: 'batch-1',
    name: 'Mid-Program Feedback',
    description: '',
    formUrl: 'https://forms.office.com/r/abc',
    formType: 'MidProgramFeedback',
    audience: 'Trainees',
    status: 'Active',
    isRequired: false,
    instructions: null,
    openDate: null,
    dueDate: null,
    createdBy: 'facilitator-1',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides
  };
}

describe('batchFeedback.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchFindFirst.mockResolvedValue(batch);
    batchFacilitatorFindFirst.mockResolvedValue(null);
    traineeCount.mockResolvedValue(10);
    submissionCount.mockResolvedValue(0);
    submissionFindUnique.mockResolvedValue(null);
  });

  describe('list', () => {
    it('a manager (admin) sees Draft and Invalid Link forms', async () => {
      formFindMany.mockResolvedValueOnce([form({ status: 'Draft' }), form({ id: 'form-2', status: 'InvalidLink' })]);

      const { list } = await import('../services/batchFeedback.service');
      const result = await list(admin, 'batch-1');

      expect(result).toHaveLength(2);
    });

    it('a non-manager trainee never sees a Draft or Invalid Link form', async () => {
      formFindMany.mockResolvedValueOnce([
        form({ status: 'Draft' }),
        form({ id: 'form-2', status: 'InvalidLink' }),
        form({ id: 'form-3', status: 'Active' })
      ]);

      const { list } = await import('../services/batchFeedback.service');
      const result = await list(trainee, 'batch-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('form-3');
    });

    it('audience gates visibility — a facilitator-only form is hidden from a trainee', async () => {
      formFindMany.mockResolvedValueOnce([form({ audience: 'Facilitators', status: 'Active' })]);

      const { list } = await import('../services/batchFeedback.service');
      const result = await list(trainee, 'batch-1');

      expect(result).toHaveLength(0);
    });

    it('a facilitator merely on the batch team (not owner) still counts as a manager', async () => {
      batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'bf-1' });
      formFindMany.mockResolvedValueOnce([form({ status: 'Draft' })]);

      const { list } = await import('../services/batchFeedback.service');
      const result = await list(teamFacilitator, 'batch-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    const input = {
      name: 'Final Program Feedback',
      description: '',
      formUrl: 'https://forms.office.com/r/xyz',
      formType: 'Final Program Feedback' as const,
      audience: 'Trainees' as const,
      status: 'Draft' as const,
      isRequired: false
    };

    it('allows Admin to attach a form', async () => {
      formCreate.mockResolvedValueOnce(form());

      const { create } = await import('../services/batchFeedback.service');
      await expect(create(admin, 'batch-1', input)).resolves.toMatchObject({ submittedCount: 0, mySubmitted: null });
      expect(formCreate).toHaveBeenCalled();
    });

    it('denies a facilitator who is not on the batch team', async () => {
      const { create } = await import('../services/batchFeedback.service');
      const err = await create(outsiderFacilitator, 'batch-1', input).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(formCreate).not.toHaveBeenCalled();
    });

    it('allows a facilitator on the batch team (not the cached owner) to attach a form', async () => {
      batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'bf-1' });
      formCreate.mockResolvedValueOnce(form());

      const { create } = await import('../services/batchFeedback.service');
      await expect(create(teamFacilitator, 'batch-1', input)).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('denies a non-manager facilitator', async () => {
      formFindFirst.mockResolvedValueOnce(form());

      const { update } = await import('../services/batchFeedback.service');
      const err = await update(outsiderFacilitator, 'batch-1', 'form-1', { status: 'Closed' }).catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(formUpdate).not.toHaveBeenCalled();
    });

    it('allows the owning facilitator to edit', async () => {
      formFindFirst.mockResolvedValueOnce(form());
      formUpdate.mockResolvedValueOnce(form({ status: 'Closed' }));

      const { update } = await import('../services/batchFeedback.service');
      await expect(update(owningFacilitator, 'batch-1', 'form-1', { status: 'Closed' })).resolves.toBeDefined();
    });

    it('404s on a form that does not belong to this batch', async () => {
      formFindFirst.mockResolvedValueOnce(null);

      const { update } = await import('../services/batchFeedback.service');
      const err = await update(admin, 'batch-1', 'form-ghost', { status: 'Closed' }).catch((e) => e);

      expect(err.statusCode).toBe(404);
    });
  });

  describe('remove', () => {
    it('is admin-only — even the owning/managing facilitator is denied', async () => {
      formFindFirst.mockResolvedValueOnce(form());

      const { remove } = await import('../services/batchFeedback.service');
      const err = await remove(owningFacilitator, 'batch-1', 'form-1').catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(formDelete).not.toHaveBeenCalled();
    });

    it('allows Admin to delete', async () => {
      formFindFirst.mockResolvedValueOnce(form());

      const { remove } = await import('../services/batchFeedback.service');
      await remove(admin, 'batch-1', 'form-1');

      expect(formDelete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
    });
  });

  describe('submit', () => {
    it('rejects a submitter whose role does not match the form audience', async () => {
      formFindFirst.mockResolvedValueOnce(form({ audience: 'Facilitators' }));

      const { submit } = await import('../services/batchFeedback.service');
      const err = await submit(trainee, 'batch-1', 'form-1').catch((e) => e);

      expect(err.statusCode).toBe(403);
      expect(submissionUpsert).not.toHaveBeenCalled();
    });

    it('is idempotent — upserts rather than duplicating a submission', async () => {
      formFindFirst.mockResolvedValueOnce(form({ audience: 'Trainees' }));
      submissionUpsert.mockResolvedValueOnce({ id: 'sub-1', formId: 'form-1', submitterId: 'trainee-1' });

      const { submit } = await import('../services/batchFeedback.service');
      await submit(trainee, 'batch-1', 'form-1');

      expect(submissionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { formId_submitterId: { formId: 'form-1', submitterId: 'trainee-1' } },
          create: { formId: 'form-1', submitterId: 'trainee-1' },
          update: {}
        })
      );
    });
  });
});
