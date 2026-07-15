import { AnnouncementPriority, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as batchesService from '../src/services/batches.service';

// Mirrors frontend/src/constants/permissions.ts's ROLE_PERMISSIONS map exactly,
// so the seeded database matches the access model the frontend already assumes.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['manage_batches', 'manage_users', 'manage_announcements', 'view_reports', 'view_audit_log'],
  facilitator: ['manage_assignments', 'grade_submissions', 'manage_sessions', 'manage_resources', 'view_trainees'],
  trainee: ['submit_assignments', 'view_grades', 'view_resources', 'join_sessions']
};

// DEMO/DEV DATA ONLY — mirrors frontend/src/services/mockData/users.mock.ts's MOCK_USERS, so the
// same demo credentials that worked against the mock also work against the real backend. These
// passwords are intentionally fixed and documented in backend/README.md; change or deactivate
// these accounts (PATCH /api/users/:id with isActive:false, or a real password change) before
// real users are onboarded. Never reuse these values for a real account.
const DEMO_USERS = [
  { name: 'Admin User', email: 'admin@company.com', password: 'password123', role: 'admin' },
  { name: 'Junaid Mohammed', email: 'facilitator@company.com', password: 'password123', role: 'facilitator' },
  { name: 'Srikar Kulkarni', email: 'srikar.kulkarni@company.com', password: 'password123', role: 'facilitator' },
  { name: 'Dinesh Paraman', email: 'dinesh.paraman@company.com', password: 'password123', role: 'facilitator' },
  { name: 'Kaashyap Reddy', email: 'kaashyap.reddy@company.com', password: 'password123', role: 'facilitator' },
  { name: 'Priya Sharma', email: 'trainee@company.com', password: 'trainee123', role: 'trainee' }
];

const prisma = new PrismaClient();

interface SessionSeed {
  title: string;
  /** What the session covers (e.g. "Requirements Gathering Techniques"). */
  agenda: string;
  dayOffset: number;
  startMinute: number;
  endMinute: number;
  order: number;
  feedbackFormUrl?: string;
}
interface AssignmentSeed {
  title: string;
  /** What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics"). */
  agenda: string;
  description: string;
  dueDayOffset: number;
  /** Index into this plan's `sessions` array — becomes the assignment's relatedSessionId. */
  relatedSessionIndex: number;
}
interface ResourceSeed {
  title: string;
  category: string;
  url: string;
}
interface AnnouncementSeed {
  title: string;
  message: string;
  priority: AnnouncementPriority;
}

// Instructor-led session block per the org's standard daily schedule (09:30-14:00 is
// self-learning/assignment time, not a calendar Session; 14:30-16:30 is the instructor-led slot).
// These feed straight into TrainingPlan.defaultSession*/defaultAssignment* below — the single
// place the schedule is defined — rather than being re-hardcoded anywhere else.
const SESSION_START_MINUTE = 14 * 60 + 30; // 14:30
const SESSION_END_MINUTE = 16 * 60 + 30; // 16:30
const ASSIGNMENT_START_MINUTE = 9 * 60 + 30; // 09:30 — the daily case-study opens in the morning
const ASSIGNMENT_DEADLINE_MINUTE = 23 * 60 + 59; // 23:59 — due end of the same day

const NON_ASSIGNMENT_TITLE_PATTERN = /orientation|wrap-up/i;

/**
 * Builds a full ~2-month, 5-day-week curriculum: one instructor-led session per working day
 * (dayOffset 0..sessionCount-1, cycling through `topics`), every session carrying its own
 * feedback-form link, plus one same-day case-study assignment for every working day except
 * orientation/wrap-up days (matching how the org actually runs — a near-daily case study, not a
 * once-a-week placeholder), cycling through `agendas`.
 */
function buildCurriculum(
  planCode: string,
  topics: string[],
  agendas: string[],
  sessionCount = 42
): { sessions: SessionSeed[]; assignments: AssignmentSeed[] } {
  const sessions: SessionSeed[] = [];
  for (let day = 0; day < sessionCount; day++) {
    const topic = topics[day % topics.length];
    const week = Math.floor(day / 5) + 1;
    sessions.push({
      title: `${topic} — Week ${week}`,
      agenda: topic,
      dayOffset: day,
      startMinute: SESSION_START_MINUTE,
      endMinute: SESSION_END_MINUTE,
      order: day + 1,
      // Every generated session already has a feedback form attached, per the org's workflow.
      feedbackFormUrl: `https://forms.gle/${planCode}-day-${day + 1}-feedback`
    });
  }

  const assignments: AssignmentSeed[] = [];
  let agendaIndex = 0;
  for (let day = 0; day < sessionCount; day++) {
    if (NON_ASSIGNMENT_TITLE_PATTERN.test(sessions[day].title)) continue;
    const agenda = agendas[agendaIndex % agendas.length];
    agendaIndex += 1;
    assignments.push({
      title: `${agenda} Case Study — Day ${day + 1}`,
      agenda,
      description: `Apply what was covered in today's session: ${agenda.toLowerCase()}. Due end of day.`,
      dueDayOffset: day,
      relatedSessionIndex: day
    });
  }

  return { sessions, assignments };
}

