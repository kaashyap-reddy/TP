import { beforeEach, describe, expect, it, vi } from 'vitest';

type DemoModule = typeof import('../services/api/demoMode');

// demoMode keeps in-memory mutable copies of the fixtures at module scope (by design — edits
// during a demo session feel real, reload resets). Re-importing per test gives each test the
// same pristine state a page reload gives a demo user.
let demo: DemoModule;

interface Paginated<T> {
  data: T[];
  pagination: { total: number };
}

function get<T>(path: string, query?: Record<string, unknown>): T {
  return demo.handleDemoRequest('GET', path, undefined, query) as T;
}

beforeEach(async () => {
  vi.resetModules();
  sessionStorage.clear();
  demo = await import('../services/api/demoMode');
});

describe('demo session (auth)', () => {
  it('starts a session per role and survives via /auth/refresh', () => {
    const started = demo.startDemoSession('trainee');
    expect(started.role).toBe('trainee');
    const res = demo.handleDemoRequest('POST', '/auth/refresh', undefined) as { user: { email: string; role: string } };
    expect(res.user.role).toBe('trainee');
    expect(res.user.email).toBe('trainee@company.com');
  });

  it('logout clears demo mode', () => {
    demo.startDemoSession('admin');
    expect(demo.isDemoMode()).toBe(true);
    demo.handleDemoRequest('POST', '/auth/logout', undefined);
    expect(demo.isDemoMode()).toBe(false);
  });
});

describe('notifications (per-recipient scoping)', () => {
  it("different demo users see different, correctly-scoped notification lists", () => {
    demo.startDemoSession('admin');
    const adminRes = get<{ data: { type: string }[]; unreadCount: number }>('/notifications');
    expect(adminRes.data.every((n) => n.type !== 'AssignmentPublished' && n.type !== 'SubmissionReviewed')).toBe(true);
    expect(adminRes.data.some((n) => n.type === 'BatchUnassigned')).toBe(true);

    demo.startDemoSession('facilitator');
    const facilitatorRes = get<{ data: { type: string }[] }>('/notifications');
    expect(facilitatorRes.data.some((n) => n.type === 'SubmissionReceived')).toBe(true);
    expect(facilitatorRes.data.some((n) => n.type === 'BatchUnassigned')).toBe(false);

    // demo-trainee (Priya, the default trainee session) and demo-trainee-2 (Rahul) must not see
    // each other's notifications -- this is the frontend-visible half of the authorization
    // guarantee also covered server-side by backend/src/__tests__/notifications.authorization.test.ts.
    demo.startDemoSession('trainee');
    const traineeOneRes = get<{ data: { id: string }[] }>('/notifications');

    sessionStorage.setItem('tp-demo-email', 'rahul.verma@company.com');
    const traineeTwoRes = get<{ data: { id: string }[] }>('/notifications');

    const traineeOneIds = new Set(traineeOneRes.data.map((n) => n.id));
    const traineeTwoIds = new Set(traineeTwoRes.data.map((n) => n.id));
    expect([...traineeOneIds].some((id) => traineeTwoIds.has(id))).toBe(false);
    expect(traineeOneRes.data.length).toBeGreaterThan(0);
    expect(traineeTwoRes.data.length).toBeGreaterThan(0);
  });

  it('marking one notification read only affects that recipient, and unreadCount reflects it', () => {
    demo.startDemoSession('trainee');
    const before = get<{ data: { id: string; readAt: string | null }[]; unreadCount: number }>('/notifications');
    const target = before.data.find((n) => !n.readAt)!;
    expect(before.unreadCount).toBeGreaterThan(0);

    demo.handleDemoRequest('POST', `/notifications/${target.id}/read`, undefined);

    const after = get<{ data: { id: string; readAt: string | null }[]; unreadCount: number }>('/notifications');
    expect(after.data.find((n) => n.id === target.id)?.readAt).not.toBeNull();
    expect(after.unreadCount).toBe(before.unreadCount - 1);
  });

  it('mark-all-read zeroes unreadCount for the current user without needing individual ids', () => {
    demo.startDemoSession('trainee');
    demo.handleDemoRequest('POST', '/notifications/read-all', undefined);
    const after = get<{ unreadCount: number }>('/notifications');
    expect(after.unreadCount).toBe(0);
  });
});

