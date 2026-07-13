import { beforeEach, describe, expect, it, vi } from 'vitest';

const submissionFindUnique = vi.fn();
const submissionAttachmentUpdateMany = vi.fn();
const submissionAttachmentCreate = vi.fn();
const storageSave = vi.fn();
const storageRemove = vi.fn();
const transaction = vi.fn(async (fn: (tx: unknown) => unknown) =>
  fn({ submissionAttachment: { updateMany: submissionAttachmentUpdateMany, create: submissionAttachmentCreate } })
);

vi.mock('../prisma/client', () => ({
  prisma: {
    submission: { findUnique: (...a: unknown[]) => submissionFindUnique(...a) },
    $transaction: (...a: unknown[]) => transaction(a[0] as never)
  }
}));

vi.mock('../services/storage', () => ({
  getStorageProvider: () => ({ save: (...a: unknown[]) => storageSave(...a), remove: (...a: unknown[]) => storageRemove(...a) })
}));

const owner = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };
const fakeFile = { originalname: 'work.pdf', mimetype: 'application/pdf', size: 1024 } as Express.Multer.File;

describe('submissions.service — resubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageSave.mockResolvedValue('submissions/new-key.pdf');
  });

  it('allows the first attachment even after the deadline (first submission can still be marked Late elsewhere)', async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      traineeId: owner.id,
      assignment: { deadline: new Date('2020-01-01') }, // long past
      attachments: [] // no current attachment yet — this is a first submission, not a resubmission
    });
    submissionAttachmentCreate.mockResolvedValueOnce({ id: 'att-1' });

    const { addAttachment } = await import('../services/submissions.service');
    const result = await addAttachment(owner, 'sub-1', fakeFile);

    expect(result).toEqual({ id: 'att-1' });
    expect(submissionAttachmentUpdateMany).not.toHaveBeenCalled();
  });

  it('allows resubmission (replacing an existing attachment) before the deadline, and marks the old one superseded', async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      traineeId: owner.id,
      assignment: { deadline: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour from now
      attachments: [{ id: 'att-old', isCurrent: true }]
    });
    submissionAttachmentCreate.mockResolvedValueOnce({ id: 'att-new' });

    const { addAttachment } = await import('../services/submissions.service');
    const result = await addAttachment(owner, 'sub-1', fakeFile);

    expect(submissionAttachmentUpdateMany).toHaveBeenCalledWith({
      where: { submissionId: 'sub-1', isCurrent: true },
      data: { isCurrent: false }
    });
    expect(result).toEqual({ id: 'att-new' });
  });

  it('rejects resubmission after the deadline has passed', async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      traineeId: owner.id,
      assignment: { deadline: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour ago
      attachments: [{ id: 'att-old', isCurrent: true }]
    });

    const { addAttachment } = await import('../services/submissions.service');
    const err = await addAttachment(owner, 'sub-1', fakeFile).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(storageSave).not.toHaveBeenCalled();
    expect(submissionAttachmentCreate).not.toHaveBeenCalled();
  });

  it('rejects attaching a file to someone else\'s submission', async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      traineeId: 'someone-else',
      assignment: { deadline: new Date(Date.now() + 60 * 60 * 1000) },
      attachments: []
    });

    const { addAttachment } = await import('../services/submissions.service');
    const err = await addAttachment(owner, 'sub-1', fakeFile).catch((e) => e);

    expect(err.statusCode).toBe(403);
    expect(storageSave).not.toHaveBeenCalled();
  });

  it('removes the newly-saved file from storage if the database write fails (no orphaned upload)', async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      traineeId: owner.id,
      assignment: { deadline: new Date(Date.now() + 60 * 60 * 1000) },
      attachments: []
    });
    transaction.mockRejectedValueOnce(new Error('db write failed'));

    const { addAttachment } = await import('../services/submissions.service');
    await expect(addAttachment(owner, 'sub-1', fakeFile)).rejects.toThrow('db write failed');
    expect(storageRemove).toHaveBeenCalledWith('submissions/new-key.pdf');
  });
});
