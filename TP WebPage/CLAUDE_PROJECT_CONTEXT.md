# CLAUDE_PROJECT_CONTEXT — Trainee Portal

Compact, durable context for future Claude CLI sessions. Read this instead of rescanning the repo. Last updated: **2026-07-17** — **PostgreSQL is now connected on this machine** (local install, no admin rights needed — see §2b) and real login/JWT/announcements have been verified end-to-end against it, on top of the 2026-07-16 hardening pass (ESLint, frontend vitest, Playwright e2e, CI, token-verified password reset, `/api/announcements` backend — all still current, see §10/§11 for exact state).

## 1. Purpose

Internal Trainee Management Portal. Core workflow: an Admin onboards a new batch by entering a name, picking one of **two standard Training Plans (BA BTech, BA MBA)** and a start date — the plan's full ~2-month schedule (42 Mon–Fri sessions 2:30–4:30 PM, ~36 daily case-study assignments due 11:59 PM, resources, announcements, session-feedback links) is instantiated automatically as that batch's **own editable copy**; the template is never mutated by batch edits.

## 2. Stack & Layout

- `frontend/` — React 18 + TS + Vite + Tailwind + Zustand + react-router v6. Route-level lazy loading. Dev server :5173, proxies `/api` → :4000.
- `backend/` — Express + TS + Prisma (PostgreSQL) + zod validators + vitest (tests run **without** a DB). Dev :4000.
- **Demo Mode**: `frontend/src/services/api/demoMode.ts` intercepts every API call at `apiClient.ts` when entered via the login page's "View as Admin/Facilitator/Trainee" buttons. Fixtures in `demoData.ts` mirror `backend/prisma/seed.ts` exactly (same curriculum constants). Demo session survives reload (sessionStorage); fixture data resets on reload by design.
- Git repo root is the **parent** folder (`Trainee Portal/`); app lives in `TP WebPage/`.

## 2b. Local PostgreSQL (connected 2026-07-17)

