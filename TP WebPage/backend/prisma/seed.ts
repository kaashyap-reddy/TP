import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

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
  { name: 'Priya Sharma', email: 'trainee@company.com', password: 'trainee123', role: 'trainee' }
];

const prisma = new PrismaClient();

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
    userIds[seedUser.role] = user.id;
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, phone: '', location: '' }
    });
  }

  console.log('Seeding a demo batch...');
  const batch = await prisma.batch.upsert({
    where: { code: 'ba-btech' },
    update: {},
    create: {
      code: 'ba-btech',
      name: 'BA BTech',
      program: 'BA',
      track: 'BTech',
      facilitatorId: userIds.facilitator,
      status: 'Active'
    }
  });

  await prisma.batchTrainee.upsert({
    where: { batchId_traineeId: { batchId: batch.id, traineeId: userIds.trainee } },
    update: {},
    create: { batchId: batch.id, traineeId: userIds.trainee }
  });

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
