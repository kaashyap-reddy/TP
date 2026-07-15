import { beforeEach, describe, expect, it, vi } from 'vitest';

const trainingPlanFindUnique = vi.fn();
const trainingPlanUpdate = vi.fn();
const trainingPlanSessionCreate = vi.fn();
const trainingPlanSessionFindFirst = vi.fn();
const trainingPlanSessionUpdate = vi.fn();
const trainingPlanSessionDelete = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    trainingPlan: {
      findUnique: (...a: unknown[]) => trainingPlanFindUnique(...a),
      update: (...a: unknown[]) => trainingPlanUpdate(...a)
    },
    trainingPlanSession: {
      create: (...a: unknown[]) => trainingPlanSessionCreate(...a),
      findFirst: (...a: unknown[]) => trainingPlanSessionFindFirst(...a),
      update: (...a: unknown[]) => trainingPlanSessionUpdate(...a),
      delete: (...a: unknown[]) => trainingPlanSessionDelete(...a)
    }
  }
}));

describe('trainingPlans.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s getById() for an unknown plan', async () => {
    const { getById } = await import('../services/trainingPlans.service');
    trainingPlanFindUnique.mockResolvedValueOnce(null);

    const err = await getById('missing').catch((e) => e);
    expect(err.statusCode).toBe(404);
  });

  it('update() persists name/duration changes', async () => {
    const { update } = await import('../services/trainingPlans.service');
    trainingPlanFindUnique.mockResolvedValueOnce({ id: 'plan-1', name: 'BA BTech' });
    trainingPlanUpdate.mockResolvedValueOnce({ id: 'plan-1', name: 'BA BTech (Updated)', durationMonths: 3 });

    const result = await update('plan-1', { name: 'BA BTech (Updated)', durationMonths: 3 });

    expect(trainingPlanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-1' }, data: { name: 'BA BTech (Updated)', durationMonths: 3 } })
    );
    expect(result.name).toBe('BA BTech (Updated)');
  });

  it('update() persists description changes', async () => {
    const { update } = await import('../services/trainingPlans.service');
    trainingPlanFindUnique.mockResolvedValueOnce({ id: 'plan-1', name: 'BA BTech' });
    trainingPlanUpdate.mockResolvedValueOnce({ id: 'plan-1', name: 'BA BTech', description: 'Updated description' });

    const result = await update('plan-1', { description: 'Updated description' });

    expect(trainingPlanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-1' }, data: { description: 'Updated description' } })
    );
    expect(result.description).toBe('Updated description');
  });

  it('404s updateSession() when the session does not belong to that plan', async () => {
    const { updateSession } = await import('../services/trainingPlans.service');
    trainingPlanSessionFindFirst.mockResolvedValueOnce(null);

    const err = await updateSession('plan-1', 'session-from-other-plan', { title: 'New title' }).catch((e) => e);
    expect(err.statusCode).toBe(404);
    expect(trainingPlanSessionUpdate).not.toHaveBeenCalled();
  });

  it('createSession() scopes the new template session to its plan', async () => {
    const { createSession } = await import('../services/trainingPlans.service');
    trainingPlanFindUnique.mockResolvedValueOnce({ id: 'plan-1' });
    trainingPlanSessionCreate.mockResolvedValueOnce({ id: 'session-1', trainingPlanId: 'plan-1' });

    await createSession('plan-1', { title: 'New Session', dayOffset: 5, startMinute: 600, endMinute: 690, platform: 'Other', order: 9 });

    expect(trainingPlanSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trainingPlanId: 'plan-1', title: 'New Session' }) })
    );
  });

  it('deleteSession() removes a session scoped to its own plan, not cross-plan', async () => {
    const { deleteSession } = await import('../services/trainingPlans.service');
    trainingPlanSessionFindFirst.mockResolvedValueOnce({ id: 'session-1', trainingPlanId: 'plan-1' });
    trainingPlanSessionDelete.mockResolvedValueOnce({});

    await deleteSession('plan-1', 'session-1');

    expect(trainingPlanSessionFindFirst).toHaveBeenCalledWith({ where: { id: 'session-1', trainingPlanId: 'plan-1' } });
    expect(trainingPlanSessionDelete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
  });
});
