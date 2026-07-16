# Trainee Portal — Backend

Production Express + TypeScript + PostgreSQL (Prisma) API for the Trainee Portal. See `docs/DATABASE_DESIGN.md` for the full schema/architecture rationale — this file covers day-to-day setup.

## Stack

Express, TypeScript, PostgreSQL via Prisma, JWT (access + refresh) auth with bcrypt password hashing, Zod validation, Helmet/CORS/compression/morgan, Multer file uploads, Swagger/OpenAPI docs.

## Prerequisites

- Node.js 18+
- A PostgreSQL 14+ database (local install, Docker, or a hosted instance)

## 1. Install dependencies

```bash
cd backend
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` (and `DIRECT_URL` — same value locally) and generate real secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` (e.g. `openssl rand -base64 48`). See `.env.example` for every variable and its default.

## 3. Database setup

If you don't already have a Postgres instance, the fastest local option is Docker:

```bash
docker run --name trainee-portal-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=trainee_portal -p 5432:5432 -d postgres:16
```

Then point `DATABASE_URL` in `.env` at it (the `.env.example` default already matches the command above).

### Run migrations

```bash
npm run prisma:migrate
```

This creates the database schema from `prisma/schema.prisma` (22 tables — see `docs/DATABASE_DESIGN.md` §2) and generates the Prisma Client. Name the migration something like `init` when prompted.

For deploying to an existing database (CI/production), use the non-interactive form instead:

```bash
npm run prisma:deploy
```

### Seed demo data

```bash
npm run prisma:seed
```

Seeds the 3 roles, the 14 permissions from the frontend's `ROLE_PERMISSIONS` map, 3 demo users (same credentials the old mock frontend used), and one demo batch. Every write is an upsert keyed on a unique field (role name, permission key, user email, batch code, etc.) — safe to re-run any number of times, in any environment; it will never create duplicates.

**Production**: this script refuses to run when `NODE_ENV=production` unless you also set `ALLOW_DEMO_SEED=true`. That's deliberate — these are fixed, publicly-documented passwords, and the guard exists so a deploy script or CI job can't silently create a fully-privileged admin account with a known password. It does not print credentials to the console for the same reason (they're listed below instead).

**Before real users are onboarded**, change the password on (or deactivate — `PATCH /api/users/:id` with `isActive: false`) every account below. They exist purely so a fresh environment has something to log in with.

| Role | Email | Password |
|---|---|---|
| Admin | admin@company.com | password123 |
| Facilitator | facilitator@company.com | password123 |
| Trainee | trainee@company.com | trainee123 |

## 4. Run the server

```bash
npm run dev      # tsx watch, auto-reloads on file changes
```

The API listens on `http://localhost:4000` (override with `PORT`). Interactive API docs: `http://localhost:4000/api/docs` (raw spec at `/api/docs.json`).

Production build:

```bash
npm run build
npm start
```

## Production deployment

