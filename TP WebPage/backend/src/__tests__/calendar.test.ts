import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchFindMany = vi.fn();
const batchTraineeFindMany = vi.fn();
const sessionFindMany = vi.fn();
const assignmentFindMany = vi.fn();
const batchFacilitatorFindMany = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    batch: { findMany: (...a: unknown[]) => batchFindMany(...a) },
    batchTrainee: { findMany: (...a: unknown[]) => batchTraineeFindMany(...a) },
    session: { findMany: (...a: unknown[]) => sessionFindMany(...a) },
    assignment: { findMany: (...a: unknown[]) => assignmentFindMany(...a) },
    // resolveScopedBatchIds widens a facilitator's scope to active batch-team membership too.
    batchFacilitator: { findMany: (...a: unknown[]) => batchFacilitatorFindMany(...a) }
  }
}));

const admin = { id: 'admin-1', email: 'a@x.com', role: 'admin' as const, permissions: [] };
const facilitator = { id: 'facilitator-1', email: 'f@x.com', role: 'facilitator' as const, permissions: [] };
const trainee = { id: 'trainee-1', email: 't@x.com', role: 'trainee' as const, permissions: [] };

const query = { type: 'all' as const };

describe('calendar.service — event aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchFacilitatorFindMany.mockResolvedValue([]);
  });

  it('does not scope by batch for an admin with no batchId filter, and issues exactly one session + one assignment query', async () => {
    sessionFindMany.mockResolvedValueOnce([
      {
        id: 's1',
        title: 'Kickoff',
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        status: 'Upcoming',
        platform: 'Zoom',
        meetingLink: 'https://zoom.example.com/1',
        batch: { id: 'batch-1', name: 'Batch 1' },
        facilitator: { id: 'facilitator-1', name: 'Junaid' }
      }
    ]);
    assignmentFindMany.mockResolvedValueOnce([
      {
        id: 'a1',
        title: 'Homework',
        deadline: new Date('2026-08-05T18:30:00Z'),
        status: 'Open',
        batches: [{ batch: { id: 'batch-1', name: 'Batch 1' } }],
        facilitator: { id: 'facilitator-1', name: 'Junaid' }
      }
    ]);

    const { getEvents } = await import('../services/calendar.service');
    const events = await getEvents(admin, query);

    expect(batchFindMany).not.toHaveBeenCalled();
    expect(sessionFindMany).toHaveBeenCalledTimes(1);
    expect(assignmentFindMany).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type).sort()).toEqual(['assignment-deadline', 'session']);
    // Sorted chronologically.
    expect(events[0].start <= events[1].start).toBe(true);
  });

  it("scopes a facilitator's events to only the batches they manage", async () => {
    batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]);
    sessionFindMany.mockResolvedValueOnce([]);
    assignmentFindMany.mockResolvedValueOnce([]);

    const { getEvents } = await import('../services/calendar.service');
    await getEvents(facilitator, query);

    expect(batchFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ facilitatorId: facilitator.id }) }));
    expect(sessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ batchId: { in: ['batch-1'] } }) })
    );
  });

  it("includes a facilitator's active team-membership batches alongside batches they own", async () => {
    batchFindMany.mockResolvedValueOnce([{ id: 'batch-1' }]);
    batchFacilitatorFindMany.mockResolvedValueOnce([{ batchId: 'batch-2' }]);
    sessionFindMany.mockResolvedValueOnce([]);
    assignmentFindMany.mockResolvedValueOnce([]);

    const { getEvents } = await import('../services/calendar.service');
    await getEvents(facilitator, query);

    expect(sessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ batchId: { in: ['batch-1', 'batch-2'] } }) })
    );
  });

  it("scopes a trainee's events to only their enrolled batches", async () => {
    batchTraineeFindMany.mockResolvedValueOnce([{ batchId: 'batch-2' }]);
    sessionFindMany.mockResolvedValueOnce([]);
    assignmentFindMany.mockResolvedValueOnce([]);

    const { getEvents } = await import('../services/calendar.service');
    await getEvents(trainee, query);

    expect(batchTraineeFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ traineeId: trainee.id, removedAt: null }) }));
    expect(assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ batches: { some: { batchId: { in: ['batch-2'] } } } }) })
    );
  });

  it('short-circuits with zero queries to sessions/assignments when the caller has no accessible batches', async () => {
    batchTraineeFindMany.mockResolvedValueOnce([]);

    const { getEvents } = await import('../services/calendar.service');
    const events = await getEvents(trainee, query);

    expect(events).toEqual([]);
    expect(sessionFindMany).not.toHaveBeenCalled();
    expect(assignmentFindMany).not.toHaveBeenCalled();
  });

  it('only fetches sessions when type=session, skipping the assignment query entirely', async () => {
    sessionFindMany.mockResolvedValueOnce([]);

    const { getEvents } = await import('../services/calendar.service');
    await getEvents(admin, { type: 'session' });

    expect(sessionFindMany).toHaveBeenCalledTimes(1);
    expect(assignmentFindMany).not.toHaveBeenCalled();
  });
});
