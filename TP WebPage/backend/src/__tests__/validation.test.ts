import { describe, expect, it } from 'vitest';
import { createBatchSchema } from '../validators/batches.validator';
import { loginSchema } from '../validators/auth.validator';
import { createAssignmentSchema } from '../validators/assignments.validator';

const trainingPlanId = '11111111-1111-1111-1111-111111111111';
const facilitatorId = '22222222-2222-2222-2222-222222222222';

describe('request validation', () => {
  it('rejects a batch with a non-uuid trainingPlanId', () => {
    const result = createBatchSchema.safeParse({ code: 'ba-1', name: 'BA 1', trainingPlanId: 'NotARealPlan', facilitatorId });
    expect(result.success).toBe(false);
  });

  it('rejects a batch missing required fields', () => {
    const result = createBatchSchema.safeParse({ trainingPlanId });
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed batch payload and applies the default status', () => {
    const result = createBatchSchema.safeParse({ code: 'ba-1', name: 'BA 1', trainingPlanId, facilitatorId });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('Upcoming');
  });

  it('rejects a login payload with a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'whatever' });
    expect(result.success).toBe(false);
  });

  it('rejects an assignment with a non-uuid batchId (parameter/body-shape validation)', () => {
    const result = createAssignmentSchema.safeParse({
      batchId: 'not-a-uuid',
      title: 'Assignment 1',
      description: 'desc',
      deadline: new Date().toISOString()
    });
    expect(result.success).toBe(false);
  });
});