See the root [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the full walkthrough (Neon + Railway/Render + Vercel, in order, with exact steps). Summary specific to this service:

- **Health check**: `GET /health` (unprefixed, for load balancers/uptime monitors) and `GET /api/health`.
- **Start command**: `node dist/index.js` (after `npm run build`). `backend/Dockerfile` does both in a multi-stage build if you'd rather deploy a container.
- **Migrations**: run `npm run prisma:deploy` against the target database as a one-off command *before* traffic hits a new release — it is intentionally not baked into the container's start command, so it never races across multiple instances.
- **CORS**: set `CORS_ORIGIN` to your deployed frontend's exact origin (comma-separated if more than one, e.g. a Vercel preview + production URL). A wildcard won't work here because cookies are sent with `credentials: true`.
- **Cookies**: the refresh-token cookie is `sameSite: 'none'; secure: true` in production (see `src/utils/cookies.ts`) so it survives the frontend and backend being on different domains (Vercel + Railway/Render). This requires HTTPS on both ends, which every target in this doc provides by default.
- **File storage**: defaults to local disk (`STORAGE_PROVIDER=local`), which is **not persistent** on Railway/Render — uploaded files disappear on redeploy or restart. Set `STORAGE_PROVIDER=s3` with `AWS_REGION`/`AWS_S3_BUCKET`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` for anything beyond a demo. See "File storage" below.
- **Database**: use a pooled connection string for `DATABASE_URL` and a direct one for `DIRECT_URL` — see "Connection pooling" below.

### File storage

Uploads (resources, submission attachments) go through a small provider abstraction at `src/services/storage/` (`StorageProvider` interface in `types.ts`). Two providers ship today:

- **`local`** (default) — writes to `UPLOAD_DIR` on local disk. Only appropriate for local dev or a single persistent-disk deployment.
- **`s3`** — uploads to an S3 bucket and streams downloads via short-lived (5 min) presigned URLs. Select it with `STORAGE_PROVIDER=s3` plus the `AWS_*` env vars.

To add another backend (Cloudinary, GCS, Azure Blob, etc.), implement `StorageProvider` (three methods: `save`, `sendFile`, `remove`) in a new file under `src/services/storage/` and register it in `storage/index.ts`'s `providers` map — nothing else in the codebase needs to change, since controllers only ever call `getStorageProvider()`.

Cloudinary specifically isn't implemented here (only S3), since it's a closer fit for image/video transforms than the generic file uploads this app stores (PDFs, slide decks, arbitrary attachments) — S3 was the more direct match. Swapping it in later is exactly the "implement `StorageProvider`" step above.

### Connection pooling (Neon)

Neon (and most serverless/managed Postgres) enforces a low connection cap on the *direct* connection, which a PaaS with multiple short-lived instances can exhaust quickly. Neon's dashboard gives you two connection strings per database:

- A **pooled** one (host has a `-pooler` suffix) — set this as `DATABASE_URL`. The running app uses this for every request.
- A **direct** one — set this as `DIRECT_URL`. Only `prisma migrate`/`prisma db push` use this (schema changes need a direct connection; PgBouncer-style poolers used by `-pooler` endpoints don't support the session-level features migrations need).

Both variables already exist in `prisma/schema.prisma`'s `datasource` block — no schema changes needed, just set the two env vars.

### Backups and disaster recovery

**Database (Neon)**: automatic point-in-time-recovery snapshots on paid plans (check your plan's retention window) plus manual branch-based backups (create a branch from any timestamp — an instant clone you can `pg_dump` from without touching the live database). For anything beyond Neon's built-in retention, schedule `pg_dump $DIRECT_URL` on a cron (GitHub Actions scheduled workflow, or Railway's cron jobs) and ship the artifact to S3/off-site storage. **Retention**: keep at least 30 days of nightly dumps plus Neon's PITR window; storing dumps in a *different* provider than the primary DB (e.g. S3 if the DB is on Neon) avoids a single-vendor outage taking out both copies.

**Restore procedure**:
1. Provision a fresh Neon database (or a Neon branch from the desired point in time — faster than a full restore if the incident is recent).
2. `psql $NEW_DIRECT_URL < backup.sql` (or `pg_restore` if using `pg_dump -Fc`).
3. Point the backend's `DATABASE_URL`/`DIRECT_URL` at the restored database, redeploy.
4. Run `npm run prisma:deploy` to confirm the restored schema matches the current migration history (it should, if the backup is recent — this step exists to catch drift, not to modify data).
5. Smoke-test login + a read + a write before directing real traffic at it.

**File storage**: `STORAGE_PROVIDER=local` has **no backup story** — it's a single ephemeral disk; treat any local-storage deployment as demo-only. `STORAGE_PROVIDER=s3` should have [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) enabled on the bucket (protects against accidental overwrite/delete — this app never overwrites a key, but versioning is free insurance) and, for cross-region durability, [Cross-Region Replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html) to a second bucket. Neither is configured by this codebase — both are bucket-level settings in the AWS console/Terraform, not application code.

**Environment variables**: the values themselves live only in each platform's dashboard (Railway/Render/Vercel) and local `.env` files — never in git (see "Environment and secrets" below). Back them up by exporting each platform's env vars to a password manager or secrets vault (1Password, Vault, etc.) whenever they change, so a lost Railway/Render project doesn't also mean lost secrets. Do not back them up as a plaintext file in this repo or in unencrypted cloud storage.

**Migration rollback**: Prisma Migrate has no automatic "undo." If a migration ships a problem:
- **Additive migrations** (new nullable column/table): safe to leave in place; just fix forward with a new migration.
- **Destructive migrations** (dropped/renamed column, changed type): restore from the pre-migration backup (above) rather than trying to hand-write a reverse migration against live data — Prisma's migration history doesn't track enough to auto-generate a safe down-migration once data has been written under the new schema.
- Practical mitigation: **always take a fresh backup immediately before running `prisma migrate deploy` in production**, and prefer additive-then-cleanup migrations (add the new column, backfill, deploy code that uses it, *then* drop the old column in a later migration) over one-shot destructive changes.

### Disaster recovery checklist

- [ ] Neon project has PITR/backups enabled and you know the retention window for your plan.
- [ ] A `pg_dump` cron exists and its artifacts land somewhere other than Neon itself.
- [ ] You've done at least one practice restore (steps above) so the procedure is proven, not just documented.
- [ ] If using S3 storage: bucket versioning is on; you know whether cross-region replication is needed for your data.
- [ ] All production secrets exist in a password manager/vault, not only in Railway/Render/Vercel's dashboards.
- [ ] You take a fresh backup immediately before any destructive migration.
- [ ] You know your Neon/Railway/Render/Vercel support tier's incident-response SLA (free tiers generally have none — factor that into how much you rely on backups vs. platform guarantees).

## Migration workflow going forward

1. Edit `prisma/schema.prisma`.
2. `npm run prisma:migrate` locally — this generates a new file under `prisma/migrations/` and applies it.
3. Commit the generated migration folder.
4. In other environments, run `npm run prisma:deploy` to apply committed migrations without prompting.

`npm run prisma:studio` opens a local GUI for browsing/editing data during development.

## Folder structure

```
backend/
  prisma/
    schema.prisma       # source of truth for the DB schema
    seed.ts             # idempotent demo-data seed
    migrations/         # generated by `prisma migrate dev`, committed to git
  docs/
    DATABASE_DESIGN.md   # full schema + ERD + rationale
  src/
    app.ts               # Express app wiring (middleware stack, route mounting)
    index.ts              # server bootstrap
    config/               # env loading (Zod-validated), central config, swagger spec
    prisma/client.ts       # Prisma client singleton
    routes/                 # one file per resource, thin — validation + middleware + controller wiring
    controllers/             # thin HTTP layer: parse req, call service, shape res
    services/                 # business logic + Prisma queries
    middleware/                # requireAuth, requireRole, validate, upload (multer), errorHandler, notFound
    validators/                 # Zod schemas per resource
    types/                       # shared TS types (auth payloads, Express.Request augmentation)
    utils/                        # ApiError, asyncHandler, jwt, password, pagination, hash, cookies
    uploads/                       # multer disk storage target (gitignored; created on demand)
  .env.example
  .env                            # local only, gitignored
```

## API documentation

Every route file carries `@openapi` JSDoc annotations, compiled into a live spec by `swagger-jsdoc` and served via `swagger-ui-express`:

- UI: `GET /api/docs`
- Raw spec: `GET /api/docs.json`

## Authentication

- **Access token**: short-lived JWT (`JWT_ACCESS_EXPIRES_IN`, default 15m), returned in the login/refresh response body, sent by the client as `Authorization: Bearer <token>`.
- **Refresh token**: longer-lived JWT (7 or 30 days if `rememberMe`), set as an httpOnly, signed, `path=/api/auth` cookie — never exposed to JS. Its hash is stored server-side in `refresh_tokens` so it can be revoked (logout, password change) independent of its own expiry.
- **Password hashing**: bcrypt, configurable work factor (`BCRYPT_SALT_ROUNDS`, default 12).
- `POST /api/auth/refresh` rotates the refresh token on every use (old one revoked, new one issued) — a stolen, already-used refresh token cookie stops working.
- `requireAuth` middleware verifies the access token and re-fetches the user from the database on every request (so a deactivated/deleted account is blocked immediately, not just after the access token expires).
- `requireRole(...)` / `requirePermission(...)` middleware gate routes by role or by the role's permission set (`role_permissions`, seeded from the frontend's existing `ROLE_PERMISSIONS` map).

## Known limitations / follow-ups

- ~~**`POST /api/auth/forgot-password`** matches the insecure mock contract~~ — replaced 2026-07-16 with a token-verified reset flow: `forgot-password` takes only an email, always responds 200 (no account enumeration), and issues a single-use 1-hour token (SHA-256 hash stored in `password_reset_tokens`; raw token emailed via the EmailProvider, and included in the response only when `config.exposeAuthTokens`). `reset-password` verifies the token, sets the password, and revokes all refresh tokens. Account Settings now calls `change-password` (current-password-verified).
- **`POST /api/auth/invite`** — the raw invite token is included in the response only when `config.exposeAuthTokens` is true (default in every environment except `NODE_ENV=production`, overridable via `EXPOSE_AUTH_TOKENS`). No email provider is connected yet — `src/services/email/` defines a provider-neutral interface with a console-logging dev provider (logs only `to`/`subject`, never the token-bearing body); implement a real provider there before relying on invite delivery in production.
- Batch/assignment/session/submission/attendance **enum values use TypeScript-safe identifiers** (e.g. `DataEngineering`, `NotStarted`) rather than the frontend's display strings (`'Data Engineering'`, `'Not Started'`). A thin label-mapping layer will be needed wherever the frontend is wired up to these fields.
- **Audit log coverage**: user create/delete/role-change, batch create/update/delete, assignment create/update/delete, submission grading, session create/update/delete, resource upload/verify/delete, and feedback submission all write to `audit_log` (see `src/services/audit.ts` and each controller). Not yet covered: announcements and discussions have no backend routes at all (still frontend-only mock data).
- The bcrypt install-time dependency chain (`node-pre-gyp` → `tar`) has known high-severity advisories in `npm audit`. These affect the local native-binding build step only, not runtime request handling, and no non-breaking fix is currently available upstream.
- **No WebSocket/real-time layer exists** in this codebase (frontend or backend) — nothing here uses Socket.io or raw WebSockets. `VITE_SOCKET_URL` in the frontend's `.env.example` is a placeholder for if that's added later.
- **The initial migration (`prisma/migrations/<timestamp>_init/`) was generated offline** (`prisma migrate diff --from-empty --to-schema-datamodel`) and validated/formatted/reviewed for destructive SQL, but has not been applied to or proven against a real PostgreSQL instance — no reachable database was available while building this. Run `npm run prisma:deploy` against a real, empty database as the first actual proof.

## Frontend

The React frontend (`../frontend`) is connected to this API — see `../frontend/README.md`. Deployment for both together is documented in the root [`DEPLOYMENT.md`](../DEPLOYMENT.md).