- Installed via `winget install --id PostgreSQL.PostgreSQL.17` — no admin rights were needed (ran cleanly unelevated on this machine). Runs as Windows service `postgresql-x64-17` on `localhost:5432`, superuser `postgres` / password `postgres` (winget's unattended install default — **dev-only, never reuse in a real deployment**).
- Database `trainee_portal` created manually (`CREATE DATABASE trainee_portal;`); `backend/.env`'s `DATABASE_URL`/`DIRECT_URL` already pointed at exactly this connection string before the install (pre-staged for this moment).
- All 10 migrations applied (`npm run prisma:deploy` from `backend/`) and seeded (`npm run prisma:seed`) — 6 real accounts, 2 training plans, 5 batches, 210 real sessions. Same emails/passwords as the demo fixtures (`admin@company.com` / `password123`, `trainee@company.com` / `trainee123`, etc. — see §12) but now backed by real Postgres rows, not Demo Mode's client-side interception.
- **Gotcha hit during setup, now resolved**: the `20260716180000_password_reset_tokens` migration file had silently been saved as UTF-16 (this environment's `Write` tool defaults to UTF-16 on this machine, not just "preserves existing encoding" as elsewhere) — Prisma's Rust migration engine can't parse that and fails with a misleading `P3015 "Could not find the migration file"`. Fixed by deleting and rewriting the file via a tool that forces real UTF-8. If a future migration file mysteriously 404s to Prisma despite `Test-Path`/`fs.existsSync` confirming it exists, check its encoding (`xxd file | head` — UTF-16 shows a `00` byte after every ASCII char) before assuming anything else is wrong.
- To run locally: `npm run dev` in `backend/` (port 4000) and `npm run dev` in `frontend/` (Vite picks an open port from 5173 up, proxies `/api`). `GET /api/health` should report `"database":"ok"`.

## 3. Roles & Navigation (standardized order, `frontend/src/constants/navigation.ts`)

- **Admin** (`/admin`): Real-time Analytics · Batch Management · Training Plans · Assignments · Sessions & Calendar · Global Resources · Announcements · Feedback · Reports · Audit Logs.
- **Facilitator** (`/facilitator`): Dashboard · Batches · Assignments · Sessions & Calendar · Resource Library · Announcements · Feedback & Reports · Trainees.
- **Trainee** (`/trainee`): My Progress · My Batch · Assignments · Sessions & Calendar · Learning Repository · Announcements · My Session Feedback · Facilitators.
- Sessions/Calendar/Events are **merged** into one "Sessions & Calendar" tab per role. **Discussions is removed** from Facilitator and Trainee (Admin never had it). Contact actions use `mailto:`.
- Detail routes: `/admin/training-plans/:planId`, `/admin/trainees/:name`, `/facilitator/batches/:batchId`, `/facilitator/trainees/:name`, `/assignments/:assignmentId`, `/{role}/account-settings`.

## 4. Confirmed Completed Features (audit 2026-07-15: 58 PASS, 0 FAIL)

- Template→copy batch automation (backend transaction in `batches.service.ts create()`; mirrored in demo `POST /batches`). Template isolation banner on plan detail page.
- Admin Training Plan editor: stats, full session/assignment lists with View/Edit/Reschedule/Delete, Add Session/Assignment, Assign to Batch.
- Admin batch onboarding modal (name + plan + start date; trainer optional); expandable batch rosters; trainee names → admin trainee profile with back-context.
- Admin/Facilitator Sessions & Calendar: 2:30 PM – 4:30 PM timing, `Session Feedback: Open Feedback Form` wording (never "Assignment: …"), attach/edit/remove/copy form links with audience (Trainees/Facilitators/Both), Record Attendance, List/Calendar toggle.
- Assignments tables: Title · Batch (real names, no `—`) · Related Session · Deadline · Status · progress · Assignment File. No Facilitator or Training Plan columns. Assignment detail page (admin/facilitator) has its own `Assignment Feedback` form link (attach/edit/copy/remove, audience-gated) independent of any related session's form; Trainee Assignments tab shows a per-row "Submit Assignment Feedback" action once attached.
- Facilitator: own-batches only → `FacilitatorBatchDetailPage` (per-trainee stats) → trainee profile → Back returns to same batch (origin tracked in `facilitatorProfileNav.ts`, safe fallback = Batches tab).
- Trainee: "MY CURRENT BATCH" highlight (first/earliest enrollment); submit/resubmit with hard post-deadline block + tooltip message; per-completed-session "Submit Session Feedback" (opens URL, records submission, flips to "Feedback Submitted"); "My Session Feedback" tab (pending vs Submitted); Facilitators contacts page.
- Scoping/security: batch rosters, feedback forms (audience + `withFeedbackFormVisibility`), and metrics are role/batch-scoped on both backend and demo layers.
- Cross-cutting polish (earlier passes): NotificationPanel, GlobalSearch (Ctrl+K, Admin), EmptyState/StatusBadge everywhere, SavingButton, useEscapeKey on all modals, aria-labels, profile dropdown + account settings on all three portals, route lazy-loading.

## 5. Pending / Not Yet Done

- ~~PostgreSQL not connected~~ — **connected locally 2026-07-17** (§2b). Real login/JWT, real announcements CRUD + per-user read tracking, and live (initially-empty/null) metrics are all verified working end-to-end. Still pending: **S3 file storage** (local `STORAGE_PROVIDER` works fine for dev; S3 needs an AWS account), **a real email provider** (invite/reset-link emails still just log to console — see `backend/src/services/email/`), **a deployed/hosted Postgres** (this is a local dev instance only; Neon is still the intended production path per DEPLOYMENT.md), and **a real-mode Playwright pass committed to the repo** (verified manually this session, see §10, but `frontend/e2e/` still only covers Demo Mode).
- The frontend's announcements *rendering* on the three dashboards now calls the real API (`announcementsStore.ts` → `announcements.service.ts` → `/api/announcements`), with full Demo Mode parity (`DEMO_ANNOUNCEMENTS` fixtures + scoped handlers in `demoMode.ts`). Not yet done: nothing — this was the last known mock-data holdout and it's now wired both ways.
- Real Microsoft Forms links: manual step (create in forms.office.com, paste into Training Plan session `feedbackFormUrl`, per-session `Session Feedback: Edit`, or an assignment's `Assignment Feedback: Edit` on its detail page). Demo URLs are labeled placeholders (`forms.gle/...-day-N-feedback`).

## 6. Known Issues

None open. Two real bugs surfaced 2026-07-17 by the first-ever real-backend test pass (both invisible in Demo Mode, which never validates query params) — both **fixed**:

- **`pageSize` cap too low for real usage**: `sessionService.ts`/`assignmentService.ts`/`resourceService.ts`/`feedbackService.ts` all request `pageSize: 200` (deliberate "fetch everything, no server pagination" design), but the backend's `paginationQuerySchema` capped at 100 — every one of those real API calls 400'd on first real login. Raised the cap to 500 (`backend/src/utils/pagination.ts`) and bumped the four frontend call sites to match (500 comfortably covers today's 5 batches × 42 sessions = 210, with headroom).
- UTF-16-encoded migration file — see §2b.

Previously-listed minor issues, all **fixed 2026-07-16** (verified via Playwright demo pass + `tsc` + `vite build`):

1. Demo URL validation — `assertValidUrl()` in `demoMode.ts` mirrors backend `z.string().trim().url()` on session/assignment feedback-form POST/PATCH, TP session `feedbackFormUrl`, TP resource `url`. Both `SessionFeedbackCell`/`AssignmentFeedbackCell` also gained catch+toast on save/remove (errors were previously swallowed against the real backend too).
2. Per-trainee attendance — `DEMO_ATTENDANCE` fixtures (deterministic mostly-Present per completed session) in `demoData.ts`; `/batches/:id/trainee-stats` computes real percentages; `/sessions/:id/attendance` GET/PUT now serve/upsert records mirroring `attendance.service.ts`.
3. Assignment instruction files — every generated demo assignment carries a labeled `… Case Study Brief (Sample).txt` attachment; demo `POST/PATCH /assignments` honor an uploaded file's real metadata; live-generated batches honestly get `attachment: null`.
4. Login-page console 500s — `authService.refresh()` skips the network when neither Demo Mode nor a `tp-session-hint` localStorage flag (set on login, cleared on logout/failed refresh) indicates a session could exist.
5. 404 — `*` catch-all now renders `NotFoundPage.tsx` (shows the bad path; links to role dashboard or sign-in) instead of redirecting to login.
6. Missing favicon 404 in console — added `frontend/public/favicon.svg` + link tag.
7. ~~Demo Mode submitted filename blank after upload~~ — fixed 2026-07-15 (commit `00349f8`).

## 7. Important Business Rules

- Exactly **two** Training Plans: `ba-btech`, `ba-mba`; program is always `BA`, track derived from plan code (`deriveProgramTrack`).
- Working-day math: `nthWorkingDay()` (identical in `batches.service.ts` and `demoData.ts`) — Mon–Fri only, weekend start rolls to Monday; `dayOffset`/`dueDayOffset` are working-day indices. Local wall-clock time, **not UTC** (870 = 14:30 literal).
- Curriculum constants: sessions 14:30–16:30; assignment work starts 09:30; deadline 23:59; 42 sessions; assignments skipped on orientation/wrap-up days (regex `orientation|wrap-up`).
- Batch `endDate` = date of the last scheduled session (fallback: `durationMonths` × 30 days).
- Trainer/facilitator on a batch is **optional**; admin actor id is used only for audit-ownership fields, never as Trainer.
- Feedback-form audience gates visibility and submission (`isRespondentFor`); admin + owning facilitator always see the form.
- Trainees may only see rosters of batches they're enrolled in; facilitators only their own batches (`assertBatchAccess`).
- Resubmission allowed only before the assignment deadline; late first submissions are allowed.

## 8. Decisions That Must Not Be Reversed

- Session/Calendar/Events merged per role; Discussions removed from Facilitator + Trainee.
- Feedback wording is `Session Feedback: …` (labeled once in `SessionFeedbackCell.tsx`).
- Training Plans nav item sits right after Batch Management in Admin (deliberate, though the original spec put role-specific pages last).
- Template edits never propagate to existing batches; batch edits never touch the template.
- Demo Mode degrades honestly (labeled sample files, "not connected" notices) — never fake success.
- Facilitator trainee-profile Back falls back to **Batches** (never the generic Trainees tab) when origin is unknown.

## 9. Conflicting / Unclear Requirements

- ~~Assignment-level feedback links~~ — **resolved** 2026-07-15 (user chose "add assignment-level forms" over "keep session-level only"). Assignments now have their own `AssignmentFeedbackForm`/`AssignmentFeedbackSubmission` models, backend routes (`/assignments/:id/feedback-form[...]`), and a `AssignmentFeedbackCell` UI on `AssignmentDetailPage` (manage) + the Trainee Assignments tab (submit). Fully independent of Session Feedback — an assignment can have both a related session's form and its own.
- Admin nav order deviation (Training Plans sits 3rd, not with role-specific pages at the end) — accepted, flagged in audit, not changed.

## 10. Tests / Builds Last Run (2026-07-17, all green)

Frontend & backend `tsc` exit 0 · both `eslint` exit 0 · frontend `vite build` OK · backend build OK · backend `vitest run` **27 files / 140 tests** (mocked Prisma, no DB needed for CI) · frontend `vitest run` **3 files / 29 tests** · Playwright e2e (Demo Mode) **8/8** · `prisma migrate deploy` **against a real local Postgres, all 10 migrations applied** · `GET /api/health` → `"database":"ok"`. CI (`.github/workflows/ci.yml`) runs the DB-free subset of this on push/PR (real-Postgres verification is manual, this session, see below).

**Manual real-backend verification this session** (Playwright driving the actual dev servers, not CI): fresh login as `admin@company.com` issues a real JWT + httpOnly signed refresh cookie; session survives a hard page reload; `/api/announcements` list/create/mark-read all round-trip correctly with real role/batch scoping (admin sees all 5 batches' announcements; a trainee enrolled in all 5 sees the same; `readByCount` genuinely increments in Postgres when a different user views them); real seeded batch/session/assignment data renders with honest `—` placeholders for not-yet-computed stats (avgScore, completion) rather than demo's curated fake numbers.

## 11. Git

Branch `main`; `origin` = github.com/kaashyap-reddy/TP. Commits since the audit: `5084bb7` (audit artifacts) → `3fd034c` (Training Plan/Session Feedback feature set) → `00349f8` (demo filename fix) → `b732822` (assignment-level feedback forms) → `ebcc4d1` (minor known-issue fixes) → `073b406` (repo hygiene) → `a2f9ff0` (ESLint) → `c5d271d` (frontend unit tests) → `c34d45f` (Playwright e2e) → `920cf49` (token-verified password reset) → `c5a1a04` (announcements API + notification wiring) → `88a06c2` (CI) → `a6a0eab` (CI fixes: Node 24, dummy backend env) — **pushed and CI green** as of 2026-07-17. Plus this session's uncommitted-as-of-writing work: pagination cap fix, announcements frontend wired to real API + Demo Mode parity, migration UTF-8 fix — commit these before ending the session if not already done.

## 12. Demo Accounts (fixtures) — also now real seeded backend accounts

Admin: Alex Morgan (admin@company.com) · Facilitators: Junaid Mohammed (facilitator@company.com, runs both main batches), Srikar Kulkarni, Dinesh Paraman, Kaashyap Reddy · Trainee: Priya Sharma (trainee@company.com, in BA BTech - July 2026 + 3 lightweight cohort batches so all 4 facilitators appear as contacts). Batches: `BA BTech - July 2026` (Jul 1–Aug 27 2026, Active), `BA MBA - August 2026`, + 3 lightweight cohorts.

**Real backend note**: `backend/prisma/seed.ts` creates the real-DB equivalent under the name "Admin User" not "Alex Morgan" (author name differs from the demo fixture; same email/password) and enrolls Priya in **all 5** real batches (confirmed via `SELECT` — not just the 1 + 3-lightweight split the demo fixtures use), so real per-trainee/announcement scoping tests should expect her to see all 5 batches' worth of data, not a subset.
