// Fixture data for Demo Mode (see demoMode.ts). Shaped exactly like the real backend's raw API
// responses (pre-frontend-mapping) so it can be returned from the same interception point
// regardless of which service/store consumes it — nothing downstream needs to know it's fake.
//
// Mirrors the org's real workflow: exactly two Training Plans (BA BTech, BA MBA), each a full
// ~42-session, 5-day-week curriculum, with one demo batch per plan generated from it — the same
// shape production data has once seeded (see backend/prisma/seed.ts, which this mirrors).

interface PersonRef {
  id: string;
  name: string;
  email: string;
}

export interface DemoUser extends PersonRef {
  role: string;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  profile: {
    phone: string;
    location: string;
    company: string | null;
    department: string | null;
    idNumber: string;
    avatarStorageKey: string | null;
    batch?: string;
    course?: string;
  };
}

export interface DemoTrainingPlanRef {
  id: string;
  code: string;
  name: string;
}

export interface DemoBatch {
  id: string;
  code: string;
  name: string;
  program: string;
  track: string;
  status: string;
  startMonth: string | null;
  endDate: string | null;
  facilitator: PersonRef | null;
  trainingPlan: DemoTrainingPlanRef;
  members: string[];
  metrics: {
    traineeCount: number;
    avgScore: number | null;
    completionPct: number | null;
    attendanceRate: number | null;
    submissionRate: number | null;
    feedbackRating: number | null;
  };
}

export interface DemoSubmission {
  id: string;
  assignmentId: string;
  traineeId: string;
  status: string;
  submittedAt: string | null;
  grade: string | null;
  feedback: string | null;
  trainee: PersonRef;
  /** Same shape the real backend serializes (submissions.service.ts) — set by the demo upload route. */
  attachments?: { id: string; originalFilename: string; mimeType: string; sizeBytes: number; uploadedAt: string; isCurrent: boolean }[];
}

export interface DemoAssignmentFeedbackForm {
  id: string;
  name: string;
  description: string;
  formUrl: string;
  audience: 'Trainees' | 'Facilitators' | 'Both';
  _count: { submissions: number };
}

export interface DemoAssignment {
  id: string;
  batchId: string;
  batches: { id: string; name: string; code: string; trainingPlan: DemoTrainingPlanRef }[];
  title: string;
  /** What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics"). */
  agenda: string;
  description: string;
  status: string;
  deadline: string;
  session: { id: string; title: string } | null;
  submissions: DemoSubmission[];
  feedbackForm?: DemoAssignmentFeedbackForm | null;
  /** Instructions-file metadata, same shape the real backend serializes. Demo downloads resolve to a labeled sample file (see apiClient.ts's apiDownload). */
  attachment?: { originalFilename: string; mimeType: string; sizeBytes: number } | null;
}

export interface DemoAttendanceRecord {
  id: string;
  sessionId: string;
  traineeId: string;
  status: 'Present' | 'Absent';
  markedBy: string;
  markedAt: string;
  trainee: PersonRef;
}

export interface DemoSessionFeedbackForm {
  id: string;
  name: string;
  description: string;
  formUrl: string;
  audience: 'Trainees' | 'Facilitators' | 'Both';
  _count: { submissions: number };
}

export interface DemoSession {
  id: string;
  batchId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  platform: string;
  meetingLink: string | null;
  status: string;
  facilitator: PersonRef | null;
  relatedAssignments: { id: string; title: string }[];
  feedbackForm: DemoSessionFeedbackForm | null;
}

export interface DemoResource {
  id: string;
  batchId: string | null;
  title: string;
  category: string;
  version: string;
  sizeBytes: string | null;
  externalUrl: string | null;
  uploadedBy: string;
  verified: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  uploader: PersonRef;
  batch: { id: string; name: string; code: string } | null;
}

export interface DemoFeedback {
  id: string;
  batchId: string;
  category: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  trainee: PersonRef;
  facilitator: PersonRef;
  direction?: 'FacilitatorToTrainee' | 'TraineeToFacilitator';
}

export interface DemoTrainingPlanSession {
  id: string;
  title: string;
  /** What the session covers (e.g. "Requirements Gathering Techniques"). */
  agenda: string;
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  platform: string;
  order: number;
  feedbackFormUrl: string | null;
}

