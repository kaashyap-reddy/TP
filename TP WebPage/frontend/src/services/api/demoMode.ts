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
import {
  DEMO_ANNOUNCEMENTS,
  DEMO_ASSIGNMENTS,
  DEMO_ATTENDANCE,
  DEMO_BATCHES,
  DEMO_FACILITATOR_ASSIGNMENTS,
  DEMO_FEEDBACK,
  DEMO_REASSIGNMENT_REQUESTS,
  DEMO_RESOURCES,
  DEMO_SESSIONS,
  DEMO_TRAINING_PLANS,
  DEMO_USERS,
  nthWorkingDay,
  type DemoAnnouncement,
  type DemoAssignment,
  type DemoAttendanceRecord,
  type DemoBatchFeedbackForm,
  type DemoFacilitatorAssignment,
  type DemoGuestTrainer,
  type DemoReassignmentRequest,
  type DemoResource,
  type DemoSession,
  type DemoSubmission,
  type DemoTrainingPlanRef
} from './demoData';

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
let attendance = clone(DEMO_ATTENDANCE);
let resources = clone(DEMO_RESOURCES);
let feedback = clone(DEMO_FEEDBACK);
let announcements = clone(DEMO_ANNOUNCEMENTS);
let announcementReads: { announcementId: string; userId: string }[] = [];
let facilitatorAssignments = clone(DEMO_FACILITATOR_ASSIGNMENTS);
let reassignmentRequests = clone(DEMO_REASSIGNMENT_REQUESTS);
const trainingPlans = clone(DEMO_TRAINING_PLANS);
// submitterId — the trainee OR facilitator who submitted (a form's audience can target either).
let sessionFeedbackSubmissions: { formId: string; submitterId: string }[] = [];
let assignmentFeedbackSubmissions: { formId: string; submitterId: string }[] = [];
// The demo trainee has already completed the BTech batch's (closed) kickoff feedback form --
// the "locally-marked-completed" demo scenario (Prompt 3, Phase 16).
let batchFeedbackSubmissions: { formId: string; submitterId: string }[] = [
  { formId: 'demo-batch-feedback-btech-kickoff', submitterId: 'demo-trainee' }
];
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

// A session's embedded feedback form shouldn't leak to a role it isn't meant for — e.g. a
// Facilitators-only form showing up (and being usable) on a trainee's calendar. Admin and the
// session's owning facilitator always see it; everyone else only sees it if the form's audience
// actually includes their role. Mirrors sessions.service.ts's withFeedbackFormVisibility() and
// sessionFeedback.service.ts's getForSession() on the real backend.
function withFeedbackFormVisibility(session: DemoSession): DemoSession {
  if (!session.feedbackForm) return session;
  const currentUser = currentDemoUser();
  const isManager = currentUser.role === 'admin' || (currentUser.role === 'facilitator' && currentUser.id === session.facilitator?.id);
  if (isManager) return session;
  if (currentUser.role === 'trainee' && session.feedbackForm.audience === 'Facilitators') return { ...session, feedbackForm: null };
  if (currentUser.role === 'facilitator' && session.feedbackForm.audience === 'Trainees') return { ...session, feedbackForm: null };
  return session;
}

// Same idea as withFeedbackFormVisibility above, but for a form attached directly to an
// Assignment. Demo assignments carry no per-item facilitator owner (they're Training-Plan-owned,
// like the real backend's simplified Assignment response — see demoData.ts's note on this), so
// any admin or facilitator is treated as a manager here; only a trainee gets audience-gated.
function withAssignmentFeedbackFormVisibility(assignment: DemoAssignment): DemoAssignment {
  if (!assignment.feedbackForm) return assignment;
  const currentUser = currentDemoUser();
  if (currentUser.role === 'admin' || currentUser.role === 'facilitator') return assignment;
  if (currentUser.role === 'trainee' && assignment.feedbackForm.audience === 'Facilitators') return { ...assignment, feedbackForm: null };
  return assignment;
}

/** Whether this role is a legitimate respondent for a form with this audience — mirrors sessionFeedback.service.ts's isRespondent(). */
function isRespondentFor(role: string, audience: string): boolean {
  if (role === 'trainee') return audience === 'Trainees' || audience === 'Both';
  if (role === 'facilitator') return audience === 'Facilitators' || audience === 'Both';
  return false;
}

/** Same idea as isRespondentFor, but for BatchFeedbackForm's wider audience enum (Trainees/
 * Facilitators/Primary Coordinators/Admins/Multiple Roles) — see Prompt 3, Phase 2. */
function isRespondentForBroadAudience(role: string, audience: string): boolean {
  if (role === 'trainee') return audience === 'Trainees' || audience === 'Multiple Roles';
  if (role === 'facilitator') return audience === 'Facilitators' || audience === 'Primary Coordinators' || audience === 'Multiple Roles';
  if (role === 'admin') return audience === 'Admins' || audience === 'Multiple Roles';
  return false;
}

/** Admin always manages a batch's feedback forms; a facilitator only if they're actively on that
 * batch's team (primary-coordinator cache or the full facilitatorAssignments roster). */
function isBatchFeedbackManager(currentUser: { id: string; role: string }, batch: { id: string; facilitator: { id: string } | null }): boolean {
  if (currentUser.role === 'admin') return true;
  if (currentUser.role !== 'facilitator') return false;
  if (batch.facilitator?.id === currentUser.id) return true;
  return facilitatorAssignments.some((a) => a.batchId === batch.id && a.facilitatorId === currentUser.id && a.status !== 'Removed');
}

function notFound(): never {
  const err = new Error('Not found.') as Error & { status?: number };
  err.status = 404;
  throw err;
}