describe('create-batch automation (template → copy)', () => {
  it('instantiates the full plan schedule onto the new batch without touching the template', () => {
    demo.startDemoSession('admin');
    const { batch } = demo.handleDemoRequest('POST', '/batches', {
      name: 'Test Batch',
      code: 'test-batch',
      trainingPlanId: 'demo-plan-ba-btech',
      startMonth: '2026-09-01T00:00:00.000Z'
    }) as { batch: { id: string; endDate: string; program: string; track: string } };

    expect(batch.program).toBe('BA');
    expect(batch.track).toBe('BTech');

    const sessions = get<Paginated<{ scheduledAt: string; feedbackForm: unknown }>>('/sessions', { batchId: batch.id });
    expect(sessions.data).toHaveLength(42);

    const assignments = get<Paginated<{ attachment: unknown }>>('/assignments', { batchId: batch.id });
    expect(assignments.data).toHaveLength(36);

    // endDate = date of the last generated session
    const last = sessions.data.map((s) => new Date(s.scheduledAt)).sort((a, b) => b.getTime() - a.getTime())[0];
    expect(new Date(batch.endDate).toDateString()).toBe(last.toDateString());

    // template untouched
    const { trainingPlan } = get<{ trainingPlan: { sessions: unknown[]; assignments: unknown[] } }>(
      '/training-plans/demo-plan-ba-btech'
    );
    expect(trainingPlan.sessions).toHaveLength(42);
    expect(trainingPlan.assignments).toHaveLength(36);
  });

  it('rejects an unknown training plan with a 400', () => {
    demo.startDemoSession('admin');
    expect(() => demo.handleDemoRequest('POST', '/batches', { name: 'X', trainingPlanId: 'nope' })).toThrowError(
      /no such training plan/i
    );
  });
});

describe('URL validation (mirrors backend zod .url())', () => {
  it('rejects an invalid feedback form URL on attach and edit', () => {
    demo.startDemoSession('admin');
    const sessions = get<Paginated<{ id: string }>>('/sessions');
    const sessionId = sessions.data[0].id;
    expect(() =>
      demo.handleDemoRequest('POST', `/sessions/${sessionId}/feedback-form`, { name: 'F', formUrl: 'not-a-url', audience: 'Both' })
    ).toThrowError(/valid form URL/i);
    expect(() =>
      demo.handleDemoRequest('PATCH', `/sessions/${sessionId}/feedback-form`, { formUrl: 'still bad' })
    ).toThrowError(/valid form URL/i);
  });

  it('rejects an invalid training-plan resource URL', () => {
    demo.startDemoSession('admin');
    expect(() =>
      demo.handleDemoRequest('POST', '/training-plans/demo-plan-ba-btech/resources', { title: 'R', url: 'nope' })
    ).toThrowError(/valid resource URL/i);
  });

  it('accepts a well-formed URL', () => {
    demo.startDemoSession('admin');
    const assignments = get<Paginated<{ id: string }>>('/assignments');
    const res = demo.handleDemoRequest('POST', `/assignments/${assignments.data[0].id}/feedback-form`, {
      name: 'F',
      formUrl: 'https://forms.office.com/r/abc',
      audience: 'Both'
    }) as { form: { formUrl: string } };
    expect(res.form.formUrl).toBe('https://forms.office.com/r/abc');
  });
});

describe('assignment feedback form', () => {
  function attachForm(assignmentId: string, audience: string): void {
    demo.handleDemoRequest('POST', `/assignments/${assignmentId}/feedback-form`, {
      name: 'F',
      formUrl: 'https://forms.office.com/r/abc',
      audience
    });
  }

  it('409s when a form is already attached', () => {
    demo.startDemoSession('admin');
    const assignments = get<Paginated<{ id: string }>>('/assignments');
    const id = assignments.data[0].id;
    attachForm(id, 'Both');
    expect(() => attachForm(id, 'Both')).toThrowError(/already has a feedback form/i);
  });

  it('records one submission per trainee (idempotent) and reflects mySubmitted', () => {
    demo.startDemoSession('admin');
    // Priya (demo-trainee) is in the BTech batch — pick one of its assignments.
    const assignments = get<Paginated<{ id: string }>>('/assignments', { batchId: 'demo-batch-ba-btech' });
    const id = assignments.data[0].id;
    attachForm(id, 'Both');

    demo.startDemoSession('trainee');
    demo.handleDemoRequest('POST', `/assignments/${id}/feedback-form/submissions`, {});
    demo.handleDemoRequest('POST', `/assignments/${id}/feedback-form/submissions`, {});

    const { form } = get<{ form: { submittedCount: number; mySubmitted: boolean } }>(`/assignments/${id}/feedback-form`);
    expect(form.submittedCount).toBe(1);
    expect(form.mySubmitted).toBe(true);
  });

  it('audience-gates visibility and submission for trainees', () => {
    demo.startDemoSession('admin');
    const assignments = get<Paginated<{ id: string }>>('/assignments', { batchId: 'demo-batch-ba-btech' });
    const id = assignments.data[0].id;
    attachForm(id, 'Facilitators');

    demo.startDemoSession('trainee');
    const { form } = get<{ form: unknown }>(`/assignments/${id}/feedback-form`);
    expect(form).toBeNull();
    expect(() => demo.handleDemoRequest('POST', `/assignments/${id}/feedback-form/submissions`, {})).toThrowError(
      /not for your role/i
    );
  });
});