export interface DemoTrainingPlanAssignment {
  id: string;
  title: string;
  agenda: string;
  description: string;
  dueDayOffset: number;
  relatedSessionId: string | null;
  relatedSession: { id: string; title: string } | null;
}

export interface DemoTrainingPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMonths: number;
  defaultSessionStartMinute: number;
  defaultSessionEndMinute: number;
  defaultAssignmentStartMinute: number;
  defaultAssignmentDeadlineMinute: number;
  sessions: DemoTrainingPlanSession[];
  assignments: DemoTrainingPlanAssignment[];
  resources: { id: string; title: string; category: string; url: string }[];
  announcements: { id: string; title: string; message: string; priority: string }[];
}

// ---- working-day date math (also used by demoMode.ts for the live create-batch automation) ----
// Mirrors backend/src/services/batches.service.ts exactly: the training week is Mon-Fri, weekends
// are skipped automatically, and dayOffset/dueDayOffset are expressed in working-day terms.
const DAY_MS = 24 * 60 * 60 * 1000;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Local, not UTC — startMinute/endMinute (e.g. 870 = 14:30) are a literal wall-clock time, and
// sessionService.ts displays scheduledAt using local getHours()/getMinutes(); anchoring to UTC
// midnight here would silently shift every generated session's displayed time.
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function nthWorkingDay(start: Date, n: number): Date {
  let date = startOfLocalDay(start);
  while (isWeekend(date)) date = new Date(date.getTime() + DAY_MS);

  let count = 0;
  while (count < n) {
    date = new Date(date.getTime() + DAY_MS);
    if (!isWeekend(date)) count += 1;
  }
  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// ---- curriculum generation: ~42 working-day sessions (14:30-16:30 instructor-led slot), a
// same-day case-study assignment on every working day except orientation/wrap-up days — mirrors
// backend/prisma/seed.ts's buildCurriculum() exactly ----
const SESSION_START_MINUTE = 14 * 60 + 30;
const SESSION_END_MINUTE = 16 * 60 + 30;
const ASSIGNMENT_START_MINUTE = 9 * 60 + 30;
const ASSIGNMENT_DEADLINE_MINUTE = 23 * 60 + 59;
const SESSION_COUNT = 42;
const NON_ASSIGNMENT_TITLE_PATTERN = /orientation|wrap-up/i;

interface CurriculumDay {
  title: string;
  agenda: string;
  dayOffset: number;
  feedbackFormUrl: string;
}
interface CurriculumAssignmentSpec {
  title: string;
  agenda: string;
  description: string;
  dueDayOffset: number;
  relatedDayOffset: number;
}

function buildCurriculumDays(planCode: string, topics: string[]): CurriculumDay[] {
  const days: CurriculumDay[] = [];
  for (let day = 0; day < SESSION_COUNT; day++) {
    const topic = topics[day % topics.length];
    const week = Math.floor(day / 5) + 1;
    days.push({
      title: `${topic} — Week ${week}`,
      agenda: topic,
      dayOffset: day,
      feedbackFormUrl: `https://forms.gle/${planCode}-day-${day + 1}-feedback`
    });
  }
  return days;
}

function buildCurriculumAssignments(agendas: string[], days: CurriculumDay[]): CurriculumAssignmentSpec[] {
  const specs: CurriculumAssignmentSpec[] = [];
  let agendaIndex = 0;
  for (let day = 0; day < SESSION_COUNT; day++) {
    if (NON_ASSIGNMENT_TITLE_PATTERN.test(days[day].title)) continue;
    const agenda = agendas[agendaIndex % agendas.length];
    agendaIndex += 1;
    specs.push({
      title: `${agenda} Case Study — Day ${day + 1}`,
      agenda,
      description: `Apply what was covered in today's session: ${agenda.toLowerCase()}. Due end of day.`,
      dueDayOffset: day,
      relatedDayOffset: day
    });
  }
  return specs;
}

function toTemplateSessions(prefix: string, days: CurriculumDay[], platform: string): DemoTrainingPlanSession[] {
  return days.map((d, i) => ({
    id: `${prefix}-tps-${i}`,
    title: d.title,
    agenda: d.agenda,
    dayOffset: d.dayOffset,
    startMinute: SESSION_START_MINUTE,
    endMinute: SESSION_END_MINUTE,
    platform,
    order: i + 1,
    feedbackFormUrl: d.feedbackFormUrl
  }));
}

function toTemplateAssignments(
  prefix: string,
  specs: CurriculumAssignmentSpec[],
  templateSessions: DemoTrainingPlanSession[]
): DemoTrainingPlanAssignment[] {
  return specs.map((a, i) => {
    const related = templateSessions[a.relatedDayOffset] ?? null;
    return {
      id: `${prefix}-tpa-${i}`,
      title: a.title,
      agenda: a.agenda,
      description: a.description,
      dueDayOffset: a.dueDayOffset,
      relatedSessionId: related?.id ?? null,
      relatedSession: related ? { id: related.id, title: related.title } : null
    };
  });
}

/** Instantiates a curriculum's sessions onto a real batch — the same transform batches.service.ts's create() does server-side. */
function instantiateSessions(
  batchPrefix: string,
  batchId: string,
  days: CurriculumDay[],
  platform: string,
  meetingBase: string,
  facilitator: PersonRef | null,
  startDate: Date,
  memberCount: number
): DemoSession[] {
  const now = new Date();
  return days.map((d, i) => {
    const scheduledAt = addMinutes(nthWorkingDay(startDate, d.dayOffset), SESSION_START_MINUTE);
    const isPast = scheduledAt.getTime() < now.getTime();
    return {
      id: `${batchPrefix}-session-${i}`,
      batchId,
      title: d.title,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: SESSION_END_MINUTE - SESSION_START_MINUTE,
      platform,
      meetingLink: `${meetingBase}/${batchPrefix}-session-${i}`,
      status: isPast ? 'Completed' : 'Upcoming',
      facilitator,
      relatedAssignments: [],
      feedbackForm: {
        id: `${batchPrefix}-feedback-form-${i}`,
        name: `${d.title} — Session Feedback`,
        description: `Share your feedback on the "${d.title}" session (demo link).`,
        formUrl: d.feedbackFormUrl,
        audience: 'Trainees',
        _count: { submissions: isPast ? Math.max(1, Math.round(memberCount * 0.6)) : 0 }
      }
    };
  });
}

/** Instantiates a curriculum's assignments onto a real batch, wiring each session's `relatedAssignments` back-reference. */
function instantiateAssignments(
  batchPrefix: string,
  batchId: string,
  batchRef: { id: string; name: string; code: string; trainingPlan: DemoTrainingPlanRef },
  specs: CurriculumAssignmentSpec[],
  sessions: DemoSession[],
  startDate: Date,
  members: PersonRef[]
): DemoAssignment[] {
  const now = new Date();
  return specs.map((a, i) => {
    const deadline = addMinutes(nthWorkingDay(startDate, a.dueDayOffset), ASSIGNMENT_DEADLINE_MINUTE);
    const relatedSession = sessions[a.relatedDayOffset] ?? null;
    const isPast = deadline.getTime() < now.getTime();

    const submissions: DemoSubmission[] = isPast
      ? members
          .slice(0, 2)
          .map((m, mi) =>
            submission(
              `${batchPrefix}-sub-${i}-${mi}`,
              m,
              mi === 0 ? 'Completed' : 'UnderReview',
              mi === 0 ? '90' : null,
              mi === 0 ? 'Good work.' : null,
              mi === 0 ? deadline.toISOString() : null
            )
          )
      : [];

    const assignment: DemoAssignment = {
      id: `${batchPrefix}-assignment-${i}`,
      batchId,
      batches: [batchRef],
      title: a.title,
      agenda: a.agenda,
      description: a.description,
      status: isPast ? 'Open' : 'Draft',
      deadline: deadline.toISOString(),
      session: relatedSession ? { id: relatedSession.id, title: relatedSession.title } : null,
      submissions,
      // Openly a sample: the demo download layer serves a labeled plain-text stand-in, so the
      // filename/type say exactly that rather than pretending to be a real brief.
      attachment: {
        originalFilename: `${a.agenda} Case Study Brief (Sample).txt`,
        mimeType: 'text/plain',
        sizeBytes: 72
      }
    };
    if (relatedSession) relatedSession.relatedAssignments = [{ id: assignment.id, title: assignment.title }];
    return assignment;
  });
}

function instantiateResources(
  batchPrefix: string,
  batchId: string,
  templateResources: { id: string; title: string; category: string; url: string }[],
  uploader: PersonRef
): DemoResource[] {
  return templateResources.map((r, i) => ({
    id: `${batchPrefix}-resource-${i}`,
    batchId,
    title: r.title,
    category: r.category,
    version: 'v1.0',
    sizeBytes: null,
    externalUrl: r.url,
    uploadedBy: uploader.id,
    verified: true,
    downloadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    uploader,
    batch: null
  }));
}

// ---- facilitators (matches the backend seed's demo accounts) — Junaid runs the two main demo
// batches; the other three each get a lightweight extra batch below so the demo trainee's
// Facilitator Contacts tab (which lists POCs of batches she actually belongs to) shows all 4. ----
const adminAlex = { id: 'demo-admin', name: 'Alex Morgan', email: 'admin@company.com' };
const facilitatorJunaid = { id: 'demo-facilitator', name: 'Junaid Mohammed', email: 'facilitator@company.com' };
const facilitatorSrikar = { id: 'demo-facilitator-2', name: 'Srikar Kulkarni', email: 'srikar.kulkarni@company.com' };
const facilitatorDinesh = { id: 'demo-facilitator-3', name: 'Dinesh Paraman', email: 'dinesh.paraman@company.com' };
const facilitatorKaashyap = { id: 'demo-facilitator-4', name: 'Kaashyap Reddy', email: 'kaashyap.reddy@company.com' };

// ---- trainees split across the two demo batches ----
const traineeRefs = [
  { id: 'demo-trainee', name: 'Priya Sharma', email: 'trainee@company.com' },
  { id: 'demo-trainee-2', name: 'Rahul Verma', email: 'rahul.verma@company.com' },
  { id: 'demo-trainee-3', name: 'Ananya Iyer', email: 'ananya.iyer@company.com' }
];

const t = {
  johnDoe: { id: 'demo-trainee-101', name: 'John Doe', email: 'john.doe@company.com' },
  bobWilliams: { id: 'demo-trainee-102', name: 'Bob Williams', email: 'bob.williams@company.com' },
  aliceSmith: { id: 'demo-trainee-103', name: 'Alice Smith', email: 'alice.smith@company.com' },
  vikramSingh: { id: 'demo-trainee-104', name: 'Vikram Singh', email: 'vikram.singh@company.com' },
  sarahConnor: { id: 'demo-trainee-105', name: 'Sarah Connor', email: 'sarah.connor@company.com' },
  nehaKapoor: { id: 'demo-trainee-106', name: 'Neha Kapoor', email: 'neha.kapoor@company.com' },
  arjunNair: { id: 'demo-trainee-107', name: 'Arjun Nair', email: 'arjun.nair@company.com' },
  meeraIyer: { id: 'demo-trainee-108', name: 'Meera Iyer', email: 'meera.iyer@company.com' }
};

function traineeUser(ref: PersonRef, idNumber: string): DemoUser {
  return {
    ...ref,
    role: 'trainee',
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-01-10T00:00:00.000Z',
    profile: { phone: '', location: '', company: null, department: null, idNumber, avatarStorageKey: null }
  };
}

export const DEMO_USERS: DemoUser[] = [
  { ...adminAlex, role: 'admin', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-05T00:00:00.000Z', profile: { phone: '', location: '', company: 'Company Inc.', department: 'Operations', idNumber: 'ADM-001', avatarStorageKey: null } },
  { ...facilitatorJunaid, role: 'facilitator', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-05T00:00:00.000Z', profile: { phone: '', location: '', company: 'Company Inc.', department: 'Business Analysis', idNumber: 'FAC-001', avatarStorageKey: null } },
  { ...facilitatorSrikar, role: 'facilitator', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-05T00:00:00.000Z', profile: { phone: '', location: '', company: 'Company Inc.', department: 'Business Analysis', idNumber: 'FAC-002', avatarStorageKey: null } },
  { ...facilitatorDinesh, role: 'facilitator', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-05T00:00:00.000Z', profile: { phone: '', location: '', company: 'Company Inc.', department: 'Business Analysis', idNumber: 'FAC-003', avatarStorageKey: null } },
  { ...facilitatorKaashyap, role: 'facilitator', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-05T00:00:00.000Z', profile: { phone: '', location: '', company: 'Company Inc.', department: 'Business Analysis', idNumber: 'FAC-004', avatarStorageKey: null } },
  { id: 'demo-trainee', name: 'Priya Sharma', email: 'trainee@company.com', role: 'trainee', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-10T00:00:00.000Z', profile: { phone: '', location: '', company: null, department: null, idNumber: 'TR-014', avatarStorageKey: null, batch: 'BA BTech', course: 'BA' } },
  traineeUser(traineeRefs[1], 'TR-015'),
  traineeUser(traineeRefs[2], 'TR-016'),
  traineeUser(t.johnDoe, 'TR-101'),
  traineeUser(t.bobWilliams, 'TR-102'),
  traineeUser(t.aliceSmith, 'TR-103'),
  traineeUser(t.vikramSingh, 'TR-104'),
  traineeUser(t.sarahConnor, 'TR-105'),
  traineeUser(t.nehaKapoor, 'TR-106'),
  traineeUser(t.arjunNair, 'TR-107'),
  traineeUser(t.meeraIyer, 'TR-108')
];

const baBtechPlanRef: DemoTrainingPlanRef = { id: 'demo-plan-ba-btech', code: 'ba-btech', name: 'BA BTech' };
const baMbaPlanRef: DemoTrainingPlanRef = { id: 'demo-plan-ba-mba', code: 'ba-mba', name: 'BA MBA' };

// ---- curricula ----
const BTECH_TOPICS = [
  'Orientation & Program Kickoff',
  'Business Analysis Fundamentals',
  'Requirements Gathering Techniques',
  'Stakeholder Analysis',
  'UML Practice',
  'BRD Preparation',
  'SQL Basics',
  'Process Modeling (BPMN)',
  'Data Analysis Fundamentals',
  'Agile & Scrum for BAs',
  'Wireframing & Prototyping',
  'Case Study Workshop',
  'Capstone Project Work',
  'Capstone Presentation & Wrap-up'
];
const BTECH_AGENDAS = ['Requirement Gathering', 'Stakeholder Analysis', 'UML Practice', 'BRD Preparation', 'SQL Basics', 'Process Modeling', 'Data Analysis', 'Capstone Preparation'];

const MBA_TOPICS = [
  'Orientation & Program Kickoff',
  'Strategic Business Analysis',
  'Market & Competitive Analysis',
  'Stakeholder Management',
  'Financial Modeling for BAs',
  'Business Case Development',
  'SQL & Data Fundamentals',
  'Process Improvement Strategy',
  'Leadership Case Studies',
  'Negotiation & Communication',
  'Executive Presentation Skills',
  'Change Management',
  'Capstone Project Work',
  'Capstone Presentation & Wrap-up'
];
const MBA_AGENDAS = ['Market Analysis', 'Stakeholder Management', 'Financial Modeling', 'Business Case Development', 'SQL Fundamentals', 'Process Improvement', 'Change Management', 'Capstone Preparation'];

const btechDays = buildCurriculumDays(baBtechPlanRef.code, BTECH_TOPICS);
const btechAssignmentSpecs = buildCurriculumAssignments(BTECH_AGENDAS, btechDays);
const btechTemplateSessions = toTemplateSessions('demo-btech', btechDays, 'GoogleMeet');
const btechTemplateAssignments = toTemplateAssignments('demo-btech', btechAssignmentSpecs, btechTemplateSessions);

const mbaDays = buildCurriculumDays(baMbaPlanRef.code, MBA_TOPICS);
const mbaAssignmentSpecs = buildCurriculumAssignments(MBA_AGENDAS, mbaDays);
const mbaTemplateSessions = toTemplateSessions('demo-mba', mbaDays, 'Zoom');
const mbaTemplateAssignments = toTemplateAssignments('demo-mba', mbaAssignmentSpecs, mbaTemplateSessions);

const TEMPLATE_RESOURCES_BTECH = [
  { id: 'demo-tpr-201', title: 'BA BTech Handbook', category: 'Handbook', url: 'https://example.com/resources/ba-btech-handbook.pdf' },
  { id: 'demo-tpr-202', title: 'Reference Reading List', category: 'Reading', url: 'https://example.com/resources/ba-btech-reading-list.pdf' }
];
const TEMPLATE_ANNOUNCEMENTS_BTECH = [
  { id: 'demo-tpan-201', title: 'Welcome to BA BTech!', message: 'Kickoff details and pre-reads are in your inbox.', priority: 'Normal' },
  { id: 'demo-tpan-202', title: 'Capstone submission guidelines', message: 'Capstone submissions are due in the final week.', priority: 'Important' }
];
const TEMPLATE_RESOURCES_MBA = [
  { id: 'demo-tpr-203', title: 'BA MBA Handbook', category: 'Handbook', url: 'https://example.com/resources/ba-mba-handbook.pdf' },
  { id: 'demo-tpr-204', title: 'Case Study Library', category: 'Reading', url: 'https://example.com/resources/ba-mba-case-studies.pdf' }
];
const TEMPLATE_ANNOUNCEMENTS_MBA = [
  { id: 'demo-tpan-203', title: 'Welcome to BA MBA!', message: 'Kickoff details and pre-reads are in your inbox.', priority: 'Normal' },
  { id: 'demo-tpan-204', title: 'Capstone submission guidelines', message: 'Capstone submissions are due in the final week.', priority: 'Important' }
];

export const DEMO_TRAINING_PLANS: DemoTrainingPlan[] = [
  {
    id: baBtechPlanRef.id,
    code: baBtechPlanRef.code,
    name: baBtechPlanRef.name,
    description:
      'A 2-month, in-person-paced curriculum covering the core Business Analysis toolkit — requirements gathering, stakeholder analysis, UML, BRDs, SQL, and process modeling — capped by a capstone project.',
    durationMonths: 2,
    defaultSessionStartMinute: SESSION_START_MINUTE,
    defaultSessionEndMinute: SESSION_END_MINUTE,
    defaultAssignmentStartMinute: ASSIGNMENT_START_MINUTE,
    defaultAssignmentDeadlineMinute: ASSIGNMENT_DEADLINE_MINUTE,
    sessions: btechTemplateSessions,
    assignments: btechTemplateAssignments,
    resources: TEMPLATE_RESOURCES_BTECH,
    announcements: TEMPLATE_ANNOUNCEMENTS_BTECH
  },
  {
    id: baMbaPlanRef.id,
    code: baMbaPlanRef.code,
    name: baMbaPlanRef.name,
    description:
      'A 2-month, management-track curriculum covering strategic business analysis, financial modeling, business case development, and change management, ending in an executive capstone presentation.',
    durationMonths: 2,
    defaultSessionStartMinute: SESSION_START_MINUTE,
    defaultSessionEndMinute: SESSION_END_MINUTE,
    defaultAssignmentStartMinute: ASSIGNMENT_START_MINUTE,
    defaultAssignmentDeadlineMinute: ASSIGNMENT_DEADLINE_MINUTE,
    sessions: mbaTemplateSessions,
    assignments: mbaTemplateAssignments,
    resources: TEMPLATE_RESOURCES_MBA,
    announcements: TEMPLATE_ANNOUNCEMENTS_MBA
  }
];

// ---- the two demo batches, generated from the curricula above exactly like a real Create Batch would ----
const BTECH_START = new Date('2026-07-01T00:00:00.000Z');
const MBA_START = new Date('2026-08-01T00:00:00.000Z');
const btechMembers = ['Priya Sharma', t.johnDoe.name, t.bobWilliams.name, t.aliceSmith.name, t.vikramSingh.name];
const mbaMembers = ['Rahul Verma', t.sarahConnor.name, t.nehaKapoor.name, t.arjunNair.name, t.meeraIyer.name];
const btechMemberRefs = [traineeRefs[0], t.johnDoe, t.bobWilliams, t.aliceSmith, t.vikramSingh];
const mbaMemberRefs = [traineeRefs[1], t.sarahConnor, t.nehaKapoor, t.arjunNair, t.meeraIyer];

const btechEndDate = nthWorkingDay(BTECH_START, SESSION_COUNT - 1);
const mbaEndDate = nthWorkingDay(MBA_START, SESSION_COUNT - 1);

export const DEMO_BATCHES: DemoBatch[] = [
  {
    id: 'demo-batch-ba-btech',
    code: 'ba-btech-jul-2026',
    name: 'BA BTech - July 2026',
    program: 'BA',
    track: 'BTech',
    status: 'Active',
    startMonth: BTECH_START.toISOString(),
    endDate: btechEndDate.toISOString(),
    facilitator: facilitatorJunaid,
    trainingPlan: baBtechPlanRef,
    members: btechMembers,
    metrics: { traineeCount: 5, avgScore: 89, completionPct: 62, attendanceRate: 94, submissionRate: 80, feedbackRating: 4.6 }
  },
  {
    id: 'demo-batch-ba-mba',
    code: 'ba-mba-aug-2026',
    name: 'BA MBA - August 2026',
    program: 'BA',
    track: 'MBA',
    status: 'Active',
    startMonth: MBA_START.toISOString(),
    endDate: mbaEndDate.toISOString(),
    facilitator: facilitatorJunaid,
    trainingPlan: baMbaPlanRef,
    members: mbaMembers,
    metrics: { traineeCount: 5, avgScore: 85, completionPct: 40, attendanceRate: 91, submissionRate: 70, feedbackRating: 4.3 }
  },
  // Lightweight extra batches (no generated session/assignment schedule, unlike the two above) —
  // exist purely so the demo trainee (a member of all three) sees Srikar/Dinesh/Kaashyap as
  // facilitator contacts too, alongside Junaid from the two full batches.
  {
    id: 'demo-batch-ba-btech-cohort2',
    code: 'ba-btech-cohort2',
    name: 'BA BTech - Cohort 2',
    program: 'BA',
    track: 'BTech',
    status: 'Active',
    startMonth: '2026-05-01T00:00:00.000Z',
    endDate: null,
    facilitator: facilitatorSrikar,
    trainingPlan: baBtechPlanRef,
    members: ['Priya Sharma'],
    metrics: { traineeCount: 1, avgScore: null, completionPct: null, attendanceRate: null, submissionRate: null, feedbackRating: null }
  },
  {
    id: 'demo-batch-ba-mba-cohort2',
    code: 'ba-mba-cohort2',
    name: 'BA MBA - Cohort 2',
    program: 'BA',
    track: 'MBA',
    status: 'Active',
    startMonth: '2026-06-01T00:00:00.000Z',
    endDate: null,
    facilitator: facilitatorDinesh,
    trainingPlan: baMbaPlanRef,
    members: ['Priya Sharma'],
    metrics: { traineeCount: 1, avgScore: null, completionPct: null, attendanceRate: null, submissionRate: null, feedbackRating: null }
  },
  {
    id: 'demo-batch-ba-btech-cohort3',
    code: 'ba-btech-cohort3',
    name: 'BA BTech - Cohort 3',
    program: 'BA',
    track: 'BTech',
    status: 'Active',
    startMonth: '2026-03-01T00:00:00.000Z',
    endDate: null,
    facilitator: facilitatorKaashyap,
    trainingPlan: baBtechPlanRef,
    members: ['Priya Sharma'],
    metrics: { traineeCount: 1, avgScore: null, completionPct: null, attendanceRate: null, submissionRate: null, feedbackRating: null }
  }
];

function submission(id: string, trainee: PersonRef, status: string, grade: string | null, feedback: string | null, submittedAt: string | null): DemoSubmission {
  return { id, assignmentId: '', traineeId: trainee.id, status, submittedAt, grade, feedback, trainee };
}

function batchRefs(...batchIds: string[]): { id: string; name: string; code: string; trainingPlan: DemoTrainingPlanRef }[] {
  return batchIds.map((id) => {
    const batch = DEMO_BATCHES.find((b) => b.id === id);
    if (!batch) throw new Error(`Unknown demo batch id: ${id}`);
    return { id: batch.id, name: batch.name, code: batch.code, trainingPlan: batch.trainingPlan };
  });
}

const btechBatchRef = batchRefs('demo-batch-ba-btech')[0];
const mbaBatchRef = batchRefs('demo-batch-ba-mba')[0];

export const DEMO_SESSIONS: DemoSession[] = [
  ...instantiateSessions('demo-btech', 'demo-batch-ba-btech', btechDays, 'GoogleMeet', 'https://meet.example.com', facilitatorJunaid, BTECH_START, btechMembers.length),
  ...instantiateSessions('demo-mba', 'demo-batch-ba-mba', mbaDays, 'Zoom', 'https://zoom.example.com', facilitatorJunaid, MBA_START, mbaMembers.length)
];

const btechSessions = DEMO_SESSIONS.filter((s) => s.batchId === 'demo-batch-ba-btech');
const mbaSessions = DEMO_SESSIONS.filter((s) => s.batchId === 'demo-batch-ba-mba');

export const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  ...instantiateAssignments('demo-btech', 'demo-batch-ba-btech', btechBatchRef, btechAssignmentSpecs, btechSessions, BTECH_START, btechMemberRefs),
  ...instantiateAssignments('demo-mba', 'demo-batch-ba-mba', mbaBatchRef, mbaAssignmentSpecs, mbaSessions, MBA_START, mbaMemberRefs)
];

/**
 * Per-trainee attendance for every already-completed session — what real Attendance rows hold
 * once a facilitator marks them. Deterministic mostly-Present pattern with an occasional Absent
 * so per-trainee percentages land in a realistic low-90s range instead of a uniform 100%.
 */
function instantiateAttendance(batchSessions: DemoSession[], members: PersonRef[], markedBy: string): DemoAttendanceRecord[] {
  const records: DemoAttendanceRecord[] = [];
  batchSessions.forEach((session, si) => {
    if (session.status !== 'Completed') return;
    members.forEach((member, mi) => {
      records.push({
        id: `${session.id}-att-${mi}`,
        sessionId: session.id,
        traineeId: member.id,
        status: (si + mi * 5) % 13 === 0 ? 'Absent' : 'Present',
        markedBy,
        markedAt: session.scheduledAt,
        trainee: member
      });
    });
  });
  return records;
}

export const DEMO_ATTENDANCE: DemoAttendanceRecord[] = [
  ...instantiateAttendance(btechSessions, btechMemberRefs, facilitatorJunaid.id),
  ...instantiateAttendance(mbaSessions, mbaMemberRefs, facilitatorJunaid.id)
];

export const DEMO_RESOURCES: DemoResource[] = [
  {
    id: 'demo-resource-101',
    batchId: null,
    title: 'React Router Guide.pdf',
    category: 'PDF Guides',
    version: 'v1.0',
    sizeBytes: '1887437',
    externalUrl: null,
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 34,
    createdAt: '2026-07-02T09:00:00.000Z',
    updatedAt: '2026-07-02T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: null
  },
  {
    id: 'demo-resource-102',
    batchId: null,
    title: 'Lecture: Node API.mp4',
    category: 'Video Recordings',
    version: 'v1.0',
    sizeBytes: '88296242',
    externalUrl: null,
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 51,
    createdAt: '2026-07-03T09:00:00.000Z',
    updatedAt: '2026-07-03T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: null
  },
  {
    id: 'demo-resource-103',
    batchId: null,
    title: 'React Lifecycle Architecture.pdf',
    category: 'PDF Guides',
    version: 'v1.1',
    sizeBytes: '2517319',
    externalUrl: null,
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 27,
    createdAt: '2026-07-05T09:00:00.000Z',
    updatedAt: '2026-07-06T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: null
  },
  ...instantiateResources('demo-btech', 'demo-batch-ba-btech', TEMPLATE_RESOURCES_BTECH, adminAlex),
  ...instantiateResources('demo-mba', 'demo-batch-ba-mba', TEMPLATE_RESOURCES_MBA, adminAlex)
];

export const DEMO_FEEDBACK: DemoFeedback[] = [
  {
    id: 'demo-feedback-101',
    batchId: 'demo-batch-ba-btech',
    category: 'BA',
    rating: 4.5,
    comment: 'Really clear explanations and quick to help when stuck.',
    createdAt: '2026-07-05T00:00:00.000Z',
    trainee: traineeRefs[0],
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-feedback-105',
    batchId: 'demo-batch-ba-mba',
    category: 'Communication',
    rating: 5,
    comment: 'Great presentation skills during the sprint review.',
    createdAt: '2026-08-20T00:00:00.000Z',
    trainee: t.sarahConnor,
    facilitator: facilitatorJunaid
  }
];
