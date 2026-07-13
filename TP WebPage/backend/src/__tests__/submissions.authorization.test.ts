import { beforeEach, describe, expect, it, vi } from 'vitest';

const submissionFindUnique = vi.fn();
const attachmentFindFirst = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    submission: { findUnique: (...args: unknown[]) => submissionFindUnique(...args) },
    submissionAttachment: { findFirst: (...args: unknown[]) => attachmentFindFirst(...args) }
  }
}));

const submission = {
  id: 'sub-1',
  traineeId: 'trainee-owner',
  assignment: { facilitatorId: 'facilitator-1' }
};
const attachment = { id: 'att-1', submissionId: 'sub-1', storageKey: 'submissions/x.pdf', originalFilename: 'x.pdf' };

describe('submission attachment authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submissionFindUnique.mockResolvedValue(submission);
    attachmentFindFirst.mockResolvedValue(attachment);
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
