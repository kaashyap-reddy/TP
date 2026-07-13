import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/audit', () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));

const sessionsCreate = vi.fn();
const sessionsUpdate = vi.fn();
const sessionsSoftDelete = vi.fn();
const sessionsGetById = vi.fn();
vi.mock('../services/sessions.service', () => ({
  create: (...a: unknown[]) => sessionsCreate(...a),
  update: (...a: unknown[]) => sessionsUpdate(...a),
  softDelete: (...a: unknown[]) => sessionsSoftDelete(...a),
  getById: (...a: unknown[]) => sessionsGetById(...a)
}));

const feedbackCreate = vi.fn();
vi.mock('../services/feedback.service', () => ({ create: (...a: unknown[]) => feedbackCreate(...a) }));

const resourcesUpdate = vi.fn();
vi.mock('../services/resources.service', () => ({ update: (...a: unknown[]) => resourcesUpdate(...a) }));

const actor = { id: 'user-1', email: 'a@x.com', role: 'facilitator' as const, permissions: [] };

// asyncHandler (src/utils/asyncHandler.ts) fires the handler's promise chain without returning
// it, so `await handler(req, res, next)` alone doesn't wait for the work inside to finish. Use
// res.json/res.send — the handler's actual completion signal — to know when it's really done.
function fakeReqRes(body: unknown = {}, params: Record<string, string> = {}) {
  let resolveDone: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const req = { user: actor, body, params } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(() => resolveDone()),
    send: vi.fn(() => resolveDone())
  } as unknown as Response;
  return { req, res, done };
}

describe('audit logging — sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records SessionCreated on create', async () => {
    sessionsCreate.mockResolvedValueOnce({ id: 's1', title: 'Kickoff' });
    const { createSessionHandler } = await import('../controllers/sessions.controller');
    const { req, res, done } = fakeReqRes({ title: 'Kickoff' });

    await createSessionHandler(req, res, vi.fn());
    await done;

    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SessionCreated', actorId: 'user-1', module: 'Sessions' }));
  });

  it('records SessionUpdated on update', async () => {
    sessionsUpdate.mockResolvedValueOnce({ id: 's1', title: 'Kickoff (rescheduled)' });
    const { updateSessionHandler } = await import('../controllers/sessions.controller');
    const { req, res, done } = fakeReqRes({ status: 'Rescheduled' }, { id: 's1' });

    await updateSessionHandler(req, res, vi.fn());
    await done;

    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SessionUpdated', module: 'Sessions' }));
  });

  it('records SessionDeleted on delete', async () => {
    sessionsGetById.mockResolvedValueOnce({ id: 's1', title: 'Kickoff' });
    sessionsSoftDelete.mockResolvedValueOnce(undefined);
    const { deleteSessionHandler } = await import('../controllers/sessions.controller');
    const { req, res, done } = fakeReqRes({}, { id: 's1' });

    await deleteSessionHandler(req, res, vi.fn());
    await done;

    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SessionDeleted', module: 'Sessions' }));
  });
});

describe('audit logging — feedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records FeedbackSubmitted on create', async () => {
    feedbackCreate.mockResolvedValueOnce({ id: 'f1', rating: 5 });
    const { createFeedbackHandler } = await import('../controllers/feedback.controller');
    const { req, res, done } = fakeReqRes({ rating: 5 });

    await createFeedbackHandler(req, res, vi.fn());
    await done;

    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'FeedbackSubmitted', module: 'Feedback' }));
  });
});

describe('audit logging — resource verification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records ResourceVerified when a PATCH sets verified:true', async () => {
    resourcesUpdate.mockResolvedValueOnce({ id: 'r1', title: 'Slides.pdf', verified: true });
    const { updateResourceHandler } = await import('../controllers/resources.controller');
    const { req, res, done } = fakeReqRes({ verified: true }, { id: 'r1' });

    await updateResourceHandler(req, res, vi.fn());
    await done;

    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceVerified', module: 'Resources' }));
  });

  it('does not record ResourceVerified for an unrelated metadata edit', async () => {
    resourcesUpdate.mockResolvedValueOnce({ id: 'r1', title: 'Slides v2.pdf', verified: true });
    const { updateResourceHandler } = await import('../controllers/resources.controller');
    const { req, res, done } = fakeReqRes({ title: 'Slides v2.pdf' }, { id: 'r1' });

    await updateResourceHandler(req, res, vi.fn());
    await done;

    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
