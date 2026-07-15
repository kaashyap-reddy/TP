import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindFirst = vi.fn();
const batchFindUnique = vi.fn();
const trainingPlanFindUnique = vi.fn();
const txBatchCreate = vi.fn();
const txBatchFindUniqueOrThrow = vi.fn();
const txSessionCreate = vi.fn();
const txSessionFeedbackFormCreate = vi.fn();
const txAssignmentCreate = vi.fn();
const txResourceCreate = vi.fn();
const txAnnouncementCreate = vi.fn();

const tx = {
  batch: { create: txBatchCreate, findUniqueOrThrow: txBatchFindUniqueOrThrow },
  session: { create: txSessionCreate },
  sessionFeedbackForm: { create: txSessionFeedbackFormCreate },
  assignment: { create: txAssignmentCreate },
  resource: { create: txResourceCreate },
  announcement: { create: txAnnouncementCreate }
};

vi.mock('../prisma/client', () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => userFindFirst(...args) },
    batch: { findUnique: (...args: unknown[]) => batchFindUnique(...args) },
    trainingPlan: { findUnique: (...args: unknown[]) => trainingPlanFindUnique(...args) },
    $transaction: (cb: (tx: unknown) => unknown) => cb(tx)
  }
}));

describe('batches.service create() — Training Plan automation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('instantiates sessions (with their feedback forms) and linked assignments from the plan template', async () => {
    const { create } = await import('../services/batches.service');

    userFindFirst.mockResolvedValueOnce({ id: 'facilitator-1', role: { name: 'facilitator' } });
    batchFindUnique.mockResolvedValueOnce(null);
    trainingPlanFindUnique.mockResolvedValueOnce({
      id: 'plan-1',
      code: 'ba-btech',
      sessions: [
        {
          id: 'tps-1',
          title: 'Kickoff',
          dayOffset: 1,
          startMinute: 600,
          endMinute: 690,
          platform: 'GoogleMeet',
          order: 1,
          feedbackFormUrl: 'https://forms.gle/x'
        }
      ],
      assignments: [{ id: 'tpa-1', title: 'Quiz', agenda: 'Requirement Gathering', description: 'desc', dueDayOffset: 10, relatedSessionId: 'tps-1' }],
      resources: [{ id: 'tpr-1', title: 'Handbook', category: 'Handbook', url: 'https://example.com/handbook.pdf' }],
      announcements: [{ id: 'tpan-1', title: 'Welcome', message: 'hi', priority: 'Normal' }]
    });

    txBatchCreate.mockResolvedValueOnce({ id: 'batch-1', code: 'ba-btech-1', name: 'BA BTech 1' });
    txSessionCreate.mockResolvedValueOnce({ id: 'session-1' });
    txSessionFeedbackFormCreate.mockResolvedValueOnce({ id: 'form-1' });
    txAssignmentCreate.mockResolvedValueOnce({ id: 'assignment-1' });
    txResourceCreate.mockResolvedValueOnce({ id: 'resource-1' });
    txAnnouncementCreate.mockResolvedValueOnce({ id: 'announcement-1' });
    txBatchFindUniqueOrThrow.mockResolvedValueOnce({ id: 'batch-1', code: 'ba-btech-1', name: 'BA BTech 1' });

    const result = await create('admin-1', {
      code: 'ba-btech-1',
      name: 'BA BTech 1',
      trainingPlanId: 'plan-1',
      facilitatorId: 'facilitator-1',
      status: 'Active'
    });

    expect(result.id).toBe('batch-1');
    expect(txSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trainingPlanSessionId: 'tps-1', title: 'Kickoff', facilitatorId: 'facilitator-1' }) })
    );
    expect(txSessionFeedbackFormCreate).toHaveBeenCalledWith(
      // createdBy is the acting admin, not the session's trainer.
      expect.objectContaining({ data: expect.objectContaining({ sessionId: 'session-1', formUrl: 'https://forms.gle/x', createdBy: 'admin-1' }) })
    );
    expect(txAssignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'session-1', trainingPlanAssignmentId: 'tpa-1', agenda: 'Requirement Gathering' })
      })
    );
    expect(txResourceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trainingPlanResourceId: 'tpr-1', externalUrl: 'https://example.com/handbook.pdf', uploadedBy: 'admin-1' })
      })
    );
    expect(txAnnouncementCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trainingPlanAnnouncementId: 'tpan-1', batchId: 'batch-1', authorId: 'admin-1' }) })
    );
  });

  it('derives program BA / track MBA from a "ba-mba" plan code (no session/assignment templates)', async () => {
    const { create } = await import('../services/batches.service');

    userFindFirst.mockResolvedValueOnce({ id: 'facilitator-1', role: { name: 'facilitator' } });
    batchFindUnique.mockResolvedValueOnce(null);
    trainingPlanFindUnique.mockResolvedValueOnce({
      id: 'plan-2',
      code: 'ba-mba',
      durationMonths: 2,
      sessions: [],
      assignments: [],
      resources: [],
      announcements: []
    });
    txBatchCreate.mockResolvedValueOnce({ id: 'batch-2' });
    txBatchFindUniqueOrThrow.mockResolvedValueOnce({ id: 'batch-2' });

    await create('admin-1', { code: 'ba-mba-1', name: 'BA MBA 1', trainingPlanId: 'plan-2', facilitatorId: 'facilitator-1', status: 'Active' });

    expect(txBatchCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ program: 'BA', track: 'MBA' }) })
    );
    expect(txSessionCreate).not.toHaveBeenCalled();
    expect(txAssignmentCreate).not.toHaveBeenCalled();
    expect(txResourceCreate).not.toHaveBeenCalled();
  });

  it('creates a batch with no Trainer assigned (facilitatorId optional) — sessions/assignments get a null facilitatorId', async () => {
    const { create } = await import('../services/batches.service');

    batchFindUnique.mockResolvedValueOnce(null);
    trainingPlanFindUnique.mockResolvedValueOnce({
      id: 'plan-1',
      code: 'ba-btech',
      durationMonths: 2,
      sessions: [{ id: 'tps-1', title: 'Kickoff', dayOffset: 0, startMinute: 870, endMinute: 990, platform: 'Other', order: 1, feedbackFormUrl: null }],
      assignments: [],
      resources: [],
      announcements: []
    });
    txBatchCreate.mockResolvedValueOnce({ id: 'batch-3', code: 'ba-btech-3' });
    txSessionCreate.mockResolvedValueOnce({ id: 'session-3' });
    txBatchFindUniqueOrThrow.mockResolvedValueOnce({ id: 'batch-3' });

    await create('admin-1', { code: 'ba-btech-3', name: 'BA BTech 3', trainingPlanId: 'plan-1', status: 'Active' });

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(txBatchCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ facilitatorId: null }) }));
    expect(txSessionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ facilitatorId: null }) }));
  });

  it('skips weekends when scheduling sessions — dayOffset is the Nth working day, not the Nth calendar day', async () => {
    const { create } = await import('../services/batches.service');

    // 2026-07-03 is a Friday. dayOffset 0 -> Fri Jul 3, dayOffset 1 -> Mon Jul 6 (skips Sat/Sun),
    // dayOffset 6 -> Mon Jul 13 (skips the following weekend too).
    batchFindUnique.mockResolvedValueOnce(null);
    trainingPlanFindUnique.mockResolvedValueOnce({
      id: 'plan-1',
      code: 'ba-btech',
      durationMonths: 2,
      sessions: [
        { id: 'tps-0', title: 'Day 0', dayOffset: 0, startMinute: 870, endMinute: 990, platform: 'Other', order: 1, feedbackFormUrl: null },
        { id: 'tps-1', title: 'Day 1', dayOffset: 1, startMinute: 870, endMinute: 990, platform: 'Other', order: 2, feedbackFormUrl: null },
        { id: 'tps-6', title: 'Day 6', dayOffset: 6, startMinute: 870, endMinute: 990, platform: 'Other', order: 3, feedbackFormUrl: null }
      ],
      assignments: [],
      resources: [],
      announcements: []
    });
    txBatchCreate.mockResolvedValueOnce({ id: 'batch-4', code: 'ba-btech-4' });
    txSessionCreate.mockResolvedValue({ id: 'session-x' });
    txBatchFindUniqueOrThrow.mockResolvedValueOnce({ id: 'batch-4' });

    await create('admin-1', {
      code: 'ba-btech-4',
      name: 'BA BTech 4',
      trainingPlanId: 'plan-1',
      startMonth: new Date('2026-07-03T00:00:00.000Z'),
      status: 'Active'
    });

    // Asserted via local wall-clock components (not a hardcoded UTC ISO string) — startMinute is a
    // literal wall-clock time ("2:30 PM"), and day math is anchored to local midnight, so the
    // instant itself shifts with the test runner's timezone while these components don't.
    const scheduledDates = txSessionCreate.mock.calls.map((call) => (call[0] as { data: { scheduledAt: Date } }).data.scheduledAt);
    expect(scheduledDates.map((d) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
      [2026, 6, 3, 14, 30],
      [2026, 6, 6, 14, 30],
      [2026, 6, 13, 14, 30]
    ]);

    // endDate is computed from the last session's date (highest dayOffset), not a flat +2 months.
    const endDate = (txBatchCreate.mock.calls[0][0] as { data: { endDate: Date } }).data.endDate;
    expect([endDate.getFullYear(), endDate.getMonth(), endDate.getDate()]).toEqual([2026, 6, 13]);
  });
});
