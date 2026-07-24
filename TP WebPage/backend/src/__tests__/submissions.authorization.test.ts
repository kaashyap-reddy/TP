import { beforeEach, describe, expect, it, vi } from 'vitest';

const submissionFindUnique = vi.fn();
const attachmentFindFirst = vi.fn();
const assignmentFindFirst = vi.fn();
const batchTraineeFindMany = vi.fn();
const submissionFindMany = vi.fn();
const batchFacilitatorFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => submissionFindUnique(...args),
      findMany: (...args: unknown[]) => submissionFindMany(...args)
    },
    submissionAttachment: { findFirst: (...args: unknown[]) => attachmentFindFirst(...args) },
    assignment: { findFirst: (...args: unknown[]) => assignmentFindFirst(...args) },
    batchTrainee: { findMany: (...args: unknown[]) => batchTraineeFindMany(...args) },
    // assertCanManage widens facilitator ownership to active batch-team membership via
    // isOnAnyBatchTeam(), which queries this table.
    batchFacilitator: { findFirst: (...args: unknown[]) => batchFacilitatorFindFirst(...args) }
  }
}));

const submission = {
  id: 'sub-1',
  traineeId: 'trainee-owner',
  assignment: { facilitatorId: 'facilitator-1', batches: [{ batchId: 'batch-1' }] }
};
const attachment = { id: 'att-1', submissionId: 'sub-1', storageKey: 'submissions/x.pdf', originalFilename: 'x.pdf' };

describe('submission attachment authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submissionFindUnique.mockResolvedValue(submission);
    attachmentFindFirst.mockResolvedValue(attachment);
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

  it('denies a trainee who does not own the submission', async () => {
    const { getAttachmentForDownload } = await import('../services/submissions.service');
    const otherTrainee = { id: 'trainee-other', email: 'x@x.com', role: 'trainee' as const, permissions: [] };

    const err = await getAttachmentForDownload(otherTrainee, 'sub-1', 'att-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it('denies a facilitator who does not own the assignment', async () => {
    const { getAttachmentForDownload } = await import('../services/submissions.service');
    const otherFacilitator = { id: 'facilitator-2', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };

    const err = await getAttachmentForDownload(otherFacilitator, 'sub-1', 'att-1').catch((e) => e);
    expect(err.statusCode).toBe(403);
  });

  it('allows a non-owning facilitator who is an active team member of the assignment batch', async () => {
    const { getAttachmentForDownload } = await import('../services/submissions.service');
    const teamFacilitator = { id: 'facilitator-2', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };
    batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });

    const result = await getAttachmentForDownload(teamFacilitator, 'sub-1', 'att-1');
    expect(result.id).toBe('att-1');
  });

  it('allows the owning trainee', async () => {
    const { getAttachmentForDownload } = await import('../services/submissions.service');
    const owner = { id: 'trainee-owner', email: 't@x.com', role: 'trainee' as const, permissions: [] };

    const result = await getAttachmentForDownload(owner, 'sub-1', 'att-1');
    expect(result.id).toBe('att-1');
  });

  it('allows an admin regardless of ownership', async () => {
    const { getAttachmentForDownload } = await import('../services/submissions.service');
    const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };

    const result = await getAttachmentForDownload(admin, 'sub-1', 'att-1');
    expect(result.id).toBe('att-1');
  });
});

describe('submissions.service — listForAssignment authorization', () => {
  const assignment = { id: 'assignment-1', facilitatorId: 'facilitator-1', batchId: 'batch-1', batches: [{ batchId: 'batch-1' }] };
  const query = { page: 1, pageSize: 20, sortOrder: 'desc' as const, sortBy: 'submittedAt' };

  beforeEach(() => {
    vi.clearAllMocks();
    assignmentFindFirst.mockResolvedValue(assignment);
    batchTraineeFindMany.mockResolvedValue([]);
    submissionFindMany.mockResolvedValue([]);
    batchFacilitatorFindFirst.mockResolvedValue(null);
  });

  it('denies an unrelated facilitator (previously unrestricted)', async () => {
    const { listForAssignment } = await import('../services/submissions.service');
    const outsider = { id: 'facilitator-9', email: 'x@x.com', role: 'facilitator' as const, permissions: [] };

    const err = await listForAssignment(outsider, 'assignment-1', query).catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(batchTraineeFindMany).not.toHaveBeenCalled();
  });

  it('denies a trainee at the service layer too, defense-in-depth alongside the route-level requireRole', async () => {
    const { listForAssignment } = await import('../services/submissions.service');
    const trainee = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };

    const err = await listForAssignment(trainee, 'assignment-1', query).catch((e) => e);
    expect(err.statusCode).toBe(403);
    expect(batchTraineeFindMany).not.toHaveBeenCalled();
  });

  it('allows the owning facilitator', async () => {
    const { listForAssignment } = await import('../services/submissions.service');
    const owner = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };

    await expect(listForAssignment(owner, 'assignment-1', query)).resolves.toBeDefined();
  });

  it('allows a non-owning facilitator who is an active team member', async () => {
    const { listForAssignment } = await import('../services/submissions.service');
    const teamMember = { id: 'facilitator-2', email: 'f2@x.com', role: 'facilitator' as const, permissions: [] };
    batchFacilitatorFindFirst.mockResolvedValueOnce({ id: 'assignment-row', status: 'Active' });

    await expect(listForAssignment(teamMember, 'assignment-1', query)).resolves.toBeDefined();
  });

  it('allows admin unconditionally', async () => {
    const { listForAssignment } = await import('../services/submissions.service');
    const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };

    await expect(listForAssignment(admin, 'assignment-1', query)).resolves.toBeDefined();
  });
});