/**
 * Upserts a Training Plan template by code, then (only on first creation — re-running the seed
 * shouldn't duplicate template rows) creates its sessions/assignments/resources/announcements.
 */
async function seedTrainingPlan(
  code: string,
  name: string,
  description: string,
  sessions: SessionSeed[],
  assignments: AssignmentSeed[],
  resources: ResourceSeed[],
  announcements: AnnouncementSeed[]
) {
  const timingDefaults = {
    defaultSessionStartMinute: SESSION_START_MINUTE,
    defaultSessionEndMinute: SESSION_END_MINUTE,
    defaultAssignmentStartMinute: ASSIGNMENT_START_MINUTE,
    defaultAssignmentDeadlineMinute: ASSIGNMENT_DEADLINE_MINUTE
  };
  const plan = await prisma.trainingPlan.upsert({
    where: { code },
    update: { name, description, ...timingDefaults },
    create: { code, name, description, durationMonths: 2, ...timingDefaults }
  });

  const existingSessionCount = await prisma.trainingPlanSession.count({ where: { trainingPlanId: plan.id } });
  if (existingSessionCount > 0) return plan;

  const createdSessions = [];
  for (const s of sessions) {
    createdSessions.push(
      await prisma.trainingPlanSession.create({
        data: {
          trainingPlanId: plan.id,
          title: s.title,
          agenda: s.agenda,
          dayOffset: s.dayOffset,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          order: s.order,
          feedbackFormUrl: s.feedbackFormUrl
        }
      })
    );
  }

  for (const a of assignments) {
    await prisma.trainingPlanAssignment.create({
      data: {
        trainingPlanId: plan.id,
        title: a.title,
        agenda: a.agenda,
        description: a.description,
        dueDayOffset: a.dueDayOffset,
        relatedSessionId: createdSessions[a.relatedSessionIndex]?.id
      }
    });
  }

  for (const r of resources) {
    await prisma.trainingPlanResource.create({ data: { trainingPlanId: plan.id, ...r } });
  }

  for (const a of announcements) {
    await prisma.trainingPlanAnnouncement.create({ data: { trainingPlanId: plan.id, ...a } });
  }

  return plan;
}

/** Idempotent wrapper around the real create-batch automation flow (batches.service.create()). */
async function seedBatchFromPlan(
  actorId: string,
  code: string,
  name: string,
  trainingPlanId: string,
  facilitatorId: string,
  startMonth: Date
) {
  const existing = await prisma.batch.findUnique({ where: { code } });
  if (existing) return existing;

  return batchesService.create(actorId, { code, name, trainingPlanId, facilitatorId, startMonth, status: 'Active' });
}

