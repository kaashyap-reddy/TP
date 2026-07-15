# CLAUDE_PROJECT_CONTEXT — Trainee Portal

Compact, durable context for future Claude CLI sessions. Read this instead of rescanning the repo. Last updated: **2026-07-15** (full verification audit — see `AUDIT_REPORT.md`).

## 1. Purpose

Internal Trainee Management Portal. Core workflow: an Admin onboards a new batch by entering a name, picking one of **two standard Training Plans (BA BTech, BA MBA)** and a start date — the plan's full ~2-month schedule (42 Mon–Fri sessions 2:30–4:30 PM, ~36 daily case-study assignments due 11:59 PM, resources, announcements, session-feedback links) is instantiated automatically as that batch's **own editable copy**; the template is never mutated by batch edits.

## 2. Stack & Layout

- `frontend/` — React 18 + TS + Vite + Tailwind + Zustand + react-router v6. Route-level lazy loading. Dev server :5173, proxies `/api` → :4000.
- `backend/` — Express + TS + Prisma (PostgreSQL) + zod validators + vitest (tests run **without** a DB). Dev :4000.
- **Demo Mode**: `frontend/src/services/api/demoMode.ts` intercepts every API call at `apiClient.ts` when entered via the login page's "View as Admin/Facilitator/Trainee" buttons. Fixtures in `demoData.ts` mirror `backend/prisma/seed.ts` exactly (same curriculum constants). Demo session survives reload (sessionStorage); fixture data resets on reload by design.
- Git repo root is the **parent** folder (`Trainee Portal/`); app lives in `TP WebPage/`.

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
- Assignments tables: Title · Batch (real names, no `—`) · Related Session · Deadline · Status · progress · Assignment File. No Facilitator or Training Plan columns.
- Facilitator: own-batches only → `FacilitatorBatchDetailPage` (per-trainee stats) → trainee profile → Back returns to same batch (origin tracked in `facilitatorProfileNav.ts`, safe fallback = Batches tab).
- Trainee: "MY CURRENT BATCH" highlight (first/earliest enrollment); submit/resubmit with hard post-deadline block + tooltip message; per-completed-session "Submit Session Feedback" (opens URL, records submission, flips to "Feedback Submitted"); "My Session Feedback" tab (pending vs Submitted); Facilitators contacts page.
- Scoping/security: batch rosters, feedback forms (audience + `withFeedbackFormVisibility`), and metrics are role/batch-scoped on both backend and demo layers.
- Cross-cutting polish (earlier passes): NotificationPanel, GlobalSearch (Ctrl+K, Admin), EmptyState/StatusBadge everywhere, SavingButton, useEscapeKey on all modals, aria-labels, profile dropdown + account settings on all three portals, route lazy-loading.

## 5. Pending / Not Yet Done

- **PostgreSQL not connected** → pending: migrate deploy of 6 new migrations, seed, real login/JWT, S3 file storage, real-mode Playwright pass, live metrics. (Do not install PostgreSQL/Docker or request admin rights without being asked.)
- Real Microsoft Forms links: manual step (create in forms.office.com, paste into Training Plan session `feedbackFormUrl` or per-session `Session Feedback: Edit`). Demo URLs are labeled placeholders (`forms.gle/...-day-N-feedback`).
- **Uncommitted work**: as of 2026-07-15, ~70 modified/new application files (entire Training Plan + Session Feedback feature set, 6 prisma migrations, new tests) sit uncommitted on `main` (last commit `340826d`). Committing them is the top recommended action.

## 6. Known Issues (all minor, none fixed during audit)

1. Demo Mode: submitted filename blank right after upload (demo `POST /submissions/:id/attachments` returns only `{id}`; real backend returns `originalFilename`). `demoMode.ts:~637`.
2. Demo Mode: no zod URL validation (backend has `z.string().url()`); no per-trainee attendance fixtures (shows `—`); no assignment instruction-file fixtures (button shows honest "No file uploaded").
3. Two console 500s per role on the login page when backend is down (`/api/auth/refresh` via Vite proxy) — environmental.
4. Unknown routes (e.g. `/trainee/discussions`) redirect to login route via `*` catch-all rather than a 404 page.

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

## 9. Conflicting / Unclear Requirements (need user decision)

- **Assignment-level feedback links**: audit prompt asked to "attach a link to an assignment where required"; implementation attaches forms to sessions only (assignments reach a form via their related session). Undecided.
- Admin nav order deviation (above) — accepted so far, flagged in audit.

## 10. Tests / Builds Last Run (2026-07-15, all green)

Frontend & backend `tsc` exit 0 · frontend `vite build` OK · backend build OK · `vitest run` **24 files / 115 tests passed** (no DB needed) · `prisma validate` + `format --check` + `generate` OK · Playwright demo-mode audit of all 3 roles (25 screenshots in `audit-screenshots/`).

## 11. Git

Branch `main`; `origin` = github.com/kaashyap-reddy/TP. Last commit before audit artifacts: `340826d` "Integrate real backend, replace mock services, and polish batch/assignment flows". Application changes remain uncommitted (see §5).

## 12. Demo Accounts (fixtures)

Admin: Alex Morgan (admin@company.com) · Facilitators: Junaid Mohammed (facilitator@company.com, runs both main batches), Srikar Kulkarni, Dinesh Paraman, Kaashyap Reddy · Trainee: Priya Sharma (trainee@company.com, in BA BTech - July 2026 + 3 lightweight cohort batches so all 4 facilitators appear as contacts). Batches: `BA BTech - July 2026` (Jul 1–Aug 27 2026, Active), `BA MBA - August 2026`, + 3 lightweight cohorts.
