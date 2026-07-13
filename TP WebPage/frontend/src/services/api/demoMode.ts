// Demo Mode: lets the app be shown/clicked through with realistic sample data when no backend
// database is reachable. Entered only via an explicit "View Demo" action on the login page —
// never automatic — and intercepted at the lowest possible layer (apiClient.ts) so every store
// and page above it works completely unaware it isn't talking to a real API.
//
// The session (which demo user is "logged in") survives a page reload via sessionStorage, same
// as a real session would via its cookie — but the fixture DATA (batches/assignments/etc, all
// in-memory module state below) resets on reload. This is a presentation aid, not a persistence
// layer: don't rely on edits made during a demo surviving a refresh.
import type { Role } from '../../types/role';
import { DEMO_ASSIGNMENTS, DEMO_BATCHES, DEMO_FEEDBACK, DEMO_RESOURCES, DEMO_SESSIONS, DEMO_USERS, type DemoResource, type DemoSubmission } from './demoData';

const MODE_KEY = 'tp-demo-mode';
const EMAIL_KEY = 'tp-demo-email';

export function isDemoMode(): boolean {
  return sessionStorage.getItem(MODE_KEY) === 'true';
}

export function disableDemoMode(): void {
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
}

export interface DemoUserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Enters Demo Mode as the given role's sample user — the one thing LoginPage needs to call. */
export function startDemoSession(role: Role): DemoUserSession {
  const user = DEMO_USERS.find((u) => u.role === role)!;
  sessionStorage.setItem(MODE_KEY, 'true');
  sessionStorage.setItem(EMAIL_KEY, user.email);
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
}

function currentDemoUser() {
  const email = sessionStorage.getItem(EMAIL_KEY);
  return DEMO_USERS.find((u) => u.email === email) ?? DEMO_USERS[0];
}

// ---- in-memory, mutable copies so create/update/delete during a demo session feel real ----
let batches = clone(DEMO_BATCHES);
let assignments = clone(DEMO_ASSIGNMENTS);
let sessions = clone(DEMO_SESSIONS);
let resources = clone(DEMO_RESOURCES);
let feedback = clone(DEMO_FEEDBACK);
let idCounter = 1000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function paginated<T>(items: T[]) {
  return { data: items, pagination: { page: 1, pageSize: items.length, total: items.length, totalPages: 1 } };
}