async function main() {
  // These demo accounts use fixed, publicly-documented passwords (see backend/README.md).
  // Upserting them into a real production database would create a fully-privileged admin
  // account with a known password. Require an explicit opt-in there.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error(
      'Refusing to seed demo accounts against a production database (NODE_ENV=production).\n' +
        'These accounts use fixed, publicly-known passwords — see backend/README.md.\n' +
        'If you really want them in this environment, re-run with ALLOW_DEMO_SEED=true.'
    );
    process.exit(1);
  }

  console.log('Seeding roles and permissions...');
  const roleIds: Record<string, number> = {};
  for (const name of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roleIds[name] = role.id;
  }

  const permissionIds: Record<string, number> = {};
  const allPermissionKeys = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()));
  for (const key of allPermissionKeys) {
    const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
    permissionIds[key] = permission.id;
  }

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const key of keys) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleIds[roleName], permissionId: permissionIds[key] } },
        update: {},
        create: { roleId: roleIds[roleName], permissionId: permissionIds[key] }
      });
    }
  }

  console.log('Seeding demo users...');
  const userIds: Record<string, string> = {};
  for (const seedUser of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(seedUser.password, 12);
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {},
      create: {
        name: seedUser.name,
        email: seedUser.email,
        passwordHash,
        roleId: roleIds[seedUser.role],
        isActive: true
      }
    });
    // Keyed by role for the single-instance roles (admin, trainee) — and by email for roles with
    // more than one demo account (facilitator), since a plain role key would just end up holding
    // whichever facilitator was processed last.
    userIds[seedUser.role] = user.id;
    userIds[seedUser.email] = user.id;
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, phone: '', location: '' }
    });
  }

  console.log('Seeding Training Plans (BA BTech, BA MBA) — ~42 sessions each across a 5-day week...');

  const btechCurriculum = buildCurriculum(
    'ba-btech',
    [
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
    ],
    ['Requirement Gathering', 'Stakeholder Analysis', 'UML Practice', 'BRD Preparation', 'SQL Basics', 'Process Modeling', 'Data Analysis', 'Capstone Preparation']
  );
  const baBtechPlan = await seedTrainingPlan(
    'ba-btech',
    'BA BTech',
    'A 2-month, in-person-paced curriculum covering the core Business Analysis toolkit — requirements gathering, stakeholder analysis, UML, BRDs, SQL, and process modeling — capped by a capstone project.',
    btechCurriculum.sessions,
    btechCurriculum.assignments,
    [
      { title: 'BA BTech Handbook', category: 'Handbook', url: 'https://example.com/resources/ba-btech-handbook.pdf' },
      { title: 'Reference Reading List', category: 'Reading', url: 'https://example.com/resources/ba-btech-reading-list.pdf' }
    ],
    [
      { title: 'Welcome to BA BTech!', message: 'Kickoff details and pre-reads are in your inbox — see you at orientation.', priority: 'Normal' },
      { title: 'Capstone submission guidelines', message: 'Capstone submissions are due in the final week — see the resource tab for the rubric.', priority: 'Important' }
    ]
  );

  const mbaCurriculum = buildCurriculum(
    'ba-mba',
    [
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
    ],
    ['Market Analysis', 'Stakeholder Management', 'Financial Modeling', 'Business Case Development', 'SQL Fundamentals', 'Process Improvement', 'Change Management', 'Capstone Preparation']
  );
  const baMbaPlan = await seedTrainingPlan(
    'ba-mba',
    'BA MBA',
    'A 2-month, management-track curriculum covering strategic business analysis, financial modeling, business case development, and change management, ending in an executive capstone presentation.',
    mbaCurriculum.sessions,
    mbaCurriculum.assignments,
    [
      { title: 'BA MBA Handbook', category: 'Handbook', url: 'https://example.com/resources/ba-mba-handbook.pdf' },
      { title: 'Case Study Library', category: 'Reading', url: 'https://example.com/resources/ba-mba-case-studies.pdf' }
    ],
    [
      { title: 'Welcome to BA MBA!', message: 'Kickoff details and pre-reads are in your inbox — see you at orientation.', priority: 'Normal' },
      { title: 'Capstone submission guidelines', message: 'Capstone submissions are due in the final week — see the resource tab for the rubric.', priority: 'Important' }
    ]
  );

  console.log('Seeding demo batches via the Training Plan automation flow...');
  const btechBatch = await seedBatchFromPlan(
    userIds.admin,
    'ba-btech-jul-2026',
    'BA BTech - July 2026',
    baBtechPlan.id,
    userIds['facilitator@company.com'],
    new Date('2026-07-01')
  );
  const mbaBatch = await seedBatchFromPlan(
    userIds.admin,
    'ba-mba-aug-2026',
    'BA MBA - August 2026',
    baMbaPlan.id,
    userIds['facilitator@company.com'],
    new Date('2026-08-01')
  );
  // Three more batches, each with a different facilitator, so the demo trainee (enrolled in all
  // of them below) sees all 4 facilitators on their Facilitator Contacts tab — that tab lists
  // whoever is POC on a batch the trainee actually belongs to, not a global directory.
  const btechCohort2 = await seedBatchFromPlan(
    userIds.admin,
    'ba-btech-cohort2',
    'BA BTech - Cohort 2',
    baBtechPlan.id,
    userIds['srikar.kulkarni@company.com'],
    new Date('2026-05-01')
  );
  const mbaCohort2 = await seedBatchFromPlan(
    userIds.admin,
    'ba-mba-cohort2',
    'BA MBA - Cohort 2',
    baMbaPlan.id,
    userIds['dinesh.paraman@company.com'],
    new Date('2026-06-01')
  );
  const btechCohort3 = await seedBatchFromPlan(
    userIds.admin,
    'ba-btech-cohort3',
    'BA BTech - Cohort 3',
    baBtechPlan.id,
    userIds['kaashyap.reddy@company.com'],
    new Date('2026-03-01')
  );

  for (const batch of [btechBatch, mbaBatch, btechCohort2, mbaCohort2, btechCohort3]) {
    await prisma.batchTrainee.upsert({
      where: { batchId_traineeId: { batchId: batch.id, traineeId: userIds.trainee } },
      update: {},
      create: { batchId: batch.id, traineeId: userIds.trainee }
    });
  }

  console.log('Seed complete.');
  // Credentials are intentionally not printed here (even though they're demo-only and already
  // documented) — seed output can end up in CI logs/terminal history/log aggregators, and this
  // script should not be a place that ever prints a password, full stop. See backend/README.md
  // "Database setup" for the demo credential table.
  console.log(`Seeded ${DEMO_USERS.length} demo accounts — see backend/README.md for credentials. Change or deactivate them before real users are onboarded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