// Mirrors the real backend's zod `z.string().trim().url()` validators (sessionFeedback/
// trainingPlans validators) so Demo Mode rejects the same malformed input instead of storing it.
function assertValidUrl(value: unknown, field: string, { required = false } = {}): void {
  if (value === undefined || value === null || value === '') {
    if (required) {
      const err = new Error(`${field} is required.`) as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    return;
  }
  try {
    new URL(String(value).trim());
  } catch {
    const err = new Error(`Please enter a valid ${field} including the protocol (e.g. https://...).`) as Error & { status?: number };
    err.status = 400;
    throw err;
  }
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
function resolveAssignmentBatches(
  batchIds: string[]
): { batchId: string; batches: { id: string; name: string; code: string; trainingPlan: DemoTrainingPlanRef }[] } {
  const resolved = batchIds
    .map((id) => batches.find((x) => x.id === id))
    .filter((x): x is (typeof batches)[number] => x !== undefined);
  return {
    batchId: resolved[0]?.id ?? '',
    batches: resolved.map((b) => ({ id: b.id, name: b.name, code: b.code, trainingPlan: b.trainingPlan }))
  };
}

function deriveProgramTrack(planCode: string): { program: string; track: string } {
  return { program: 'BA', track: planCode.toLowerCase().includes('mba') ? 'MBA' : 'BTech' };
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
    if (query?.facilitatorId) {
      // A facilitator can see every batch they're actively on the team for, not just batches
      // where they happen to be the Primary Coordinator (Batch.facilitator is only that cache).
      const teamBatchIds = new Set(
        facilitatorAssignments.filter((a) => a.facilitatorId === query.facilitatorId && a.status !== 'Removed').map((a) => a.batchId)
      );
      results = results.filter((b) => b.facilitator?.id === query.facilitatorId || teamBatchIds.has(b.id));
    }
    if (query?.traineeId) {
      const trainee = DEMO_USERS.find((u) => u.id === query.traineeId);
      results = results.filter((b) => (trainee ? b.members.includes(trainee.name) : false));
    }
    return paginated(results);
  }
  if (method === 'POST' && path === '/batches') {
    const plan = trainingPlans.find((p) => p.id === b.trainingPlanId);
    if (!plan) {
      const err = new Error('No such training plan.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const { program, track } = deriveProgramTrack(plan.code);
    // Trainer is optional, same as the real backend — only look one up if the Admin picked one.
    const facilitator = b.facilitatorId ? facilitatorRefFor(b.facilitatorId as string) : null;
    const actor = currentDemoUser();
    const startDate = b.startMonth ? new Date(b.startMonth as string) : new Date();

    // "Approximately 2 months" ends up being however long the generated schedule actually runs.
    const lastSessionDayOffset = plan.sessions.reduce((max, s) => Math.max(max, s.dayOffset), -1);
    const endDate =
      lastSessionDayOffset >= 0
        ? nthWorkingDay(startDate, lastSessionDayOffset).toISOString()
        : new Date(startDate.getTime() + plan.durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

    const created = {
      id: nextId('demo-batch'),
      code: String(b.code ?? nextId('batch')),
      name: String(b.name ?? 'New Batch'),
      program,
      track,
      status: String(b.status ?? 'Upcoming'),
      startMonth: startDate.toISOString(),
      endDate,
      facilitator,
      trainingPlan: { id: plan.id, code: plan.code, name: plan.name },
      members: [] as string[],
      metrics: { traineeCount: 0, avgScore: null, completionPct: null, attendanceRate: null, submissionRate: null, feedbackRating: null }
    };
    batches = [created, ...batches];

    // Keep the facilitator-assignment team in sync: a coordinator picked at creation time becomes
    // this batch's first team row (Primary Coordinator), the same single source of truth every
    // other batch uses -- see DEMO_FACILITATOR_ASSIGNMENTS.
    if (facilitator) {
      facilitatorAssignments = [
        ...facilitatorAssignments,
        {
          id: nextId('demo-fa'),
          batchId: created.id,
          facilitatorId: facilitator.id,
          facilitatorName: facilitator.name,
          facilitatorEmail: facilitator.email,
          role: 'Primary Coordinator',
          isPrimaryCoordinator: true,
          status: 'Active',
          assignedAt: new Date().toISOString(),
          assignedBy: actor.name,
          notes: null
        }
      ];
    }

    // Mirrors the real Training Plan automation: instantiate the plan's ~42 sessions (skipping
    // weekends), assignment schedule, resources, and feedback links onto this new batch
    // immediately — the same behavior backend's batches.service.ts create() transaction produces.
    const sessionIdByTemplateId = new Map<string, string>();

    for (const templateSession of plan.sessions) {
      const scheduledAt = new Date(nthWorkingDay(startDate, templateSession.dayOffset).getTime() + templateSession.startMinute * 60 * 1000).toISOString();
      const newSession: DemoSession = {
        id: nextId('demo-session'),
        batchId: created.id,
        title: templateSession.title,
        scheduledAt,
        durationMinutes: templateSession.endMinute - templateSession.startMinute,
        platform: templateSession.platform,
        meetingLink: null,
        status: 'Upcoming',
        facilitator,
        coTrainers: [],
        trainerAssignmentStatus: facilitator ? 'Assigned' : 'Unassigned',
        trainerNotes: null,
        guestTrainer: null,
        relatedAssignments: [],
        feedbackForm: templateSession.feedbackFormUrl
          ? {
              id: nextId('demo-feedback-form'),
              name: `${templateSession.title} — Session Feedback`,
              description: `Share your feedback on the "${templateSession.title}" session (demo link).`,
              formUrl: templateSession.feedbackFormUrl,
              audience: 'Trainees',
              _count: { submissions: 0 }
            }
          : null
      };
      sessions = [...sessions, newSession];
      sessionIdByTemplateId.set(templateSession.id, newSession.id);
    }

    for (const templateAssignment of plan.assignments) {
      const deadline = nthWorkingDay(startDate, templateAssignment.dueDayOffset).toISOString();
      const relatedSessionId = templateAssignment.relatedSessionId ? sessionIdByTemplateId.get(templateAssignment.relatedSessionId) : undefined;
      const relatedSession = relatedSessionId ? sessions.find((s) => s.id === relatedSessionId) : undefined;

      const newAssignment = {
        id: nextId('demo-assignment'),
        batchId: created.id,
        batches: [{ id: created.id, name: created.name, code: created.code, trainingPlan: created.trainingPlan }],
        title: templateAssignment.title,
        agenda: templateAssignment.agenda,
        description: templateAssignment.description,
        status: 'Open',
        deadline,
        session: relatedSession ? { id: relatedSession.id, title: relatedSession.title } : null,
        submissions: [] as DemoSubmission[],
        // Template assignments carry no instructions file, so a batch generated live in the demo
        // honestly shows "No file uploaded" until one is attached via Edit.
        attachment: null
      };
      assignments = [...assignments, newAssignment];
      if (relatedSession) relatedSession.relatedAssignments = [{ id: newAssignment.id, title: newAssignment.title }];
    }

    for (const templateResource of plan.resources) {
      const newResource: DemoResource = {
        id: nextId('demo-resource'),
        batchId: created.id,
        title: templateResource.title,
        category: templateResource.category,
        version: 'v1.0',
        sizeBytes: null,
        externalUrl: templateResource.url,
        uploadedBy: actor.id,
        verified: true,
        downloadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uploader: { id: actor.id, name: actor.name, email: actor.email },
        batch: null
      };
      resources = [...resources, newResource];
    }

    return { batch: created };
  }
  const batchIdMatch = matchPath('/batches/:id', path);
  if (batchIdMatch) {
    const batch = batches.find((x) => x.id === batchIdMatch.id);
    if (!batch) notFound();
    if (method === 'GET') return { batch };
    if (method === 'PATCH') {
      if (b.facilitatorId !== undefined) setPrimaryCoordinatorViaLegacyEdit(batch.id, b.facilitatorId as string | undefined);
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
    const batchSessionIds = new Set(sessions.filter((s) => s.batchId === batch.id).map((s) => s.id));
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
      // Same computation as backend batches.service.ts listTraineeStats(): Present records over
      // all attendance records for this trainee across the batch's sessions.
      const traineeAttendance = attendance.filter((r) => batchSessionIds.has(r.sessionId) && r.traineeId === user?.id);
      const present = traineeAttendance.filter((r) => r.status === 'Present').length;
      return {
        id: user?.id ?? nextId('trainee'),
        name,
        email: user?.email ?? '',
        attendancePercentage: traineeAttendance.length > 0 ? Math.round((present / traineeAttendance.length) * 10000) / 100 : null,
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

  // ---- batch feedback (Phase 2: forms attached to the whole batch/program, not one session or
  // assignment -- e.g. Mid-Program or Final Program Feedback). ----
  const batchFeedbackFormsMatch = matchPath('/batches/:id/feedback-forms', path);
  if (batchFeedbackFormsMatch) {
    const batch = batches.find((x) => x.id === batchFeedbackFormsMatch.id);
    if (!batch) notFound();
    const currentUser = currentDemoUser();
    const isManager = isBatchFeedbackManager(currentUser, batch);
    const forms = batch.feedbackForms ?? [];
    const totalTrainees = batch.members.length;

    if (method === 'GET') {
      // A Draft or reported-Invalid Link form is managerial-only -- a trainee/other-role viewer
      // must never see it listed as if it were a live, usable form (see PHASE 15).
      const visible = isManager
        ? forms
        : forms.filter((f) => f.status !== 'Draft' && f.status !== 'Invalid Link' && isRespondentForBroadAudience(currentUser.role, f.audience));
      return {
        forms: visible.map((f) => {
          const respondent = isRespondentForBroadAudience(currentUser.role, f.audience);
          const mySubmitted = respondent ? batchFeedbackSubmissions.some((s) => s.formId === f.id && s.submitterId === currentUser.id) : null;
          return { ...f, submittedCount: f._count.submissions, totalTrainees, mySubmitted };
        })
      };
    }
    if (method === 'POST') {
      if (!isManager) {
        const err = new Error("Only Admin or this batch's Primary Coordinator/Lead Facilitator can attach a batch feedback form.") as Error & {
          status?: number;
        };
        err.status = 403;
        throw err;
      }
      assertValidUrl(b.formUrl, 'form URL', { required: true });
      const created: DemoBatchFeedbackForm = {
        id: nextId('demo-batch-feedback-form'),
        batchId: batch.id,
        name: String(b.name ?? `${batch.name} Feedback`),
        description: String(b.description ?? ''),
        formUrl: String(b.formUrl ?? ''),
        formType: (b.formType as DemoBatchFeedbackForm['formType']) ?? 'Batch Feedback',
        audience: (b.audience as DemoBatchFeedbackForm['audience']) ?? 'Trainees',
        status: (b.status as DemoBatchFeedbackForm['status']) ?? 'Draft',
        isRequired: Boolean(b.isRequired ?? false),
        instructions: (b.instructions as string) || null,
        openDate: (b.openDate as string) || null,
        dueDate: (b.dueDate as string) || null,
        completionTrackingMode: (b.completionTrackingMode as DemoBatchFeedbackForm['completionTrackingMode']) ?? 'Local Demo Status',
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { submissions: 0 }
      };
      batch.feedbackForms = [...forms, created];
      return { form: { ...created, submittedCount: 0, totalTrainees, mySubmitted: null } };
    }
  }

  const batchFeedbackFormIdMatch = matchPath('/batches/:id/feedback-forms/:formId', path);
  if (batchFeedbackFormIdMatch) {
    const batch = batches.find((x) => x.id === batchFeedbackFormIdMatch.id);
    if (!batch) notFound();
    const form = (batch.feedbackForms ?? []).find((f) => f.id === batchFeedbackFormIdMatch.formId);
    if (!form) notFound();
    const currentUser = currentDemoUser();
    const isManager = isBatchFeedbackManager(currentUser, batch);
    const totalTrainees = batch.members.length;

    if (method === 'PATCH') {
      if (!isManager) {
        const err = new Error("Only Admin or this batch's Primary Coordinator/Lead Facilitator can edit this feedback form.") as Error & {
          status?: number;
        };
        err.status = 403;
        throw err;
      }
      if (b.formUrl !== undefined) assertValidUrl(b.formUrl, 'form URL', { required: true });
      // A facilitator who isn't Primary Coordinator/Lead Facilitator never reaches this point
      // (isManager already excludes plain Trainers) -- but even a coordinating facilitator stays
      // scoped to their own batch and can't touch org-wide template settings (see PHASE 7).
      Object.assign(form, b, { updatedAt: new Date().toISOString() });
      return { form: { ...form, submittedCount: form._count.submissions, totalTrainees, mySubmitted: null } };
    }
    if (method === 'DELETE') {
      if (currentUser.role !== 'admin') {
        const err = new Error('Only Admin can remove a batch feedback form.') as Error & { status?: number };
        err.status = 403;
        throw err;
      }
      batch.feedbackForms = (batch.feedbackForms ?? []).filter((f) => f.id !== form.id);
      return undefined;
    }
  }

  const batchFeedbackSubmitMatch = matchPath('/batches/:id/feedback-forms/:formId/submissions', path);
  if (method === 'POST' && batchFeedbackSubmitMatch) {
    const batch = batches.find((x) => x.id === batchFeedbackSubmitMatch.id);
    if (!batch) notFound();
    const form = (batch.feedbackForms ?? []).find((f) => f.id === batchFeedbackSubmitMatch.formId);
    if (!form) notFound();
    const currentUser = currentDemoUser();
    if (!isRespondentForBroadAudience(currentUser.role, form.audience)) {
      const err = new Error('This feedback form is not for your role.') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const alreadySubmitted = batchFeedbackSubmissions.some((s) => s.formId === form.id && s.submitterId === currentUser.id);
    if (!alreadySubmitted) {
      batchFeedbackSubmissions = [...batchFeedbackSubmissions, { formId: form.id, submitterId: currentUser.id }];
      form._count.submissions += 1;
    }
    return { submission: { id: nextId('demo-batch-feedback-submission') } };
  }

  // ---- training plans ----
  if (method === 'GET' && path === '/training-plans') {
    return {
      trainingPlans: trainingPlans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        durationMonths: p.durationMonths,
        _count: {
          sessions: p.sessions.length,
          assignments: p.assignments.length,
          resources: p.resources.length,
          announcements: p.announcements.length,
          batches: batches.filter((b) => b.trainingPlan.id === p.id).length
        }
      }))
    };
  }
  const trainingPlanIdMatch = matchPath('/training-plans/:id', path);
  if (trainingPlanIdMatch) {
    const plan = trainingPlans.find((p) => p.id === trainingPlanIdMatch.id);
    if (!plan) notFound();
    if (method === 'GET') return { trainingPlan: plan };
    if (method === 'PATCH') {
      Object.assign(plan, b);
      return { trainingPlan: plan };
    }
  }

  const tpSessionsMatch = matchPath('/training-plans/:id/sessions', path);
  if (tpSessionsMatch && method === 'POST') {
    const plan = trainingPlans.find((p) => p.id === tpSessionsMatch.id);
    if (!plan) notFound();
    assertValidUrl(b.feedbackFormUrl, 'feedback form URL');
    const created = {
      id: nextId('demo-tps'),
      title: String(b.title ?? 'New Session'),
      agenda: String(b.agenda ?? ''),
      dayOffset: Number(b.dayOffset ?? 0),
      startMinute: Number(b.startMinute ?? 870),
      endMinute: Number(b.endMinute ?? 990),
      platform: String(b.platform ?? 'Other'),
      order: Number(b.order ?? plan.sessions.length + 1),
      feedbackFormUrl: (b.feedbackFormUrl as string) || null
    };
    plan.sessions = [...plan.sessions, created];
    return { session: created };
  }
  const tpSessionIdMatch = matchPath('/training-plans/:id/sessions/:sessionId', path);
  if (tpSessionIdMatch) {
    const plan = trainingPlans.find((p) => p.id === tpSessionIdMatch.id);
    if (!plan) notFound();
    const session = plan.sessions.find((s) => s.id === tpSessionIdMatch.sessionId);
    if (!session) notFound();
    if (method === 'PATCH') {
      if (b.feedbackFormUrl !== undefined) assertValidUrl(b.feedbackFormUrl, 'feedback form URL');
      Object.assign(session, b);
      return { session };
    }
    if (method === 'DELETE') {
      plan.sessions = plan.sessions.filter((s) => s.id !== tpSessionIdMatch.sessionId);
      return undefined;
    }
  }

  const tpAssignmentsMatch = matchPath('/training-plans/:id/assignments', path);
  if (tpAssignmentsMatch && method === 'POST') {
    const plan = trainingPlans.find((p) => p.id === tpAssignmentsMatch.id);
    if (!plan) notFound();
    const relatedSession = b.relatedSessionId ? plan.sessions.find((s) => s.id === b.relatedSessionId) : undefined;
    const created = {
      id: nextId('demo-tpa'),
      title: String(b.title ?? 'New Assignment'),
      agenda: String(b.agenda ?? ''),
      description: String(b.description ?? ''),
      dueDayOffset: Number(b.dueDayOffset ?? 0),
      relatedSessionId: relatedSession?.id ?? null,
      relatedSession: relatedSession ? { id: relatedSession.id, title: relatedSession.title } : null
    };
    plan.assignments = [...plan.assignments, created];
    return { assignment: created };
  }
  const tpAssignmentIdMatch = matchPath('/training-plans/:id/assignments/:assignmentId', path);
  if (tpAssignmentIdMatch) {
    const plan = trainingPlans.find((p) => p.id === tpAssignmentIdMatch.id);
    if (!plan) notFound();
    const assignment = plan.assignments.find((a) => a.id === tpAssignmentIdMatch.assignmentId);
    if (!assignment) notFound();
    if (method === 'PATCH') {
      const { relatedSessionId, ...rest } = b;
      Object.assign(assignment, rest);
      if (relatedSessionId !== undefined) {
        const relatedSession = relatedSessionId ? plan.sessions.find((s) => s.id === relatedSessionId) : undefined;
        assignment.relatedSessionId = relatedSession?.id ?? null;
        assignment.relatedSession = relatedSession ? { id: relatedSession.id, title: relatedSession.title } : null;
      }
      return { assignment };
    }
    if (method === 'DELETE') {
      plan.assignments = plan.assignments.filter((a) => a.id !== tpAssignmentIdMatch.assignmentId);
      return undefined;
    }
  }

  const tpResourcesMatch = matchPath('/training-plans/:id/resources', path);
  if (tpResourcesMatch && method === 'POST') {
    const plan = trainingPlans.find((p) => p.id === tpResourcesMatch.id);
    if (!plan) notFound();
    assertValidUrl(b.url, 'resource URL', { required: true });
    const created = { id: nextId('demo-tpr'), title: String(b.title ?? 'New Resource'), category: String(b.category ?? ''), url: String(b.url ?? '') };
    plan.resources = [...plan.resources, created];
    return { resource: created };
  }
  const tpResourceIdMatch = matchPath('/training-plans/:id/resources/:resourceId', path);
  if (tpResourceIdMatch) {
    const plan = trainingPlans.find((p) => p.id === tpResourceIdMatch.id);
    if (!plan) notFound();
    const resource = plan.resources.find((r) => r.id === tpResourceIdMatch.resourceId);
    if (!resource) notFound();
    if (method === 'PATCH') {
      if (b.url !== undefined) assertValidUrl(b.url, 'resource URL', { required: true });
      Object.assign(resource, b);
      return { resource };
    }
    if (method === 'DELETE') {
      plan.resources = plan.resources.filter((r) => r.id !== tpResourceIdMatch.resourceId);
      return undefined;
    }
  }

  const tpAnnouncementsMatch = matchPath('/training-plans/:id/announcements', path);
  if (tpAnnouncementsMatch && method === 'POST') {
    const plan = trainingPlans.find((p) => p.id === tpAnnouncementsMatch.id);
    if (!plan) notFound();
    const created = { id: nextId('demo-tpan'), title: String(b.title ?? 'New Announcement'), message: String(b.message ?? ''), priority: String(b.priority ?? 'Normal') };
    plan.announcements = [...plan.announcements, created];
    return { announcement: created };
  }
  const tpAnnouncementIdMatch = matchPath('/training-plans/:id/announcements/:announcementId', path);
  if (tpAnnouncementIdMatch) {
    const plan = trainingPlans.find((p) => p.id === tpAnnouncementIdMatch.id);
    if (!plan) notFound();
    const announcement = plan.announcements.find((a) => a.id === tpAnnouncementIdMatch.announcementId);
    if (!announcement) notFound();
    if (method === 'PATCH') {
      Object.assign(announcement, b);
      return { announcement };
    }
    if (method === 'DELETE') {
      plan.announcements = plan.announcements.filter((a) => a.id !== tpAnnouncementIdMatch.announcementId);
      return undefined;
    }
  }

  // ---- assignments ----
  if (method === 'GET' && path === '/assignments') {
    let results = assignments;
    if (query?.batchId) results = results.filter((a) => a.batches.some((bb) => bb.id === query.batchId));
    return paginated(results.map((a) => withAssignmentFeedbackFormVisibility(a)));
  }
  if (method === 'POST' && path === '/assignments') {
    const { batchId, batches: assignmentBatches } = resolveAssignmentBatches(parseBatchIds(b.batchIds));
    const relatedSession = b.sessionId ? sessions.find((s) => s.id === b.sessionId) : undefined;
    const file = b.file instanceof File ? b.file : null;
    const created = {
      id: nextId('demo-assignment'),
      batchId,
      batches: assignmentBatches,
      title: String(b.title ?? 'New Assignment'),
      agenda: String(b.agenda ?? ''),
      description: String(b.description ?? ''),
      status: String(b.status ?? 'Draft'),
      deadline: String(b.deadline ?? new Date().toISOString()),
      session: relatedSession ? { id: relatedSession.id, title: relatedSession.title } : null,
      submissions: [] as DemoSubmission[],
      attachment: file ? { originalFilename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size } : null
    };
    assignments = [created, ...assignments];
    return { assignment: created };
  }
  const assignmentIdMatch = matchPath('/assignments/:id', path);
  if (assignmentIdMatch) {
    const assignment = assignments.find((x) => x.id === assignmentIdMatch.id);
    if (!assignment) notFound();
    if (method === 'GET') return { assignment: withAssignmentFeedbackFormVisibility(assignment) };
    if (method === 'PATCH') {
      const { batchIds, sessionId, file, ...rest } = b;
      Object.assign(assignment, rest);
      if (file instanceof File) {
        assignment.attachment = { originalFilename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size };
      }
      if (batchIds !== undefined) {
        const parsed = parseBatchIds(batchIds);
        if (parsed.length > 0) Object.assign(assignment, resolveAssignmentBatches(parsed));
      }
      if (sessionId) {
        const relatedSession = sessions.find((s) => s.id === sessionId);
        assignment.session = relatedSession ? { id: relatedSession.id, title: relatedSession.title } : null;
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

  // ---- assignment feedback (external form link + submission tracking, mirrors session feedback) ----
  const assignmentFeedbackFormMatch = matchPath('/assignments/:id/feedback-form', path);
  if (assignmentFeedbackFormMatch) {
    const assignment = assignments.find((x) => x.id === assignmentFeedbackFormMatch.id);
    if (!assignment) notFound();

    const currentUser = currentDemoUser();
    const isManager = currentUser.role === 'admin' || currentUser.role === 'facilitator';

    if (method === 'GET') {
      if (!assignment.feedbackForm) return { form: null };
      if (!isManager && currentUser.role === 'trainee' && assignment.feedbackForm.audience === 'Facilitators') return { form: null };
      const totalTrainees = batches.find((bt) => bt.id === assignment.batchId)?.members.length ?? 0;
      const respondent = isRespondentFor(currentUser.role, assignment.feedbackForm.audience);
      const mySubmitted = respondent
        ? assignmentFeedbackSubmissions.some((s) => s.formId === assignment.feedbackForm!.id && s.submitterId === currentUser.id)
        : null;
      return {
        form: { ...assignment.feedbackForm, submittedCount: assignment.feedbackForm._count.submissions, totalTrainees, mySubmitted }
      };
    }
    if (method === 'POST') {
      if (assignment.feedbackForm) {
        const err = new Error('This assignment already has a feedback form attached — edit it instead.') as Error & { status?: number };
        err.status = 409;
        throw err;
      }
      assertValidUrl(b.formUrl, 'form URL', { required: true });
      assignment.feedbackForm = {
        id: nextId('demo-assignment-feedback-form'),
        name: String(b.name ?? `${assignment.title} Feedback`),
        description: String(b.description ?? ''),
        formUrl: String(b.formUrl ?? ''),
        audience: (b.audience as 'Trainees' | 'Facilitators' | 'Both') ?? 'Both',
        _count: { submissions: 0 }
      };
      const totalTrainees = batches.find((bt) => bt.id === assignment.batchId)?.members.length ?? 0;
      return { form: { ...assignment.feedbackForm, submittedCount: 0, totalTrainees, mySubmitted: null } };
    }
    if (method === 'PATCH' && assignment.feedbackForm) {
      if (b.formUrl !== undefined) assertValidUrl(b.formUrl, 'form URL', { required: true });
      if (b.name !== undefined) assignment.feedbackForm.name = String(b.name);
      if (b.description !== undefined) assignment.feedbackForm.description = String(b.description);
      if (b.formUrl !== undefined) assignment.feedbackForm.formUrl = String(b.formUrl);
      if (b.audience !== undefined) assignment.feedbackForm.audience = b.audience as 'Trainees' | 'Facilitators' | 'Both';
      const totalTrainees = batches.find((bt) => bt.id === assignment.batchId)?.members.length ?? 0;
      return {
        form: { ...assignment.feedbackForm, submittedCount: assignment.feedbackForm._count.submissions, totalTrainees, mySubmitted: null }
      };
    }
    if (method === 'DELETE' && assignment.feedbackForm) {
      assignment.feedbackForm = null;
      return undefined;
    }
  }
  const assignmentFeedbackSubmitMatch = matchPath('/assignments/:id/feedback-form/submissions', path);
  if (method === 'POST' && assignmentFeedbackSubmitMatch) {
    const assignment = assignments.find((x) => x.id === assignmentFeedbackSubmitMatch.id);
    if (!assignment || !assignment.feedbackForm) notFound();
    const currentUser = currentDemoUser();
    if (!isRespondentFor(currentUser.role, assignment.feedbackForm.audience)) {
      const err = new Error('This feedback form is not for your role.') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const alreadySubmitted = assignmentFeedbackSubmissions.some((s) => s.formId === assignment.feedbackForm!.id && s.submitterId === currentUser.id);
    if (!alreadySubmitted) {
      assignmentFeedbackSubmissions = [...assignmentFeedbackSubmissions, { formId: assignment.feedbackForm.id, submitterId: currentUser.id }];
      assignment.feedbackForm._count.submissions += 1;
    }
    return { submission: { id: nextId('demo-assignment-feedback-submission') } };
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
  const submissionAttachMatch = matchPath('/submissions/:id/attachments', path);
  if (method === 'POST' && submissionAttachMatch) {
    // Mirror the real backend's response shape (submissions.service.ts) — the store reads
    // originalFilename/mimeType off it to show "My Submission" immediately after upload, and
    // storing it on the demo submission keeps the filename visible across a refetch too.
    const file = b.file instanceof File ? b.file : null;
    const attachment = {
      id: nextId('demo-attachment'),
      originalFilename: file?.name ?? 'submission.txt',
      mimeType: file?.type || 'text/plain',
      sizeBytes: file?.size ?? 0,
      uploadedAt: new Date().toISOString(),
      isCurrent: true
    };
    for (const assignment of assignments) {
      const sub = assignment.submissions.find((s) => s.id === submissionAttachMatch.id);
      if (sub) {
        sub.attachments = [attachment];
        break;
      }
    }
    return { attachment };
  }

  // ---- sessions ----
  if (method === 'GET' && path === '/sessions') {
    let results = sessions;
    if (query?.batchId) results = results.filter((s) => s.batchId === query.batchId);
    return paginated(results.map((s) => withFeedbackFormVisibility(s)));
  }
  if (method === 'POST' && path === '/sessions') {
    const created: DemoSession = {
      id: nextId('demo-session'),
      batchId: String(b.batchId ?? ''),
      title: String(b.title ?? 'New Session'),
      scheduledAt: String(b.scheduledAt ?? new Date().toISOString()),
      durationMinutes: Number(b.durationMinutes ?? 120),
      platform: String(b.platform ?? 'Other'),
      meetingLink: (b.meetingLink as string) ?? null,
      status: String(b.status ?? 'Upcoming'),
      // Ad-hoc sessions start unassigned rather than silently defaulting to some arbitrary
      // facilitator -- the Admin assigns a trainer explicitly afterward (see Phase 5).
      facilitator: null,
      coTrainers: [],
      trainerAssignmentStatus: 'Unassigned',
      trainerNotes: null,
      guestTrainer: null,
      relatedAssignments: [],
      feedbackForm: null
    };
    sessions = [created, ...sessions];
    return { session: created };
  }
  const sessionIdMatch = matchPath('/sessions/:id', path);
  if (sessionIdMatch) {
    const session = sessions.find((x) => x.id === sessionIdMatch.id);
    if (!session) notFound();
    if (method === 'GET') return { session: withFeedbackFormVisibility(session) };
    if (method === 'PATCH') {
      const trainerKeys = ['primaryTrainerId', 'coTrainerIds', 'guestTrainer', 'trainerNotes'];
      if (trainerKeys.some((k) => k in b)) applyTrainerAssignmentPatch(session, b);
      const rest = Object.fromEntries(Object.entries(b).filter(([k]) => !trainerKeys.includes(k)));
      Object.assign(session, rest);
      return { session };
    }
    if (method === 'DELETE') {
      sessions = sessions.filter((x) => x.id !== sessionIdMatch.id);
      return undefined;
    }
  }
  const attendanceMatch = matchPath('/sessions/:id/attendance', path);
  if (attendanceMatch) {
    const session = sessions.find((x) => x.id === attendanceMatch.id);
    if (!session) notFound();
    const forSession = () => attendance.filter((r) => r.sessionId === session.id);
    if (method === 'GET') return { attendance: forSession() };
    if (method === 'PUT') {
      // Mirrors the real backend's bulkMark() upsert: one record per (session, trainee).
      const records = Array.isArray(b.records) ? (b.records as { traineeId: string; status: 'Present' | 'Absent' }[]) : [];
      const actor = currentDemoUser();
      for (const record of records) {
        const existing = attendance.find((r) => r.sessionId === session.id && r.traineeId === record.traineeId);
        if (existing) {
          existing.status = record.status;
          existing.markedBy = actor.id;
          existing.markedAt = new Date().toISOString();
        } else {
          const trainee = DEMO_USERS.find((u) => u.id === record.traineeId);
          const created: DemoAttendanceRecord = {
            id: nextId('demo-att'),
            sessionId: session.id,
            traineeId: record.traineeId,
            status: record.status,
            markedBy: actor.id,
            markedAt: new Date().toISOString(),
            trainee: trainee ? { id: trainee.id, name: trainee.name, email: trainee.email } : { id: record.traineeId, name: '', email: '' }
          };
          attendance = [...attendance, created];
        }
      }
      return { attendance: forSession() };
    }
  }

  // ---- session feedback (external form link + submission tracking) ----
  const feedbackFormMatch = matchPath('/sessions/:id/feedback-form', path);
  if (feedbackFormMatch) {
    const session = sessions.find((x) => x.id === feedbackFormMatch.id);
    if (!session) notFound();

    const currentUser = currentDemoUser();
    const isManager = currentUser.role === 'admin' || (currentUser.role === 'facilitator' && currentUser.id === session.facilitator?.id);

    if (method === 'GET') {
      if (!session.feedbackForm) return { form: null };
      if (!isManager) {
        if (currentUser.role === 'trainee' && session.feedbackForm.audience === 'Facilitators') return { form: null };
        if (currentUser.role === 'facilitator' && session.feedbackForm.audience === 'Trainees') return { form: null };
      }
      const totalTrainees = batches.find((bt) => bt.id === session.batchId)?.members.length ?? 0;
      const respondent = isRespondentFor(currentUser.role, session.feedbackForm.audience);
      const mySubmitted = respondent
        ? sessionFeedbackSubmissions.some((s) => s.formId === session.feedbackForm!.id && s.submitterId === currentUser.id)
        : null;
      return {
        form: { ...session.feedbackForm, submittedCount: session.feedbackForm._count.submissions, totalTrainees, mySubmitted }
      };
    }
    if (method === 'POST') {
      assertValidUrl(b.formUrl, 'form URL', { required: true });
      session.feedbackForm = {
        id: nextId('demo-feedback-form'),
        name: String(b.name ?? `${session.title} Feedback`),
        description: String(b.description ?? ''),
        formUrl: String(b.formUrl ?? ''),
        audience: (b.audience as 'Trainees' | 'Facilitators' | 'Both') ?? 'Both',
        _count: { submissions: 0 }
      };
      const totalTrainees = batches.find((bt) => bt.id === session.batchId)?.members.length ?? 0;
      return { form: { ...session.feedbackForm, submittedCount: 0, totalTrainees, mySubmitted: null } };
    }
    if (method === 'PATCH' && session.feedbackForm) {
      if (b.formUrl !== undefined) assertValidUrl(b.formUrl, 'form URL', { required: true });
      if (b.name !== undefined) session.feedbackForm.name = String(b.name);
      if (b.description !== undefined) session.feedbackForm.description = String(b.description);
      if (b.formUrl !== undefined) session.feedbackForm.formUrl = String(b.formUrl);
      if (b.audience !== undefined) session.feedbackForm.audience = b.audience as 'Trainees' | 'Facilitators' | 'Both';
      const totalTrainees = batches.find((bt) => bt.id === session.batchId)?.members.length ?? 0;
      return {
        form: { ...session.feedbackForm, submittedCount: session.feedbackForm._count.submissions, totalTrainees, mySubmitted: null }
      };
    }
    if (method === 'DELETE' && session.feedbackForm) {
      session.feedbackForm = null;
      return undefined;
    }
  }
  const feedbackFormSubmitMatch = matchPath('/sessions/:id/feedback-form/submissions', path);
  if (method === 'POST' && feedbackFormSubmitMatch) {
    const session = sessions.find((x) => x.id === feedbackFormSubmitMatch.id);
    if (!session || !session.feedbackForm) notFound();
    const currentUser = currentDemoUser();
    if (!isRespondentFor(currentUser.role, session.feedbackForm.audience)) {
      const err = new Error('This feedback form is not for your role.') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const alreadySubmitted = sessionFeedbackSubmissions.some((s) => s.formId === session.feedbackForm!.id && s.submitterId === currentUser.id);
    if (!alreadySubmitted) {
      sessionFeedbackSubmissions = [...sessionFeedbackSubmissions, { formId: session.feedbackForm.id, submitterId: currentUser.id }];
      session.feedbackForm._count.submissions += 1;
    }
    return { submission: { id: nextId('demo-feedback-submission') } };
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
      externalUrl: null,
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

  // ---- announcements ---- (mirrors backend/src/services/announcements.service.ts's scoping)
  if (method === 'GET' && path === '/announcements') {
    const currentUser = currentDemoUser();
    let results = announcements;
    if (currentUser.role !== 'admin') {
      const teamBatchIds = new Set(facilitatorAssignments.filter((a) => a.facilitatorId === currentUser.id && a.status !== 'Removed').map((a) => a.batchId));
      const ownedOrEnrolledBatchIds = new Set(
        batches
          .filter((b) => (currentUser.role === 'facilitator' ? b.facilitator?.id === currentUser.id || teamBatchIds.has(b.id) : b.members.includes(currentUser.name)))
          .map((b) => b.id)
      );
      results = results.filter((a) => a.batchId === null || ownedOrEnrolledBatchIds.has(a.batchId));
    }
    if (query?.batchId) results = results.filter((a) => a.batchId === query.batchId);
    const serialized = results.map((a) => ({
      ...a,
      readByCount: announcementReads.filter((r) => r.announcementId === a.id).length,
      isRead: announcementReads.some((r) => r.announcementId === a.id && r.userId === currentUser.id)
    }));
    return paginated(serialized);
  }
  if (method === 'POST' && path === '/announcements') {
    const currentUser = currentDemoUser();
    const batchId = (b.batchId as string | null) ?? null;
    if (batchId) {
      const batch = batches.find((bt) => bt.id === batchId);
      if (!batch) {
        const err = new Error('No such batch.') as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      if (currentUser.role === 'facilitator' && batch.facilitator?.id !== currentUser.id) {
        const err = new Error('You may only post announcements to your own batches.') as Error & { status?: number };
        err.status = 403;
        throw err;
      }
    } else if (currentUser.role !== 'admin') {
      const err = new Error('Only admins may post global announcements.') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const batchRef = batchId ? batches.find((bt) => bt.id === batchId) : undefined;
    const created: DemoAnnouncement = {
      id: nextId('demo-announcement'),
      authorId: currentUser.id,
      batchId,
      title: String(b.title ?? 'New Announcement'),
      message: String(b.message ?? ''),
      priority: (b.priority as DemoAnnouncement['priority']) ?? 'Normal',
      audience: String(b.audience ?? 'All Users'),
      pinned: Boolean(b.pinned ?? false),
      scheduledFor: (b.scheduledFor as string) || null,
      expiresAt: (b.expiresAt as string) || null,
      createdAt: new Date().toISOString(),
      author: { id: currentUser.id, name: currentUser.name, email: currentUser.email },
      batch: batchRef ? { id: batchRef.id, name: batchRef.name, code: batchRef.code } : null
    };
    announcements = [created, ...announcements];
    return { announcement: { ...created, readByCount: 0, isRead: false } };
  }
  const announcementReadMatch = matchPath('/announcements/:id/read', path);
  if (method === 'POST' && announcementReadMatch) {
    const announcement = announcements.find((a) => a.id === announcementReadMatch.id);
    if (!announcement) notFound();
    const currentUser = currentDemoUser();
    if (!announcementReads.some((r) => r.announcementId === announcement.id && r.userId === currentUser.id)) {
      announcementReads = [...announcementReads, { announcementId: announcement.id, userId: currentUser.id }];
    }
    return undefined;
  }

  // ---- facilitator assignments (the batch-facilitator many-to-many team) ----
  if (method === 'GET' && path === '/facilitator-assignments') {
    let results = facilitatorAssignments;
    if (query?.batchId) results = results.filter((a) => a.batchId === query.batchId);
    if (query?.facilitatorId) results = results.filter((a) => a.facilitatorId === query.facilitatorId);
    return paginated(results.map((a) => ({ ...a, ...sessionCountsFor(a.batchId, a.facilitatorId) })));
  }
  if (method === 'POST' && path === '/facilitator-assignments') {
    const batchId = String(b.batchId ?? '');
    const facilitatorId = String(b.facilitatorId ?? '');
    const batch = batches.find((x) => x.id === batchId);
    if (!batch) notFound();
    const duplicate = facilitatorAssignments.some((a) => a.batchId === batchId && a.facilitatorId === facilitatorId && a.status !== 'Removed');
    if (duplicate) {
      const err = new Error('This facilitator is already on the batch\'s team.') as Error & { status?: number };
      err.status = 409;
      throw err;
    }
    const facilitatorUser = DEMO_USERS.find((u) => u.id === facilitatorId);
    if (!facilitatorUser) {
      const err = new Error('No such facilitator.') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const actor = currentDemoUser();
    const created: DemoFacilitatorAssignment = {
      id: nextId('demo-fa'),
      batchId,
      facilitatorId,
      facilitatorName: facilitatorUser.name,
      facilitatorEmail: facilitatorUser.email,
      role: String(b.role ?? 'Trainer'),
      isPrimaryCoordinator: false,
      status: 'Active',
      assignedAt: new Date().toISOString(),
      assignedBy: actor.name,
      notes: (b.notes as string) || null
    };
    facilitatorAssignments = [...facilitatorAssignments, created];
    return { assignment: { ...created, ...sessionCountsFor(batchId, facilitatorId) } };
  }
  const facilitatorAssignmentSetPrimaryMatch = matchPath('/facilitator-assignments/:id/set-primary', path);
  if (method === 'POST' && facilitatorAssignmentSetPrimaryMatch) {
    const target = facilitatorAssignments.find((a) => a.id === facilitatorAssignmentSetPrimaryMatch.id);
    if (!target) notFound();
    for (const a of facilitatorAssignments) {
      if (a.batchId !== target.batchId) continue;
      if (a.isPrimaryCoordinator && a.id !== target.id) {
        a.isPrimaryCoordinator = false;
        a.role = 'Lead Facilitator';
      }
    }
    target.isPrimaryCoordinator = true;
    target.role = 'Primary Coordinator';
    syncBatchPrimaryCoordinator(target.batchId);
    return { assignment: { ...target, ...sessionCountsFor(target.batchId, target.facilitatorId) } };
  }
  const facilitatorAssignmentIdMatch = matchPath('/facilitator-assignments/:id', path);
  if (facilitatorAssignmentIdMatch) {
    const assignment = facilitatorAssignments.find((a) => a.id === facilitatorAssignmentIdMatch.id);
    if (!assignment) notFound();
    if (method === 'PATCH') {
      Object.assign(assignment, b);
      return { assignment: { ...assignment, ...sessionCountsFor(assignment.batchId, assignment.facilitatorId) } };
    }
    if (method === 'DELETE') {
      // Soft-remove: keeps the row (and any already-delivered sessions' historical trainer
      // association) intact for audit purposes, rather than erasing the relationship outright.
      assignment.status = 'Removed';
      assignment.isPrimaryCoordinator = false;
      syncBatchPrimaryCoordinator(assignment.batchId);
      return undefined;
    }
  }

  // ---- reassignment requests (simple demo-mode workflow -- see Phase 11) ----
  if (method === 'GET' && path === '/reassignment-requests') {
    let results = reassignmentRequests;
    if (query?.batchId) results = results.filter((r) => r.batchId === query.batchId);
    if (query?.status) results = results.filter((r) => r.status === query.status);
    return paginated(results);
  }
  if (method === 'POST' && path === '/reassignment-requests') {
    const session = sessions.find((s) => s.id === b.sessionId);
    if (!session) notFound();
    const actor = currentDemoUser();
    const created: DemoReassignmentRequest = {
      id: nextId('demo-rr'),
      sessionId: session.id,
      batchId: session.batchId,
      requestedById: actor.id,
      reason: String(b.reason ?? ''),
      suggestedReplacementId: (b.suggestedReplacementId as string) || null,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      reviewedBy: null,
      reviewNotes: null
    };
    reassignmentRequests = [created, ...reassignmentRequests];
    session.trainerAssignmentStatus = 'Reassignment Requested';
    return { request: created };
  }
  const reassignmentRequestIdMatch = matchPath('/reassignment-requests/:id', path);
  if (method === 'PATCH' && reassignmentRequestIdMatch) {
    const request = reassignmentRequests.find((r) => r.id === reassignmentRequestIdMatch.id);
    if (!request) notFound();
    const actor = currentDemoUser();
    const nextStatus = String(b.status ?? request.status);
    request.status = nextStatus;
    request.reviewedBy = actor.name;
    request.reviewNotes = (b.reviewNotes as string) || request.reviewNotes;
    const session = sessions.find((s) => s.id === request.sessionId);
    if (session) {
      if (nextStatus === 'Approved' && request.suggestedReplacementId) {
        const replacement = DEMO_USERS.find((u) => u.id === request.suggestedReplacementId);
        session.facilitator = replacement ? { id: replacement.id, name: replacement.name, email: replacement.email } : null;
        session.trainerAssignmentStatus = replacement ? 'Assigned' : 'Unassigned';
      } else if (nextStatus === 'Approved' || nextStatus === 'Resolved') {
        session.trainerAssignmentStatus = session.facilitator ? 'Assigned' : 'Unassigned';
      } else if (nextStatus === 'Rejected' || nextStatus === 'Cancelled') {
        session.trainerAssignmentStatus = session.facilitator ? 'Confirmed' : 'Unassigned';
      }
    }
    return { request };
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
              // Assignments are Training-Plan-owned, not facilitator-owned, in the new workflow —
              // the real backend's calendar metadata still exposes a facilitatorName (an internal
              // ownership detail unrelated to the Assignment API response change), but demo
              // fixtures no longer track a per-assignment facilitator to mirror that with.
              metadata: { facilitatorName: null }
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

/** How many of this batch's sessions this facilitator is primary or a co-trainer on -- computed
 * live from `sessions` rather than stored, so it's always accurate after any reassignment. */
function sessionCountsFor(batchId: string, facilitatorId: string): { sessionCount: number; upcomingSessionCount: number } {
  const now = Date.now();
  const involved = sessions.filter(
    (s) => s.batchId === batchId && (s.facilitator?.id === facilitatorId || s.coTrainers.some((c) => c.id === facilitatorId))
  );
  return {
    sessionCount: involved.length,
    upcomingSessionCount: involved.filter((s) => new Date(s.scheduledAt).getTime() > now).length
  };
}

/** Batch.facilitator is a denormalized cache of whichever facilitatorAssignments row for this
 * batch has isPrimaryCoordinator === true -- this is the one place that cache gets written. */
function syncBatchPrimaryCoordinator(batchId: string): void {
  const batch = batches.find((x) => x.id === batchId);
  if (!batch) return;
  const primary = facilitatorAssignments.find((a) => a.batchId === batchId && a.isPrimaryCoordinator && a.status !== 'Removed');
  batch.facilitator = primary ? { id: primary.facilitatorId, name: primary.facilitatorName, email: primary.facilitatorEmail } : null;
}

/** The older "Edit Batch" flow (PATCH /batches/:id with a bare facilitatorId) still needs to
 * route through the same assignment-table source of truth, not write batch.facilitator directly. */
function setPrimaryCoordinatorViaLegacyEdit(batchId: string, facilitatorId: string | undefined): void {
  for (const a of facilitatorAssignments) {
    if (a.batchId === batchId && a.isPrimaryCoordinator) {
      a.isPrimaryCoordinator = false;
      a.role = 'Lead Facilitator';
    }
  }
  if (facilitatorId) {
    const existing = facilitatorAssignments.find((a) => a.batchId === batchId && a.facilitatorId === facilitatorId && a.status !== 'Removed');
    if (existing) {
      existing.isPrimaryCoordinator = true;
      existing.role = 'Primary Coordinator';
      existing.status = 'Active';
    } else {
      const user = DEMO_USERS.find((u) => u.id === facilitatorId);
      if (user) {
        facilitatorAssignments = [
          ...facilitatorAssignments,
          {
            id: nextId('demo-fa'),
            batchId,
            facilitatorId: user.id,
            facilitatorName: user.name,
            facilitatorEmail: user.email,
            role: 'Primary Coordinator',
            isPrimaryCoordinator: true,
            status: 'Active',
            assignedAt: new Date().toISOString(),
            assignedBy: currentDemoUser().name,
            notes: null
          }
        ];
      }
    }
  }
  syncBatchPrimaryCoordinator(batchId);
}

/** Resolves primaryTrainerId/coTrainerIds/guestTrainer patch fields into the DemoSession shape --
 * kept separate from the generic Object.assign in the /sessions/:id PATCH handler because these
 * three need id -> PersonRef resolution, not a raw pass-through. */
function applyTrainerAssignmentPatch(session: DemoSession, patch: Record<string, unknown>): void {
  if ('primaryTrainerId' in patch) {
    const id = patch.primaryTrainerId as string | null | undefined;
    session.facilitator = id ? facilitatorRefFor(id) : null;
  }
  if ('coTrainerIds' in patch) {
    const ids = Array.isArray(patch.coTrainerIds) ? (patch.coTrainerIds as string[]) : [];
    session.coTrainers = ids.map((id) => facilitatorRefFor(id));
  }
  if ('guestTrainer' in patch) {
    session.guestTrainer = (patch.guestTrainer as DemoGuestTrainer | null) ?? null;
    if (session.guestTrainer) session.facilitator = null;
  }
  if ('trainerNotes' in patch) {
    session.trainerNotes = (patch.trainerNotes as string) || null;
  }
  if (session.guestTrainer) session.trainerAssignmentStatus = 'Assigned';
  else if (session.facilitator) session.trainerAssignmentStatus = session.coTrainers.length > 0 ? 'Confirmed' : 'Assigned';
  else if (session.coTrainers.length > 0) session.trainerAssignmentStatus = 'Partially Assigned';
  else session.trainerAssignmentStatus = 'Unassigned';
}