describe('session feedback form visibility', () => {
  it('hides a Facilitators-only form from a trainee on the session itself', () => {
    demo.startDemoSession('admin');
    const sessions = get<Paginated<{ id: string; feedbackForm: unknown }>>('/sessions', { batchId: 'demo-batch-ba-btech' });
    const target = sessions.data.find((s) => s.feedbackForm !== null)!;
    demo.handleDemoRequest('PATCH', `/sessions/${target.id}/feedback-form`, { audience: 'Facilitators' });

    demo.startDemoSession('trainee');
    const { session } = get<{ session: { feedbackForm: unknown } }>(`/sessions/${target.id}`);
    expect(session.feedbackForm).toBeNull();
  });
});

describe('attendance', () => {
  it('serves fixture records for completed sessions and computes trainee-stats percentages', () => {
    demo.startDemoSession('admin');
    const sessions = get<Paginated<{ id: string; status: string }>>('/sessions', { batchId: 'demo-batch-ba-btech' });
    const completed = sessions.data.filter((s) => s.status === 'Completed');
    expect(completed.length).toBeGreaterThan(0);

    const { attendance } = get<{ attendance: { traineeId: string; status: string }[] }>(
      `/sessions/${completed[0].id}/attendance`
    );
    expect(attendance).toHaveLength(5);

    const { trainees } = get<{ trainees: { name: string; attendancePercentage: number | null }[] }>(
      '/batches/demo-batch-ba-btech/trainee-stats'
    );
    for (const t of trainees) {
      expect(t.attendancePercentage).not.toBeNull();
      expect(t.attendancePercentage!).toBeGreaterThanOrEqual(0);
      expect(t.attendancePercentage!).toBeLessThanOrEqual(100);
    }
  });

  it('upserts records on PUT like the real bulkMark', () => {
    demo.startDemoSession('facilitator');
    const sessions = get<Paginated<{ id: string; status: string }>>('/sessions', { batchId: 'demo-batch-ba-btech' });
    const completed = sessions.data.find((s) => s.status === 'Completed')!;

    const res = demo.handleDemoRequest('PUT', `/sessions/${completed.id}/attendance`, {
      records: [{ traineeId: 'demo-trainee', status: 'Absent' }]
    }) as { attendance: { traineeId: string; status: string }[] };

    const priya = res.attendance.find((r) => r.traineeId === 'demo-trainee');
    expect(priya?.status).toBe('Absent');
  });
});

describe('assignment instructions file', () => {
  it('keeps an uploaded file\'s real metadata on create', () => {
    demo.startDemoSession('admin');
    const formData = new FormData();
    formData.append('title', 'Uploaded Assignment');
    formData.append('batchIds', JSON.stringify(['demo-batch-ba-btech']));
    formData.append('deadline', '2026-10-01T23:59:00.000Z');
    formData.append('description', 'desc');
    formData.append('file', new File(['hello'], 'brief.pdf', { type: 'application/pdf' }));

    const { assignment } = demo.handleDemoRequest('POST', '/assignments', formData) as {
      assignment: { attachment: { originalFilename: string; mimeType: string } | null };
    };
    expect(assignment.attachment?.originalFilename).toBe('brief.pdf');
    expect(assignment.attachment?.mimeType).toBe('application/pdf');
  });

  it('leaves attachment null when no file is uploaded', () => {
    demo.startDemoSession('admin');
    const { assignment } = demo.handleDemoRequest('POST', '/assignments', {
      title: 'No File',
      batchIds: ['demo-batch-ba-btech'],
      deadline: '2026-10-01T23:59:00.000Z'
    }) as { assignment: { attachment: unknown } };
    expect(assignment.attachment).toBeNull();
  });
});
