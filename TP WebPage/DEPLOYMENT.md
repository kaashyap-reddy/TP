# Deployment Guide

Trainee Portal: React/Vite frontend (`frontend/`) + Express/TypeScript/Prisma backend (`backend/`), PostgreSQL database.

Targets: **Vercel** (frontend), **Railway** preferred or **Render** (backend), **Neon** (PostgreSQL).

Before anything else: `npm run launch:check` from the repo root runs everything in the "can be completed now" table below automatically (builds, tests, Prisma validation, migration review, config-file presence, no-hardcoded-localhost, no-placeholder-secrets) and prints a pass/fail/warn summary without ever printing a secret value.

## What you can do right now vs. what needs office access or an external account

This split exists because everything in the left column was done/verified on a locked-down machine with no admin rights and no reachable database — it's exactly what's safe to run anywhere. The right column is unavoidably gated on things only you can provide (a real database, hosting accounts, a domain).

### Can be completed now — no credentials, no admin rights, run from `backend/` or `frontend/` as noted

| # | Command | Expected result |
|---|---|---|
| 1 | `npm install --prefix backend` / `npm install --prefix frontend` (or `npm run install:all` from the repo root) | Installs cleanly; no admin rights needed, no global packages |
| 2 | `cd backend && npx prisma validate` | `The schema at prisma\schema.prisma is valid 🚀` |
| 3 | `cd backend && npx prisma format` | Reformats `schema.prisma` in place (idempotent — re-running produces no diff) |
| 4 | `cd backend && npx prisma generate` | `✔ Generated Prisma Client ... to .\node_modules\@prisma\client` |
| 5 | Review the generated migration: open `backend/prisma/migrations/<timestamp>_init/migration.sql` | Should contain only `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE ... ADD CONSTRAINT` — no `DROP`/`DELETE`/`TRUNCATE`. It was generated offline via `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` and has **not** been applied to any real database yet |
| 6 | `npm run build --prefix frontend` | `tsc -b && vite build` succeeds; bundle written to `frontend/dist/` |
| 7 | `npm run build --prefix backend` | `tsc -p tsconfig.json` succeeds; compiled output written to `backend/dist/` |
| 8 | `cd backend && npm test` | All backend unit tests pass (mocked Prisma — no live DB touched) |
| 9 | `cd backend && npm run dev` then `curl http://localhost:4000/health` | `{"status":"ok"}` — confirms the server boots even with no reachable database |
| 10 | `curl http://localhost:4000/api/health` (with step 9's server running) | `{"status":"degraded","checks":{"server":"ok","database":"error","storage":"ok"}}` — `database:"error"` is *expected* here with no DB; this is proof the readiness check itself works correctly, not a bug |
| 11 | Diff `backend/.env` against `backend/.env.example`, and `frontend/.env` against `frontend/.env.example` | Every variable in the `.example` file is accounted for; no real secret values are ever present in the `.example` files (only placeholders/blanks) |
| 12 | `grep -rn "localhost" frontend/src backend/src` (or use the launch-check script below) | No matches outside comments/docs — confirms no hardcoded dev URLs made it into application code |

Steps 1–11 are also encoded as a single script — see "Automated launch-readiness script" further down — so you don't have to run them by hand.

### Requires office access, credentials, or an external service

| # | Action | Exact step | Expected result | Rollback / troubleshooting | Needs |
|---|---|---|---|---|---|
| 1 | Create the database | [neon.tech](https://neon.tech) → New Project | Two connection strings (pooled + direct) | Delete the Neon project to start over — no data exists yet at this point | External account (Neon), no admin rights |
| 2 | Set `DATABASE_URL`/`DIRECT_URL` | Paste Neon's strings into Railway/Render's env var UI (or local `backend/.env` for a one-off migrate) | `npx prisma migrate status` (from a machine that can reach Neon) reports the `_init` migration as pending, not errored | If the connection string is wrong you'll get `P1001` — re-copy from Neon's dashboard, pooled vs. direct matters (see Troubleshooting below) | External credentials (Neon connection string) |
| 3 | Apply the migration | `cd backend && npm run prisma:deploy` (needs step 2's `DATABASE_URL`/`DIRECT_URL` reachable) | `Applying migration ... _init` then `All migrations have been successfully applied` | Safe to re-run — `migrate deploy` is idempotent and only applies unapplied migrations. If it fails partway, fix the underlying issue and re-run; do not `migrate reset` on a database with real data | External credentials (reachable Neon `DATABASE_URL`) |
| 4 | Seed demo accounts (optional) | `cd backend && ALLOW_DEMO_SEED=true npm run prisma:seed` (the `ALLOW_DEMO_SEED` flag is required whenever `NODE_ENV=production` — see backend/README.md) | `Seed complete.` — creates 3 demo accounts with well-known passwords | Re-running is safe (upserts); to remove the demo accounts afterward, deactivate them via `PATCH /api/users/:id` `{"isActive":false}` | External credentials (reachable `DATABASE_URL`); admin judgment call on whether demo accounts belong in this environment at all |
| 5 | Deploy the backend | Railway: New Project → Deploy from GitHub repo → root dir `backend/` (or Render Blueprint using `render.yaml`) | Public URL responds `{"status":"ok"}` at `/health` | Roll back via the platform's own deploy-history "redeploy previous version" button — do not delete the service | External account (Railway or Render), repo push access |
| 6 | Deploy the frontend | Vercel: Add New Project → root dir `frontend/` | Public URL loads the login page | Vercel keeps every deploy; roll back via Project → Deployments → "Promote to Production" on an older one | External account (Vercel) |
| 7 | Configure `CORS_ORIGIN` | Backend env var = the Vercel URL from step 6, redeploy backend | Frontend can call the API without CORS errors in the browser console | Revert the env var to the previous value and redeploy if something regresses | External access (Railway/Render dashboard) |
| 8 | Configure persistent file storage | Create an S3 bucket, set `STORAGE_PROVIDER=s3` + `AWS_*` vars | A file uploaded through the app survives a redeploy | Switch `STORAGE_PROVIDER` back to `local` to isolate whether S3 config is the problem | External account (AWS), credentials |
| 9 | Custom domain + HTTPS | Vercel/Railway/Render dashboard → Domains → add domain, follow their DNS instructions | Certificate auto-provisions (usually within minutes); site loads over `https://` | DNS changes can take up to 24-48h to propagate; if TLS provisioning is stuck, remove and re-add the domain | Domain registrar access (DNS records), no admin rights on the machine itself |
| 10 | Enable monitoring | UptimeRobot/Better Uptime pointed at `/api/health`; optionally Sentry using the prepared hook points (`backend/src/utils/monitoring.ts`, `frontend/src/utils/monitoring.ts`) | Uptime monitor shows "up"; Sentry (if connected) shows a test event | Disable the monitor/remove the DSN env var to fully back out | External account(s) (monitor + optionally Sentry) |
| 11 | Connect a real email provider | Implement a new `EmailProvider` in `backend/src/services/email/` (see that folder's `index.ts` for the exact 3-step pattern), point `EMAIL_*` env vars at it | Inviting a user sends a real email instead of just logging `email.would_send` | Revert to the console provider (default) by not setting the new provider's env vars | External account (SES/Postmark/Resend/etc.), credentials |
| 12 | Final role-by-role live smoke test | Manually log in as admin/facilitator/trainee on the deployed URL and walk the checklist below | Every checked item passes | N/A — this is verification, not a change | Live deployment from steps 1-9 above; no additional credentials |

## Deployment order

Deploy in this order — each step needs an output from the previous one:

1. **Neon (database)** — create the project, get pooled + direct connection strings.
2. **Railway or Render (backend)** — deploy using the Neon strings from step 1. Get the backend's public URL.
3. **Run migrations + seed** against Neon (one-off command, using the backend's env).
4. **Vercel (frontend)** — deploy with `VITE_API_URL` pointing at the backend URL from step 2.
5. **Update `CORS_ORIGIN`** on the backend to the Vercel URL from step 4, redeploy the backend.
6. **Smoke-test** the deployed app end to end (see "Production checks" below).
7. **(Optional) custom domains + HTTPS** for both, then repeat step 5 with the final frontend domain.

Step 5 has to come after step 4 because you need the frontend's real URL before the backend will accept cross-origin requests from it. Expect one redeploy of the backend after the frontend's URL is known.

---

## 1. Database — Neon

1. Create a project at [neon.tech](https://neon.tech), region close to your backend host.
2. In the Neon dashboard, copy two connection strings:
   - **Pooled** (host ends in `-pooler`) → this is `DATABASE_URL`.
   - **Direct** (no `-pooler`) → this is `DIRECT_URL`.
   
   Both are needed — see `backend/README.md` § "Connection pooling" for why.
3. Nothing else to do here yet; tables are created by Prisma Migrate in step 3 below, from the migration already generated and reviewed at `backend/prisma/migrations/<timestamp>_init/migration.sql`.

**Backups**: Neon takes automatic snapshots on paid plans; branching (instant copy-on-write clones) doubles as ad-hoc backups. For off-platform backups, schedule `pg_dump $DIRECT_URL` on a cron and ship the dump to S3.

## 2. Backend — Railway (preferred)

1. Push this repo to GitHub if it isn't already.
2. In Railway: **New Project → Deploy from GitHub repo**, select this repo.
3. Set the service's **root directory** to `backend/` (Railway monorepo setting).
4. Railway auto-detects `backend/Dockerfile` and `backend/railway.json` (build via Docker, health check at `/health`). No build/start command overrides needed.
5. Add environment variables (Railway dashboard → Variables): every entry in `backend/.env.example` that isn't blank, using:
   - `DATABASE_URL` / `DIRECT_URL` from Neon (step 1).
   - Real random secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` (`openssl rand -base64 48` each — do not reuse the `dev-*` values from local `.env`).
   - `CORS_ORIGIN` — set to `http://localhost:5173` for now; you'll update it after step 4.
   - `NODE_ENV=production`.
   - Leave `STORAGE_PROVIDER=local` for an initial smoke test, or set it to `s3` immediately if you already have a bucket (recommended before real use — Railway's filesystem is not persistent across deploys).
6. Deploy. Railway gives you a public URL like `https://<service>.up.railway.app`.
7. Confirm it's up: `curl https://<service>.up.railway.app/health` → `{"status":"ok"}`.

### Backend — Render (alternative)

1. In Render: **New → Blueprint**, point it at this repo — it will read the root `render.yaml`.
2. Fill in the `sync: false` env vars in the dashboard (same list as the Railway step above).
3. Deploy. Render gives you a URL like `https://trainee-portal-backend.onrender.com`.

## 3. Run migrations + seed

Run once against the Neon database, from wherever you have the production `DATABASE_URL`/`DIRECT_URL` available — either your local machine (temporarily point `backend/.env` at Neon) or a one-off command in Railway/Render's dashboard:

```bash
cd backend
npm run prisma:deploy                       # applies committed migrations — safe to re-run
ALLOW_DEMO_SEED=true npm run prisma:seed     # optional; idempotent; creates 3 demo accounts (see backend/README.md)
```

`prisma:seed` refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true` is explicitly set — these are fixed, publicly-documented demo passwords, and that guard exists so they can't end up in a real deployment by accident. Skip the seed step entirely for a production environment with real users; run it only for a demo/staging environment.

Neither command is run automatically on every container start (see `backend/README.md` § Production deployment) — run migrate explicitly on first deploy and after every migration-adding release.

## 4. Frontend — Vercel

1. In Vercel: **Add New → Project**, import this repo.
2. Set **Root Directory** to `frontend/`. Vercel auto-detects Vite; `frontend/vercel.json` supplies the SPA rewrite rule and asset caching headers.
3. Environment variable: `VITE_API_URL` = `https://<your-backend-url>/api` (from step 2, including the `/api` suffix).
4. Deploy. Vercel gives you a URL like `https://trainee-portal.vercel.app`.

## 5. Close the loop: update CORS

Back in Railway/Render, set `CORS_ORIGIN` to the exact Vercel URL from step 4 (e.g. `https://trainee-portal.vercel.app` — no trailing slash; comma-separate if you also want a preview-deployment URL allowed). Redeploy the backend.

## 6. Production checks

Run through this list against the live URLs:

- [ ] **Authentication** — log in as each seeded role (`backend/README.md` has the demo credentials), confirm the session persists across a page refresh (refresh-token cookie working cross-domain).
- [ ] **Protected routes** — visiting `/admin` while logged in as a trainee redirects instead of rendering.
- [ ] **Routing** — deep-link directly to a nested route (e.g. paste `https://.../admin` into a fresh tab) and refresh; should not 404 (SPA rewrite working).
- [ ] **File uploads** — upload a resource/attachment; confirm it appears and downloads correctly (validates the storage provider end to end).
- [ ] **Downloads** — download a previously-uploaded file.
- [ ] **Database** — create/edit/delete a record (e.g. a batch) and confirm it persists after a refresh.
- [ ] **Error pages** — hit a nonexistent API route (`/api/does-not-exist`) → JSON 404, not an HTML error page; hit a nonexistent frontend route → still renders the app shell (redirected to login), not a blank page.
- [ ] **Socket connections** — N/A; this build has no real-time/WebSocket layer (see `backend/README.md`).

## 6b. Health checks and monitoring

**Health endpoints** (see `backend/src/routes/health.routes.ts`):
- `GET /health` — fast liveness probe, no dependency checks. This is what Railway's `railway.json` / Render's `render.yaml` poll to decide if the instance is up; keeping it dependency-free means a slow/unreachable database doesn't get an otherwise-healthy instance killed.
- `GET /api/health` — readiness probe: pings the database (`SELECT 1`) and the active storage provider (bucket HEAD for S3, directory-writable check for local), returns `503` with a per-dependency `checks` object if anything's down. Point external uptime monitors at this one, not `/health`, if you want to actually know when the DB is unreachable.

Neither endpoint returns connection strings, stack traces, or any other internal detail — just `ok`/`error` per component.

**Recommendations** (not implemented — each needs an external account/API key this environment doesn't have):
- **Uptime monitoring**: point a free monitor (UptimeRobot, Better Uptime, or Railway/Render's own built-in health-check-based restart) at `GET /api/health` on an interval — 1–5 minutes is plenty given the endpoint's 300-req/15-min rate limit headroom.
- **Error tracking**: [Sentry](https://sentry.io) is the standard single choice here — it covers both error tracking and basic performance/APM in one SDK, so it's the one addition worth making rather than bringing in separate tools for each. Wire it into `backend/src/middleware/errorHandler.ts` (call `Sentry.captureException(err)` in the final catch-all branch) and, if desired, the frontend's top-level error boundary. Needs a `SENTRY_DSN` env var — deliberately not added here since it requires creating an account.
- **Log aggregation**: Railway and Render both capture and let you search stdout/stderr by default — no separate log shipper needed. `backend/src/utils/logger.ts` emits one JSON object per line specifically so those built-in log views (or `grep`/`jq` over an exported log) can filter by `event`/`level`/`userId` instead of parsing free text.
- **Performance monitoring**: covered by Sentry's APM if adopted; otherwise Railway/Render's dashboards already surface CPU/memory/response-time graphs per service with no extra configuration.

**Error-tracking integration point** (prepared, not wired up — no SDK installed, costs nothing until used): `backend/src/utils/monitoring.ts` and `frontend/src/utils/monitoring.ts` each export a `reportError()` no-op already called from the right place (`middleware/errorHandler.ts`'s catch-all, and `components/ErrorBoundary.tsx`'s `componentDidCatch`). Each file's header comment is the exact 3-step wiring instructions for Sentry once you have a DSN. Env placeholders (`SENTRY_DSN`, `VITE_SENTRY_DSN`) already exist in both `.env.example` files, unset by default.

**Frontend crash safety**: `main.tsx` wraps the app in `ErrorBoundary` — without it, any uncaught render error anywhere blanks the entire page with no way to recover; with it, a single bad component shows a "Reload page" fallback instead of taking down the whole session.

### Monitoring checklist

- [ ] **Uptime checks** — external monitor (or Railway/Render's built-in) polling `GET /api/health`.
- [ ] **Error tracking** — connect Sentry (or equivalent) via the prepared hook points above, or at minimum commit to reviewing logs regularly without it.
- [ ] **Log review** — know where to find Railway/Render's log view; structured JSON lines (`event`, `level`, `userId`, `time`, `env`) are filterable there or via `jq` on an exported log.
- [ ] **Database alerts** — enable Neon's built-in alerting (storage/compute thresholds) in its dashboard; `GET /api/health`'s `database` check catches connectivity loss but not slow-approaching quota limits.
- [ ] **Storage failures** — if using S3, enable CloudWatch alarms on 4xx/5xx rates for the bucket; `GET /api/health`'s `storage` check catches total unavailability (bad credentials, bucket gone) but not partial/intermittent failures.

## 7. Custom domain + HTTPS

**Frontend (Vercel)**: Project → Settings → Domains → add your domain, follow Vercel's DNS instructions (usually a `CNAME` to `cname.vercel-dns.com`, or an `A` record if it's an apex domain). Vercel provisions and renews the TLS certificate automatically — nothing to configure.

**Backend (Railway)**: Project → Settings → Networking → Custom Domain, add a `CNAME` per Railway's instructions. Railway also auto-provisions TLS. (Render: Settings → Custom Domains, same idea.)

**After adding custom domains**, update:
- Frontend's `VITE_API_URL` → the backend's custom domain, redeploy frontend.
- Backend's `CORS_ORIGIN` → the frontend's custom domain, redeploy backend.

If you put the frontend and backend on subdomains of the *same* registrable domain (e.g. `app.example.com` + `api.example.com`), the refresh cookie's `sameSite: 'none'` still works (it's a superset of what `'lax'` would need for a same-site pair), so no code changes are required either way.

## Environment variable management

- **Never commit `.env`** — both `frontend/.gitignore`-equivalent (root `.gitignore`) and `backend/.gitignore` already exclude it; only `.env.example` files are tracked.
- Store production secrets in the platform's dashboard (Railway/Render/Vercel all have an env var UI) — not in a shared doc or repo.
- Rotate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`COOKIE_SECRET` if ever exposed; this invalidates all existing sessions (users need to log in again), which is the correct/expected behavior for a rotation.
- After changing any env var on Railway/Render/Vercel, a redeploy is required to pick it up — none of these platforms hot-reload env changes into a running instance.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Frontend loads but every API call fails with a CORS error | `CORS_ORIGIN` on the backend doesn't (yet) include the frontend's exact origin, or `VITE_API_URL` is wrong |
| Login succeeds but the session doesn't survive a refresh | Cookie not being set — check both frontend and backend are on HTTPS (required for `secure`/`sameSite:'none'` cookies); check the backend logs for the actual `Set-Cookie` header |
| 404 on any route except `/` after deploying the frontend | SPA rewrite missing — confirm `frontend/vercel.json` was picked up (Root Directory must be `frontend/`) |
| Uploaded files vanish after a redeploy | `STORAGE_PROVIDER=local` on an ephemeral filesystem (Railway/Render) — switch to `STORAGE_PROVIDER=s3` |
| `prisma migrate deploy` fails with a connection error | Using the pooled (`-pooler`) URL for `DIRECT_URL` — migrations need the *direct* Neon connection string, not the pooled one |
| Backend crashes on boot with "Invalid environment variables" | A required var is missing/too short — check the exact field in the error against `backend/.env.example` |
| 500 with a full stack trace in the response body | You're running with `NODE_ENV` not set to `production` — the error handler (`backend/src/middleware/errorHandler.ts`) only hides internals when `config.isProduction` is true |

## What's already handled vs. what's a known gap

**Handled by this codebase already**: Helmet, CORS (credentialed), gzip compression, request logging (morgan, verbose in dev / combined in prod), centralized error handling that hides internals in production, `/health` + `/api/health` endpoints, graceful shutdown (SIGTERM/SIGINT drain + Prisma disconnect), cross-domain-safe cookies, pluggable file storage (local/S3), lazy-loaded routes, SPA rewrites, Neon-ready pooled/direct connection split.

**Known gaps, not addressed by this pass** (see `backend/README.md` § Known limitations for detail):
- No real-time/WebSocket layer exists anywhere in this codebase, despite `VITE_SOCKET_URL` being documented as a placeholder — there is nothing to deploy or configure for it.
- No real email provider is connected — `backend/src/services/email/` has a provider-neutral interface and a console-logging dev provider, but invite emails aren't actually delivered until a real provider (SES/Postmark/Resend/etc.) is implemented against that interface. In production, invite tokens are no longer echoed back in the API response (see `config.exposeAuthTokens`) — until a provider is connected, the only way to get an invite link to a real user is manually, via the database or a temporary `EXPOSE_AUTH_TOKENS=true`.
- The `forgot-password` endpoint is unauthenticated-by-design (email + new password, no verification token) — a pre-existing contract carried over from the original mock backend, not something this pass changed. `change-password` (current-password-verified) is the secure path for an already-logged-in user.
- Cloudinary isn't implemented (only S3) — swappable via the `StorageProvider` interface if needed later.
- Audit logging now covers users, batches, assignments, submissions, resources (upload/verify/delete), sessions, and feedback — so `/api/notifications` will show real data once a database is live. Not yet covered: announcements and discussions (no backend routes exist for those at all — they remain frontend-only mock data, unchanged from earlier passes).
- **The generated migration (`backend/prisma/migrations/<timestamp>_init/`) has been generated and validated offline (`prisma validate`, `prisma format`, reviewed for destructive SQL) but has NOT been applied to or proven against any real PostgreSQL instance** — no reachable Postgres was available in this environment. Treat `npm run prisma:deploy` against your first real Neon database as the actual first proof this schema works, and budget time for it.
- This guide's deployment steps themselves are similarly unexercised end-to-end in this environment — the configuration is correct per each platform's documented contract, but nothing here substitutes for the real first deploy.

## Manual launch checklist

Everything here needs a browser against the live deployment (or, where noted, a deployed backend) — none of it can be automated from a machine with no database/hosting access. Do this after completing the "requires office access" table above.

**Authentication & authorization**
- [ ] Admin login succeeds; logout clears the session (refresh doesn't silently log back in).
- [ ] Facilitator login succeeds; logout works.
- [ ] Trainee login succeeds; logout works.
- [ ] A trainee visiting an admin-only URL is redirected, not shown the page (role authorization enforced).
- [ ] Refreshing the page while logged in keeps the session (refresh-token cookie surviving a hard reload).

**Core CRUD flows** (spot-check one create + one edit + one delete per role's primary entity)
- [ ] Admin: create/edit/delete a batch.
- [ ] Facilitator: create an assignment, grade a submission.
- [ ] Trainee: submit an assignment, view feedback.

**File operations**
- [ ] Upload a resource/attachment; it appears in the list immediately.
- [ ] Download a previously-uploaded file; it opens/saves correctly.
- [ ] Delete a resource (as its owner or admin); it disappears from the list.
- [ ] Attempt to access another user's private submission attachment directly by URL — confirm it's rejected (403/404), not served.

**Notifications**
- [ ] The notification bell shows real entries once actions have been performed (audit logging now covers users/batches/assignments/submissions/resources/sessions/feedback).
- [ ] Mark-as-read / mark-all-as-read work and persist across a refresh.

**Persistence**
- [ ] **Database persistence after restart**: create a record, restart the backend service (Railway/Render redeploy or manual restart), confirm the record is still there — proves you're actually on Postgres, not an in-memory fallback.
- [ ] **Storage persistence after redeployment**: upload a file, trigger a redeploy, confirm the file still downloads. If `STORAGE_PROVIDER=local`, expect this to **fail** (documented, expected — switch to `s3` before this matters for real use).

**Operational readiness**
- [ ] **Backup confirmation**: confirm Neon's backup/PITR is actually enabled for this project (not just "available on paid plans" — check the plan). If using S3, confirm bucket versioning is on.
- [ ] **Monitoring confirmation**: the uptime monitor from the checklist above shows a green check against the live URL, not just against localhost during setup.

## Automated launch-readiness script

```bash
npm run launch:check   # from the repo root
```

Runs, in order: backend `.env` completeness (no secrets printed) → placeholder-secret detection (warns, doesn't fail — dev secrets are expected locally) → `prisma validate` → migration files exist and contain no destructive SQL → required deployment files exist → health endpoint wiring → no hardcoded `localhost` in application source (with a 3-entry allowlist for documented dev-only defaults) → frontend build → backend build → backend test suite. Exit code `0` iff nothing failed (warnings are still reported but don't fail the run). Safe to wire into CI once one exists.
