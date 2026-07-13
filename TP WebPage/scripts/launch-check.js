#!/usr/bin/env node
/**
 * Automated launch-readiness checks — everything here is safe to run with no database, no
 * hosting credentials, and no admin rights. It never prints a secret value, only whether one
 * looks present/absent/suspicious. See DEPLOYMENT.md's manual checklist for what this can't
 * check (anything requiring a live deployment or a browser).
 *
 * Usage: node scripts/launch-check.js
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const results = []; // { name, status: 'pass' | 'fail' | 'warn', detail }

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, status: 'pass', detail: detail || '' });
  } catch (err) {
    const status = err.warn ? 'warn' : 'fail';
    results.push({ name, status, detail: err.message });
  }
}

function warn(message) {
  const err = new Error(message);
  err.warn = true;
  return err;
}

function readIfExists(relPath) {
  const p = path.join(root, relPath);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function parseEnvKeys(content) {
  if (!content) return new Set();
  return new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => line.slice(0, line.indexOf('=')).trim())
  );
}

function parseEnvValues(content) {
  const values = new Map();
  if (!content) return values;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const key = trimmed.slice(0, trimmed.indexOf('=')).trim();
    let value = trimmed.slice(trimmed.indexOf('=') + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

// ---- 1. Required environment variables present ----
check('backend/.env has every key from .env.example', () => {
  const example = parseEnvKeys(readIfExists('backend/.env.example'));
  const actual = readIfExists('backend/.env');
  if (!actual) throw warn('backend/.env does not exist yet — copy it from .env.example before running the server.');
  const actualKeys = parseEnvKeys(actual);
  const missing = [...example].filter((k) => !actualKeys.has(k));
  if (missing.length > 0) throw new Error(`Missing keys: ${missing.join(', ')}`);
  return `${actualKeys.size} keys present`;
});

// ---- 2. Obvious development secrets / defaults not used ----
check('backend/.env secrets are not left as placeholder/example values', () => {
  const exampleValues = parseEnvValues(readIfExists('backend/.env.example'));
  const actualValues = parseEnvValues(readIfExists('backend/.env'));
  if (actualValues.size === 0) throw warn('backend/.env not found — skipped (see previous check).');

  const secretKeys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET'];
  const suspicious = [];
  for (const key of secretKeys) {
    const value = actualValues.get(key);
    if (!value) continue;
    const looksLikePlaceholder = value === exampleValues.get(key) || value.startsWith('replace-with-') || value.startsWith('dev-');
    if (looksLikePlaceholder) suspicious.push(key);
  }
  if (suspicious.length > 0) {
    throw warn(`${suspicious.join(', ')} still look like dev/placeholder values — fine for local dev, must be rotated before production (never printing the actual value here).`);
  }
  return 'no placeholder secrets detected';
});

// ---- 3. Prisma schema validates ----
check('Prisma schema validates', () => {
  execFileSync('npx', ['prisma', 'validate'], { cwd: path.join(root, 'backend'), stdio: 'pipe', shell: process.platform === 'win32' });
  return 'schema valid';
});

// ---- 4. Migration files exist ----
check('An initial migration exists', () => {
  const migrationsDir = path.join(root, 'backend', 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) throw new Error('backend/prisma/migrations/ does not exist — run prisma migrate to generate one.');
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const lockFile = entries.find((e) => e.isFile() && e.name === 'migration_lock.toml');
  const migrationDirs = entries.filter((e) => e.isDirectory());
  if (!lockFile) throw new Error('migration_lock.toml is missing.');
  if (migrationDirs.length === 0) throw new Error('No migration directories found.');
  for (const dir of migrationDirs) {
    const sqlPath = path.join(migrationsDir, dir.name, 'migration.sql');
    if (!fs.existsSync(sqlPath)) throw new Error(`${dir.name} has no migration.sql`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    if (/^\s*(DROP|DELETE FROM|TRUNCATE)\b/im.test(sql)) {
      throw new Error(`${dir.name}/migration.sql contains a DROP/DELETE/TRUNCATE statement — review before applying.`);
    }
  }
  return `${migrationDirs.length} migration(s) found, none destructive`;
});

// ---- 5. Required deployment files exist ----
check('Required deployment config files exist', () => {
  const required = ['frontend/vercel.json', 'backend/railway.json', 'backend/Dockerfile', 'render.yaml', 'docker-compose.yml', 'DEPLOYMENT.md'];
  const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
  return `${required.length} files present`;
});

// ---- 6. Health endpoint configuration present ----
check('Health endpoint is wired up', () => {
  const app = readIfExists('backend/src/app.ts') || '';
  const healthRoutes = readIfExists('backend/src/routes/health.routes.ts') || '';
  if (!app.includes("'/health'")) throw new Error("app.ts doesn't mount an unprefixed /health liveness route.");
  if (!healthRoutes.includes('database') || !healthRoutes.includes('storage')) {
    throw new Error('health.routes.ts readiness check no longer checks database/storage.');
  }
  const railwayJson = readIfExists('backend/railway.json') || '';
  if (!railwayJson.includes('/health')) throw new Error('railway.json healthcheckPath is not set to /health.');
  return 'liveness + readiness checks present, referenced by railway.json';
});

// ---- 7. No hardcoded localhost URLs in application source ----
check('No hardcoded localhost URLs in frontend/backend source', () => {
  // Known-safe, manually verified: a documented dev-only CORS default (always overridden by a
  // real CORS_ORIGIN in production), Swagger's "Local" server entry (a docs convenience, not
  // request routing), and the dev startup banner (console.log only). Anything else showing up
  // here is new and should be justified or fixed.
  const allowlist = new Set([
    path.join('backend', 'src', 'config', 'env.ts'),
    path.join('backend', 'src', 'config', 'swagger.ts'),
    path.join('backend', 'src', 'index.ts')
  ]);

  const offenders = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const rel = path.relative(root, full);
        if (allowlist.has(rel)) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/localhost/i.test(content)) offenders.push(rel);
      }
    }
  }
  scan(path.join(root, 'frontend', 'src'));
  scan(path.join(root, 'backend', 'src'));
  if (offenders.length > 0) throw new Error(`Found "localhost" in: ${offenders.join(', ')}`);
  return `clean (${allowlist.size} known dev-only defaults allowlisted)`;
});

// ---- 8. Frontend builds successfully ----
check('Frontend production build succeeds', () => {
  execFileSync('npm', ['run', 'build', '--prefix', 'frontend'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return 'frontend/dist/ produced';
});

// ---- 9. Backend builds successfully ----
check('Backend production build succeeds', () => {
  execFileSync('npm', ['run', 'build', '--prefix', 'backend'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return 'backend/dist/ produced';
});

// ---- 10. Backend unit tests pass ----
check('Backend unit tests pass', () => {
  execFileSync('npm', ['test', '--prefix', 'backend'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return 'vitest suite green';
});

// ---- Report ----
const width = Math.max(...results.map((r) => r.name.length)) + 2;
let hasFailure = false;
console.log('\nLaunch-readiness checks\n' + '='.repeat(40));
for (const r of results) {
  const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '!' : '✗';
  console.log(`${icon} ${r.name.padEnd(width)} ${r.detail}`);
  if (r.status === 'fail') hasFailure = true;
}
console.log('='.repeat(40));
console.log(
  `${results.filter((r) => r.status === 'pass').length} passed, ` +
    `${results.filter((r) => r.status === 'warn').length} warnings, ` +
    `${results.filter((r) => r.status === 'fail').length} failed\n`
);

process.exit(hasFailure ? 1 : 0);