function notFound(): never {
  const err = new Error('Not found.') as Error & { status?: number };
  err.status = 404;
  throw err;
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    else if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Routes a request to canned/in-memory data instead of the network. Mirrors the real backend's
 * URL shape closely enough that every services/api/*.ts file works unmodified.
 */
// assignmentService/resourceService/etc build a FormData body (to support file uploads) even in
// Demo Mode, since they don't know which mode they're running in — a FormData instance has no
// plain-object property access, so `formData.title` etc would silently read as undefined without
// this normalization step.
function normalizeBody(body: unknown): Record<string, unknown> {
  if (body instanceof FormData) return Object.fromEntries(body.entries());
  return (body ?? {}) as Record<string, unknown>;
}

function parseBatchIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Resolves batchIds to the same `{ batchId, batches }` shape the real backend serializes assignments with. */
function resolveAssignmentBatches(batchIds: string[]): { batchId: string; batches: { id: string; name: string; code: string }[] } {
  const resolved = batchIds
    .map((id) => batches.find((x) => x.id === id))
    .filter((x): x is (typeof batches)[number] => x !== undefined);
  return {
    batchId: resolved[0]?.id ?? '',
    batches: resolved.map((b) => ({ id: b.id, name: b.name, code: b.code }))
  };
}

export function handleDemoRequest(method: Method, path: string, body: unknown, query?: Record<string, unknown>): unknown {
  const b = normalizeBody(body);

  // ---- auth ----
  if (method === 'POST' && path === '/auth/refresh') {
    // Keeps a demo session alive across a page reload, the same way a real refresh-token
    // cookie would — see startDemoSession()/currentDemoUser() above.
    const user = currentDemoUser();
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: [] },
      accessToken: 'demo-access-token'
    };
  }
  if (method === 'POST' && path === '/auth/logout') {
    disableDemoMode();
    return undefined;
  }

  // ---- users ----
  if (method === 'GET' && path === '/users/me') {
    return { user: currentDemoUser() };
  }
  if (method === 'PATCH' && path === '/users/me') {
    const user = currentDemoUser();
    Object.assign(user, b);
    return { user };
  }
  if (method === 'GET' && path === '/users') {
    let results = DEMO_USERS;
    if (query?.role) results = results.filter((u) => u.role === query.role);
    if (query?.search) {
      const q = String(query.search).toLowerCase();
      results = results.filter((u) => u.name.toLowerCase().includes(q));
    }
    return paginated(results);
  }
  const userMatch = matchPath('/users/:id', path);
  if (method === 'GET' && userMatch) {
    const user = DEMO_USERS.find((u) => u.id === userMatch.id);
    if (!user) notFound();
    return { user };
  }

  // ---- batches ----
  if (method === 'GET' && path === '/batches') {
    let results = batches;
    if (query?.facilitatorId) results = results.filter((b) => b.facilitator?.id === query.facilitatorId);
    if (query?.traineeId) {
      const trainee = DEMO_USERS.find((u) => u.id === query.traineeId);
      results = results.filter((b) => (trainee ? b.members.includes(trainee.name) : false));
    }
    return paginated(results);
  }
  if (method === 'POST' && path === '/batches') {
    const created = {
      id: nextId('demo-batch'),
      code: String(b.code ?? nextId('batch')),
      name: String(b.name ?? 'New Batch'),
      program: String(b.program ?? 'BA'),
      track: String(b.track ?? 'BTech'),
      status: String(b.status ?? 'Upcoming'),
      startMonth: (b.startMonth as string) ?? null,
      endDate: (b.endDate as string) ?? null,
      facilitator: facilitatorRefFor(b.facilitatorId as string | undefined),
      members: [] as string[],
      metrics: { traineeCount: 0, avgScore: null, completionPct: null, attendanceRate: null, submissionRate: null, feedbackRating: null }
    };
    batches = [created, ...batches];
    return { batch: created };
  }
  const batchIdMatch = matchPath('/batches/:id', path);
  if (batchIdMatch) {
    const batch = batches.find((x) => x.id === batchIdMatch.id);
    if (!batch) notFound();
    if (method === 'GET') return { batch };
    if (method === 'PATCH') {
      if (b.facilitatorId !== undefined) batch.facilitator = facilitatorRefFor(b.facilitatorId as string | undefined);
      Object.assign(batch, { ...b, facilitatorId: undefined });
      return { batch };
    }
    if (method === 'DELETE') {
      batches = batches.filter((x) => x.id !== batchIdMatch.id);
      return undefined;
    }
  }
  const batchMetricsMatch = matchPath('/batches/:id/metrics', path);
  if (method === 'GET' && batchMetricsMatch) {
    const batch = batches.find((x) => x.id === batchMetricsMatch.id);
    if (!batch) notFound();
    return { metrics: batch.metrics };
  }
  const batchTraineeStatsMatch = matchPath('/batches/:id/trainee-stats', path);
  if (method === 'GET' && batchTraineeStatsMatch) {
    const batch = batches.find((x) => x.id === batchTraineeStatsMatch.id);
    if (!batch) notFound();
    const batchAssignments = assignments.filter((a) => a.batchId === batch.id);
    const totalAssignments = batchAssignments.length;
    const trainees = batch.members.map((name) => {
      const user = DEMO_USERS.find((u) => u.name === name);
      const submissions = batchAssignments.flatMap((a) => a.submissions.filter((s) => s.trainee.name === name));
      const completed = submissions.filter((s) => s.status === 'Completed').length;
      const grades = submissions.filter((s) => s.grade !== null).map((s) => Number(s.grade));
      const avgGrade = grades.length > 0 ? Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100 : null;
      const latest = [...submissions]
        .filter((s) => s.submittedAt !== null)
        .sort((a, b) => (b.submittedAt as string).localeCompare(a.submittedAt as string))[0];
      return {
        id: user?.id ?? nextId('trainee'),
        name,
        email: user?.email ?? '',
        // Demo Mode's GET /sessions/:id/attendance always returns [] (no per-trainee attendance
        // fixture data exists), so there's nothing to compute a real percentage from here either.
        attendancePercentage: null as number | null,
        assignmentsCompleted: completed,
        assignmentsPending: Math.max(totalAssignments - completed, 0),
        avgGrade,
        latestSubmissionStatus: latest?.status ?? null,
        overallProgress: totalAssignments > 0 ? Math.round((completed / totalAssignments) * 10000) / 100 : null,
        feedbackGiven: feedback.some((f) => f.batchId === batch.id && f.trainee.name === name)
      };
    });
    return { trainees };
  }
  const batchTraineesMatch = matchPath('/batches/:id/trainees', path);
  if (batchTraineesMatch) {
    const batch = batches.find((x) => x.id === batchTraineesMatch.id);
    if (!batch) notFound();
    if (method === 'GET') {
      const members = batch.members.map((name) => {
        const user = DEMO_USERS.find((u) => u.name === name);
        return { id: user?.id ?? nextId('trainee'), name, email: user?.email ?? '' };
      });
      return paginated(members);
    }
    if (method === 'POST') {
      const trainee = DEMO_USERS.find((u) => u.id === b.traineeId);
      if (trainee && !batch.members.includes(trainee.name)) batch.members.push(trainee.name);
      batch.metrics.traineeCount = batch.members.length;
      return { enrollment: { batchId: batch.id, traineeId: b.traineeId } };
    }
  }

  // ---- assignments ----
  if (method === 'GET' && path === '/assignments') {
    let results = assignments;
    if (query?.batchId) results = results.filter((a) => a.batches.some((bb) => bb.id === query.batchId));
    return paginated(results);
  }
  if (method === 'POST' && path === '/assignments') {
    const { batchId, batches: assignmentBatches } = resolveAssignmentBatches(parseBatchIds(b.batchIds));
    const created = {
      id: nextId('demo-assignment'),
      batchId,
      batches: assignmentBatches,
      title: String(b.title ?? 'New Assignment'),
      description: String(b.description ?? ''),
      status: String(b.status ?? 'Draft'),
      deadline: String(b.deadline ?? new Date().toISOString()),
      facilitator: facilitatorRefFor(undefined),
      submissions: [] as DemoSubmission[]
    };
    assignments = [created, ...assignments];
    return { assignment: created };
  }
  const assignmentIdMatch = matchPath('/assignments/:id', path);
  if (assignmentIdMatch) {
    const assignment = assignments.find((x) => x.id === assignmentIdMatch.id);
    if (!assignment) notFound();
    if (method === 'GET') return { assignment };
    if (method === 'PATCH') {
      const { batchIds, ...rest } = b;
      Object.assign(assignment, rest);
      if (batchIds !== undefined) {
        const parsed = parseBatchIds(batchIds);
        if (parsed.length > 0) Object.assign(assignment, resolveAssignmentBatches(parsed));
      }
      return { assignment };
    }
    if (method === 'DELETE') {
      assignments = assignments.filter((x) => x.id !== assignmentIdMatch.id);
      return undefined;
    }
  }
  const assignmentSubsMatch = matchPath('/assignments/:id/submissions', path);
  if (assignmentSubsMatch) {
    const assignment = assignments.find((x) => x.id === assignmentSubsMatch.id);
    if (!assignment) notFound();
    if (method === 'GET') return paginated(assignment.submissions);
    if (method === 'POST') {
      const trainee = currentDemoUser();
      const created = {
        id: nextId('demo-sub'),
        assignmentId: assignment.id,
        traineeId: trainee.id,
        status: 'UnderReview',
        submittedAt: new Date().toISOString(),
        grade: null,
        feedback: null,
        trainee: { id: trainee.id, name: trainee.name, email: trainee.email }
      };
      const existingIdx = assignment.submissions.findIndex((s) => (s as { traineeId: string }).traineeId === trainee.id);
      if (existingIdx >= 0) assignment.submissions[existingIdx] = created;
      else assignment.submissions.push(created);
      return { submission: created };
    }
  }

  // ---- submissions (grading) ----
  const submissionMatch = matchPath('/submissions/:id', path);
  if (method === 'PATCH' && submissionMatch) {
    for (const assignment of assignments) {
      const sub = assignment.submissions.find((s) => (s as { id: string }).id === submissionMatch.id) as Record<string, unknown> | undefined;
      if (sub) {
        Object.assign(sub, b);
        return { submission: sub };
      }
    }
    notFound();
  }
  if (method === 'POST' && matchPath('/submissions/:id/attachments', path)) {
    return { attachment: { id: nextId('demo-attachment') } };
  }

  // ---- sessions ----
  if (method === 'GET' && path === '/sessions') {
    let results = sessions;
    if (query?.batchId) results = results.filter((s) => s.batchId === query.batchId);
    return paginated(results);
  }
  if (method === 'POST' && path === '/sessions') {
    const created = {
      id: nextId('demo-session'),
      batchId: String(b.batchId ?? ''),
      title: String(b.title ?? 'New Session'),
      scheduledAt: String(b.scheduledAt ?? new Date().toISOString()),
      platform: String(b.platform ?? 'Other'),
      meetingLink: (b.meetingLink as string) ?? null,
      status: String(b.status ?? 'Upcoming'),
      facilitator: facilitatorRefFor(undefined)
    };
    sessions = [created, ...sessions];
    return { session: created };
  }
  const sessionIdMatch = matchPath('/sessions/:id', path);
  if (sessionIdMatch) {
    const session = sessions.find((x) => x.id === sessionIdMatch.id);
    if (!session) notFound();
    if (method === 'GET') return { session };
    if (method === 'PATCH') {
      Object.assign(session, b);
      return { session };
    }
    if (method === 'DELETE') {
      sessions = sessions.filter((x) => x.id !== sessionIdMatch.id);
      return undefined;
    }
  }
  const attendanceMatch = matchPath('/sessions/:id/attendance', path);
  if (attendanceMatch) {
    if (method === 'GET') return { attendance: [] };
    if (method === 'PUT') return { attendance: [] };
  }

  // ---- resources ----
  if (method === 'GET' && path === '/resources') {
    let results = resources;
    if (query?.batchId) results = results.filter((r) => r.batchId === query.batchId);
    return paginated(results);
  }
  if (method === 'POST' && path === '/resources') {
    const created = {
      id: nextId('demo-resource'),
      batchId: (b.batchId as string) ?? null,
      title: String(b.title ?? 'New Resource'),
      category: String(b.category ?? 'PDF Guides'),
      version: String(b.version ?? 'v1.0'),
      sizeBytes: '204800',
      uploadedBy: 'demo-facilitator',
      verified: false,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploader: facilitatorRefFor(undefined),
      batch: null as DemoResource['batch']
    };
    resources = [created, ...resources];
    return { resource: created };
  }
  const resourceIdMatch = matchPath('/resources/:id', path);
  if (resourceIdMatch) {
    const resource = resources.find((x) => x.id === resourceIdMatch.id);
    if (!resource) notFound();
    if (method === 'GET') return { resource };
    if (method === 'PATCH') {
      Object.assign(resource, b);
      return { resource };
    }
    if (method === 'DELETE') {
      resources = resources.filter((x) => x.id !== resourceIdMatch.id);
      return undefined;
    }
  }

  // ---- feedback ----
  if (method === 'GET' && path === '/feedback') {
    let results = feedback;
    if (query?.batchId) results = results.filter((f) => f.batchId === query.batchId);
    return paginated(results);
  }
  if (method === 'POST' && path === '/feedback') {
    const submitter = currentDemoUser();
    // Trainees send facilitatorId (feedback about a facilitator); facilitators/admins send
    // traineeId (feedback about a trainee) — see submitFeedback vs submitFeedbackAboutFacilitator.
    const isTraineeSubmitted = b.facilitatorId !== undefined;
    const trainee = isTraineeSubmitted ? submitter : (DEMO_USERS.find((u) => u.id === b.traineeId) ?? submitter);
    const facilitator = isTraineeSubmitted ? facilitatorRefFor(b.facilitatorId as string | undefined) : submitter;
    const created = {
      id: nextId('demo-feedback'),
      batchId: String(b.batchId ?? ''),
      category: String(b.category ?? 'General'),
      rating: Number(b.rating ?? 5),
      comment: (b.comment as string) ?? null,
      createdAt: new Date().toISOString(),
      trainee: { id: trainee.id, name: trainee.name, email: trainee.email },
      facilitator: { id: facilitator.id, name: facilitator.name, email: facilitator.email },
      direction: isTraineeSubmitted ? ('TraineeToFacilitator' as const) : ('FacilitatorToTrainee' as const)
    };
    feedback = [created, ...feedback];
    return { feedback: created };
  }

  // ---- calendar (normalized sessions + assignment deadlines, mirrors the real /calendar shape) ----
  if (method === 'GET' && path === '/calendar') {
    const wantType = (query?.type as string | undefined) ?? 'all';
    const wantBatchId = query?.batchId as string | undefined;

    const sessionEvents =
      wantType === 'all' || wantType === 'session'
        ? sessions
            .filter((s) => !wantBatchId || s.batchId === wantBatchId)
            .map((s) => ({
              id: `session-${s.id}`,
              title: s.title,
              type: 'session',
              start: s.scheduledAt,
              end: null,
              batchIds: [s.batchId],
              batchNames: [batches.find((b) => b.id === s.batchId)?.name ?? ''],
              relatedEntityId: s.id,
              status: s.status,
              metadata: { platform: s.platform, meetingLink: s.meetingLink, facilitatorName: s.facilitator?.name ?? null }
            }))
        : [];

    const assignmentEvents =
      wantType === 'all' || wantType === 'assignment-deadline'
        ? assignments
            .filter((a) => !wantBatchId || a.batchId === wantBatchId)
            .map((a) => ({
              id: `assignment-${a.id}`,
              title: a.title,
              type: 'assignment-deadline',
              start: a.deadline,
              end: null,
              batchIds: [a.batchId],
              batchNames: [batches.find((b) => b.id === a.batchId)?.name ?? ''],
              relatedEntityId: a.id,
              status: a.status,
              metadata: { facilitatorName: a.facilitator?.name ?? null }
            }))
        : [];

    return { events: [...sessionEvents, ...assignmentEvents].sort((x, y) => x.start.localeCompare(y.start)) };
  }

  // Anything not covered above (e.g. notifications — never wired to the real API either, see
  // DEPLOYMENT.md) — return an empty paginated shape rather than throwing, so an unanticipated
  // read during the demo degrades to "no data" instead of a hard error.
  if (method === 'GET') return paginated([]);
  return {};
}

function facilitatorRefFor(id: string | undefined) {
  const user = (id && DEMO_USERS.find((u) => u.id === id)) || DEMO_USERS.find((u) => u.role === 'facilitator')!;
  return { id: user.id, name: user.name, email: user.email };
}
