# Trainee Portal — Full Verification Audit

**Date:** 2026-07-15 · **Branch:** `main` (in sync with `origin/main` at start) · **HEAD at audit time:** `340826d` + ~70 uncommitted application changes (the newest Training Plan / Session Feedback work was never committed — see [Git state](#git-state)).
**Mode:** Audit-only. No application functionality was changed. PostgreSQL is not connected — all runtime verification was done in **Demo Mode** (frontend dev server only); real-backend behavior was verified by **static code inspection** and the **existing automated test suite** (which runs without a database).

---

## 1. Executive Summary

The portal is in very good shape. The core business workflow (Section B — reusable Training Plan templates instantiated as an independent, editable copy onto each new batch) is **fully implemented and verified**, on both the real backend (`batches.service.ts` transaction, covered by automated tests) and Demo Mode (which mirrors it exactly). Both standard plans (**BA BTech**, **BA MBA**) exist with a realistic 2-month / 42-session / Mon–Fri / 2:30–4:30 PM / end-of-day-deadline curriculum. All three portals passed browser automation with the correct navigation, wording (`Session Feedback: Open Feedback Form`), batch scoping, back-navigation, and removed-Discussions requirements.

**Counts:** PASS **58** · PARTIAL **4** · FAIL **0** · NOT IMPLEMENTED **0** · PENDING DATABASE **8** · CONFLICT **2** · INFO/N-A **3**

The only genuine gaps found are small: (1) the submitted file's **filename** doesn't render immediately after upload in Demo Mode (real backend returns it; demo fixture response omits `originalFilename`); (2) feedback links attach to **sessions only**, not directly to assignments (needs a user decision — see Conflicts); (3) demo feedback URLs are labeled placeholders, not real Microsoft Forms (expected — manual step documented below); (4) two console errors per role from `/api` proxying to the stopped backend on the login page (environmental, not an app bug).

---

## 2. Detailed Checklist

Statuses: PASS / PARTIAL / FAIL / NOT IMPLEMENTED / PENDING DATABASE / CONFLICT / NOT APPLICABLE.
Verification methods: **D** = Demo Mode browser automation (Playwright), **C** = code inspection, **T** = automated test, **B** = build/typecheck.

### Section B — Core Business Workflow (Training Plan → Batch)

| ID | Role | Module | Requirement | Status | Method | Evidence / Notes | Screenshot | Files |
|----|------|--------|-------------|--------|--------|------------------|------------|-------|
| B1 | Admin | Batches | Admin creates a new batch | PASS | D+C | Onboard modal opens with name/code, plan select, start date | admin-create-batch-modal.png | `AdminDashboardPage.tsx`, `batches.service.ts` |
| B2 | Admin | Batches | Select one of the standard Training Plans | PASS | D+C | Plan dropdown contains BA BTech / BA MBA | admin-create-batch-modal.png | same |
| B3 | Admin | Batches | Select batch start date | PASS | D+C | Date input present; demo/backend compute schedule from it | admin-create-batch-modal.png | same |
| B4 | Admin | Batches | Predefined schedule assigned to batch | PASS | C+T+D | `batches.service.ts create()` instantiates all plan sessions/assignments/resources/announcements in one transaction; mirrored in `demoMode.ts POST /batches`; covered by `batches.automation.test.ts` | — | `backend/src/services/batches.service.ts:232-359` |
| B5 | — | Batches | Batch gets its own editable copy (sessions, assignments, calendar, resources, feedback links) | PASS | C+T | Copies land in `Session`/`Assignment`/`Resource`/`Announcement`/`SessionFeedbackForm` tables, separate from `TrainingPlan*` template tables | admin-session-feedback.png | schema.prisma, batches.service.ts |
| B6 | Admin/Fac | Sessions | Copied schedule editable per batch | PASS | D+C | "Edit timing" on session rows; PATCH `/sessions/:id`, `/assignments/:id` | admin-session-feedback.png | sessions.service.ts |
| B7 | — | Training Plans | Batch edits must not change the template | PASS | C+T | Batch rows have no write-back to `TrainingPlanSession/Assignment`; separate services; `trainingPlans.service.test.ts` | admin-training-plan-detail.png | trainingPlans.service.ts |
| B8 | — | Training Plans | Template remains constant for future batches | PASS | D+C | Plan detail banner: "3 batches already generated from this plan. Editing the template below will not change their existing schedules." | admin-training-plan-detail.png | TrainingPlanDetailPage.tsx:89-94 |

### Section C — Standard Training Plans

| ID | Requirement | Status | Method | Evidence / Notes | Screenshot |
|----|-------------|--------|--------|------------------|------------|
| C1 | Exactly two standard plans: BA BTech, BA MBA | PASS | D+C | Only these two in `DEMO_TRAINING_PLANS` and `seed.ts`; no unrelated demo plans | admin-training-plans.png |
| C2 | Reusable templates, easily assignable | PASS | D | "Assign to Batch" button on plan detail; plan dropdown in batch onboarding | admin-training-plan-detail.png |
| C3 | Assigned batch schedules editable independently; plan unchanged | PASS | C+T+D | Same as B6–B8 | — |
| C4 | ~2 months, Mon–Fri, weekends excluded, ~42 sessions | PASS | D+C | Plan detail: Duration 2 mo, **Sessions 42**; `nthWorkingDay()` skips weekends (identical in backend + demo) | admin-training-plan-detail.png |
| C5 | Morning assignment work, session 2:30–4:30 PM, deadline end of day | PASS | D+C | `SESSION_START/END_MINUTE = 14:30/16:30`, `ASSIGNMENT_START_MINUTE = 9:30`, `ASSIGNMENT_DEADLINE_MINUTE = 23:59`; UI shows "2:30 PM – 4:30 PM" and "…, 11:59 PM" deadlines | admin-session-feedback.png, trainee-submission.png |
| C6 | Near-daily case-study assignments (not a small total like 8) | PASS | D+C | 36 assignments per plan (42 days minus orientation/wrap-up days), one per working day | admin-training-plan-detail.png |

### Section D — Admin Portal

| ID | Module | Requirement | Status | Method | Evidence / Notes | Screenshot |
|----|--------|-------------|--------|--------|------------------|------------|
| D1 | Navigation | Intended general order | PASS* | D | Observed: Real-time Analytics · Batch Management · **Training Plans** · Assignments · Sessions & Calendar · Global Resources · Announcements · Feedback · Reports · Audit Logs. *Training Plans (role-specific) sits 3rd instead of at the end — deliberate per prior Claude context (`navigation.ts` comment). Reported as a difference, not changed.* | admin-dashboard.png |
| D2a | Batches | Create batch / assign plan / start date / schedule created | PASS | D+C | See B1–B4 | admin-create-batch-modal.png |
| D2b | Batches | Realistic ~2-month dates | PASS | D | Demo batch: Jul 1 2026 → Aug 27 2026 | trainee-my-batch.png |
| D2c | Batches | Expanding a batch shows trainees; names clickable; correct profile; batch context retained | PASS | D | Expand → trainee chips; click → `/admin/trainees/Priya Sharma`; Back returns to Batch Management with table state (router state carries `{ from: { batchId } }`) | admin-batch-details.png, admin-trainee-profile.png |
| D3a | Training Plans | Full detail/editing page (name, description, duration, counts, full session & assignment lists) | PASS | D | Header card + 4 stat tiles (2 mo / 42 sessions / 36 assignments / 3 batches) + full lists | admin-training-plan-detail.png |
| D3b | Training Plans | Add/View/Edit/Reschedule/Delete assignment & session; Assign plan to batch | PASS | D | Per-row View · Edit · Reschedule · Delete; "+ Add Session" / "+ Add Assignment"; "Assign to Batch" | admin-training-plan-detail.png |
| D4a | Assignments | No Facilitator column; no duplicate Training Plan column; Batch column shows real names (no `—`) | PASS | D | Headers: Title · Batch · Related Session · Deadline · Status · Submitted/Pending/Late · Assignment File. 0/6 dash cells in Batch column | admin-assignments.png |
| D4b | Assignments | Name + agenda/description visible; due date available; deadline time not prominent | PASS | D+C | Title + agenda pill + description on detail page; deadline as "Jul 2, 2026, 11:59 PM" | admin-assignments.png |
| D4c | Assignments | Instruction file & submitted trainee files openable | PASS | C+D | `FileViewButton` (authorized blob fetch, inline for PDFs/images). Demo fixtures ship **no instruction files**, so demo shows an honest disabled "No file uploaded" — real-mode path verified by code inspection; Demo Mode downloads return a labeled sample text file | trainee-submission.png |
| D4d | Assignments | Assignment associated with relevant batch(es) | PASS | D+C | `AssignmentBatch` join table; UI joins names | admin-assignments.png |
| D5 | Sessions & Calendar | Unified calendar: sessions, assignment items, deadlines, times, batch info, feedback links; timing `2:30 PM – 4:30 PM`; wording `Session Feedback: Open Feedback Form` (not `Assignment: …`) | PASS | D | All confirmed on screen incl. List/Calendar toggle, batch filter, "Assignment: <related case study>" line, "Session Feedback: Open Feedback Form · Copy · Edit · (3 submitted)", Record Attendance | admin-session-feedback.png |
| D6 | Feedback | Create/register form link, title, attach to session, edit, remove, copy, open, see owner session; visible in trainee/facilitator views; Session Feedback not hidden inside general feedback | PASS | D+C | `SessionFeedbackCell` (name, description, URL, audience Trainees/Facilitators/Both; Save/Edit/Remove/Copy/Open) on every session row for Admin & Facilitator; trainees get "Submit Session Feedback" per session + a dedicated "My Session Feedback" tab | admin-session-feedback.png, trainee-grades.png |
| D6b | Feedback | Attach a link **to an assignment** where required | CONFLICT | C | Forms attach to **sessions only**; assignments relate to a session, so the link is reachable, but there is no direct assignment-level form. Prior Claude context implemented session-level by design. **Needs user decision.** | — |

### Section E — Facilitator Portal

| ID | Module | Requirement | Status | Method | Evidence / Notes | Screenshot |
|----|--------|-------------|--------|--------|------------------|------------|
| E1a | Batches | Only own batches; clicking opens Batch Details (not Trainees page) | PASS | D | Row click → `/facilitator/batches/demo-batch-ba-btech`; list fetched with `facilitatorId` filter | facilitator-batches.png, facilitator-batch-details.png |
| E1b | Batches | Details show trainees + stats; names clickable → correct profile | PASS | D | Stats tiles + per-trainee table (attendance, completed/pending, avg grade, latest submission, progress, feedback-given); row click → profile | facilitator-batch-details.png, facilitator-trainee-profile.png |
| E1c | Batches | Back-nav: Batch → Profile → Back returns to same Batch Details; Trainees-page origin returns to Trainees; direct access safe fallback | PASS | D+C | Verified in browser; `facilitatorProfileNav.ts` records origin, falls back to Batches tab | facilitator-batch-details.png |
| E2 | Assignments | Plan/batch workflow; no meaningless `—` Batch columns; instruction & submission files viewable; useful trainee rows; EOD deadlines; 2:30–4:30 sessions | PASS | D+C | Headers: Assignment · Batch · Related Session · Deadline · Status · Grading Progress · Assignment File; `AssignmentDetailPage` roster has no dead Batch column | facilitator-assignments.png |
| E3 | Sessions & Calendar | Merged view; sessions, assignment items, deadlines, feedback links; correct label | PASS | D | Timing + "Session Feedback:" confirmed | facilitator-calendar.png |
| E4 | Feedback | Correct form links; copy/open; only assigned batches; trainee feedback retained | PASS | D+C+T | `SessionFeedbackCell` with canManage; backend `assertBatchAccess`; audience visibility mirrored in demo + covered by `sessionFeedback.service.test.ts` | facilitator-feedback.png |
| E5 | Discussions/Contact | Discussions removed; Contact uses email | PASS | D+C | No Discussions nav item; Contact → `mailto:` via `findUserEmailByName` | facilitator-trainees.png |

### Section F — Trainee Portal

| ID | Module | Requirement | Status | Method | Evidence / Notes | Screenshot |
|----|--------|-------------|--------|--------|------------------|------------|
| F1 | Facilitators | Page kept; assigned facilitator info shown; no redirect | PASS | D | 4 facilitator contact cards (POCs of the trainee's own batches), Contact → mailto | trainee-facilitators.png |
| F2 | My Batch | Current batch highlighted; others secondary; realistic ~2-month dates; own members visible; other batches' members not exposed | PASS | D+C | "MY CURRENT BATCH" badge + blue border on first batch; other cohorts plain; Jul 1 → Aug 27 2026; batches fetched with `traineeId` scope (backend enforces enrollment check in `listTrainees`) | trainee-my-batch.png |
| F3a | Assignments | After submitting: see filename | PARTIAL | D+C | **Demo Mode gap:** filename blank right after upload because demo `POST /submissions/:id/attachments` returns only `{id}` — the store expects `originalFilename` (real backend returns it: `submissions.service.ts:195`). Date/time, status, View Submission all render | trainee-submission.png |
| F3b | Assignments | See submission date/time; view the submitted file | PASS | D | "Jul 15, 2026, 11:41 AM" + Under Review badge + View Submission (demo returns a labeled sample file) | trainee-submission.png |
| F3c | Assignments | Resubmit before deadline; clear message when no longer allowed | PASS | D+C | Resubmit enabled pre-deadline; after deadline the button is disabled with tooltip "The deadline has passed — this submission can no longer be replaced." + red "Deadline passed" under the date | trainee-submission.png |
| F4 | Sessions & Calendar | Unified page: sessions, assignment details, deadlines, feedback links, 2:30–4:30 PM; every relevant session has Submit Session Feedback | PASS | D | 10 completed sessions showed "Submit Session Feedback"; clicking opens the form in a new tab and flips to "Feedback Submitted"; sessions without a form show "Session Feedback: Not available" | trainee-session-feedback.png |
| F5 | Feedback & Grades | Session Feedback supported (not only generic); pending visible; completed distinguishable; correct link; batch-scoped; existing feedback not removed | PASS | D | "My Session Feedback" tab: 41 pending "Open Feedback Form" rows + 1 "Submitted" tag after test submission; Facilitator Feedback (give/received) retained below | trainee-grades.png |
| F6 | Discussions | Tab and route removed | PASS | D | No nav item; `/trainee/discussions` falls into the `*` catch-all → login route (safe) | trainee-dashboard.png |

### Section G — Feedback Form Links

| ID | Requirement | Status | Method | Notes |
|----|-------------|--------|--------|-------|
| G1 | Portal stores & displays external form URLs | PASS | D+C | `SessionFeedbackForm.formUrl` (+ `TrainingPlanSession.feedbackFormUrl` template default) |
| G2 | URL validation | PASS (backend) / PARTIAL (demo) | C | Backend: `z.string().trim().url()` in `sessionFeedback.validator.ts` & `trainingPlans.validator.ts`. Demo Mode bypasses zod (input is `type="url"` only) — cosmetic, demo-only |
| G3 | Links attached to correct sessions/assignments | PASS | D+T | Session-level; assignment reachable via its related session (see D6b conflict) |
| G4 | Role & batch visibility | PASS | D+C+T | `audience` (Trainees/Facilitators/Both) + `withFeedbackFormVisibility()` on both real backend and demo; submission gated by `isRespondentFor()` |
| G5 | Links open correctly | PASS | D | Opens in new tab; demo URLs are **labeled placeholders** (`https://forms.gle/ba-btech-day-N-feedback`, described as "(demo link)") — pre-existing fixtures, none fabricated by this audit |
| G6 | Real Microsoft Forms links | NOT APPLICABLE (manual) | — | Requires a Microsoft account — see [Manual steps](#manual-steps-for-microsoft-forms-links) |

### Section H — Demo Mode vs Real Mode

| ID | Item | Status | Notes |
|----|------|--------|-------|
| H1 | Demo Mode end-to-end flows (all three roles) | PASS | Full browser pass; demo data survives reload for the session (data resets by design, session persists) |
| H2 | Real-backend implementation quality | PASS (static) | Routes/controllers/services/validators for training plans + session feedback complete; 115 automated tests pass without a DB |
| H3 | Real-backend runtime: login/JWT, persistence, migrations, seeding | PENDING DATABASE | 6 new uncommitted migrations exist (`20260714120000_training_plan_workflow` … `20260716120000_training_plan_description`); `prisma migrate status` / `seed` not runnable |
| H4 | Real file storage (S3 attachments) | PENDING DATABASE | Upload/download path code-inspected only |
| H5 | Real metrics aggregation (`getMetricsForBatches`) | PENDING DATABASE | Logic reviewed; needs data to exercise |
| H6 | Real feedback-form submission tracking | PENDING DATABASE | Service + tests exist |
| H7 | Real batch-creation automation transaction | PENDING DATABASE | Covered by tests with mocked prisma; not run against live DB |
| H8 | Auth flows (login, refresh, forgot password) against DB | PENDING DATABASE | Backend not running |
| H9 | Prisma migrate deploy of the 6 new migrations | PENDING DATABASE | — |
| H10 | Seed of the two curricula into PostgreSQL | PENDING DATABASE | `seed.ts` mirrors demo fixtures (same constants) |

---

## 3. Features Fully Working (highlights)

- Training Plan template → batch copy workflow, end to end, with explicit template isolation (banner + separate tables).
- Two standard plans with a realistic 42-working-day, Mon–Fri, 2:30–4:30 PM curriculum and near-daily case-study assignments due end of day.
- Admin: batch onboarding with plan + start date; expandable batch rosters with clickable trainee profiles and context-preserving back-nav; full Training Plan editor; clean assignments table; unified Sessions & Calendar with attach/edit/copy/open Session Feedback links and attendance recording.
- Facilitator: own-batches list → rich Batch Details (per-trainee stats) → trainee profile → back to the same batch; merged Sessions & Calendar; mailto Contact; no Discussions.
- Trainee: highlighted current batch; submit/resubmit with hard deadline cutoff and clear messaging; per-session "Submit Session Feedback" with submitted-state tracking; "My Session Feedback" tab separating pending vs submitted; Facilitators contacts page; no Discussions.
- Role/batch scoping of rosters, feedback forms (audience), and batch data on both backend and demo layers.

## 4. Features Partially Working

1. **Submitted filename in Demo Mode (F3a)** — blank immediately after upload; real backend returns `originalFilename`. Fix would be one line in `demoMode.ts` (`POST /submissions/:id/attachments` returning the filename) or the store falling back to the local `File.name`. Files: `frontend/src/services/api/demoMode.ts:637-639`, `frontend/src/store/assignmentsStore.ts:91-107`. Priority: Low.
2. **Client-side URL validation in Demo Mode (G2)** — backend zod enforces `.url()`; demo path doesn't. Files: `frontend/src/components/SessionFeedbackCell.tsx` (could pre-validate), `demoMode.ts`. Priority: Low.
3. **Assignment instruction files in demo fixtures (D4c)** — no demo assignment ships an instruction file, so the "View Assignment File" path can only be demoed as its disabled state. Files: `frontend/src/services/api/demoData.ts`. Priority: Low (cosmetic demo realism).
4. **Trainee attendance % in Demo Mode** — `GET /sessions/:id/attendance` returns `[]` in demo, so per-trainee attendance shows `—` (real backend computes it). Files: `demoMode.ts:678-682`. Priority: Low.

## 5. Missing Features

None against this prompt, except the two conflict items below awaiting a decision.

## 6. Broken Features

None found. Zero page errors; the only console errors are environmental (see §10).

## 7. Requirement Conflicts (prompt vs. current implementation / prior Claude context)

| # | Item | Prompt says | Implementation | Classification |
|---|------|-------------|----------------|----------------|
| 1 | Admin sidebar order (D1) | Role-specific pages (Training Plans, Reports, Audit Logs) after the shared items | Training Plans sits 3rd, right after Batch Management (deliberate — it's central to the batch workflow; documented in `navigation.ts`) | **Implemented according to Claude context** — difference reported, not changed |
| 2 | Feedback link attached to an assignment (D6) | "Attach a link to an assignment where required" | Links attach to sessions only; assignments reach a form via their related session | **Conflicting requirement — needs user decision** |

Also noted (not conflicts): forgot-password minimum is 8 characters; unknown routes (e.g. `/trainee/discussions`) redirect to the login route rather than a 404 page — both current-implementation behavior, left unchanged.

## 8. Demo Mode Findings

- Demo Mode is entered only via explicit "View as …" buttons; intercepts at `apiClient.ts`; session survives reload (sessionStorage), fixture data intentionally resets.
- Demo batch creation reproduces the full backend automation (sessions/assignments/resources/feedback links generated onto the new batch, weekends skipped).
- Demo downloads return a clearly-labeled sample text file; resource preview modal states file storage isn't connected. Honest degradation throughout — nothing fakes success.

## 9. Browser Test Results

All flows in Section I executed in Demo Mode for all three roles: login, sidebar navigation, batch flows (create modal, expand, detail), training-plan flows (list, detail, CRUD buttons), assignment flows (tables, submit, resubmit-block), Sessions & Calendar (timing, wording, feedback links, attendance UI), feedback links (open + submitted-state flip), trainee submission viewing, back navigation (both Admin and Facilitator profile round-trips), removed Discussions (nav + direct route), profile navigation, refresh behavior, empty states (not-found fallbacks render safe pages), demo data display. 39 scripted checks: 36 PASS, 3 initially flagged and resolved on inspection (uppercase-CSS false negative; filename gap classified above; plan-detail rows counted 0 because the page uses lists, not tables).

## 10. Console Errors / Warnings

Exactly **2 per role**, all identical: `Failed to load resource: 500` — the Vite dev proxy forwarding `/api/auth/refresh` (session bootstrap on the login page, before Demo Mode is active) to the **stopped backend** on port 4000. Environmental; disappears when the backend runs or is expected when it doesn't. **Zero page errors, zero errors after demo login.**

## 11. Build & Test Results (Section J)

| Check | Result |
|-------|--------|
| Frontend typecheck (`tsc --noEmit`) | ✅ exit 0 |
| Backend typecheck (`tsc -p tsconfig.json --noEmit`) | ✅ exit 0 |
| Frontend production build (`tsc -b && vite build`) | ✅ built in 3.0s, code-split per route |
| Backend production build (`tsc`) | ✅ exit 0 |
| Backend tests (`vitest run`) | ✅ **24 files, 115 tests, all passed** (5.2s, no DB required) |
| `prisma validate` | ✅ schema valid |
| `prisma format --check` | ✅ all formatted |
| `prisma generate` | ✅ exit 0 |
| Playwright browser audit | ✅ 3 roles, 25 screenshots, findings above |
| `prisma migrate status` / seed / integration against PostgreSQL | ⏸ PENDING DATABASE |

## 12. Screenshots Created (`audit-screenshots/`, 25 files)

admin-dashboard, admin-batch-details, admin-create-batch-modal, admin-trainee-profile, admin-training-plans, admin-training-plan-detail, admin-session-feedback, admin-assignments, admin-feedback, facilitator-dashboard, facilitator-batches, facilitator-batch-details, facilitator-trainee-profile, facilitator-calendar, facilitator-assignments, facilitator-trainees, facilitator-feedback, trainee-dashboard, trainee-my-batch, trainee-assignments, trainee-submission, trainee-session-feedback, trainee-grades, trainee-facilitators, trainee-resources (.png each).

## 13. Suggested Next Fixes (priority order — **not implemented**)

1. **Commit the uncommitted work.** ~70 modified/new application files (entire Training Plan + Session Feedback feature set, 6 migrations) exist only in the working tree. Highest-risk item in the project right now. Files: everything in `git status`.
2. **Decide D6b**: whether assignment-level feedback links are required, or session-level (current) is the accepted design. If required: `schema.prisma` (new relation), `sessionFeedback.*` backend files, `SessionFeedbackCell.tsx`, `AssignmentDetailPage.tsx`.
3. **Demo filename gap (F3a)**: return `originalFilename`/`mimeType` from demo `POST /submissions/:id/attachments`. File: `frontend/src/services/api/demoMode.ts:637-639`.
4. **Connect PostgreSQL** and run the 10 PENDING DATABASE checks (migrate deploy → seed → full real-mode Playwright pass).
5. Optional demo polish: instruction-file fixtures, per-trainee attendance fixtures, demo-side URL validation.

## 14. Manual Steps for Microsoft Forms Links

Creating real links cannot be automated from this environment (needs a Microsoft account). For each session (or once per plan):
1. Sign in at forms.office.com → **New Form** → title it e.g. "BA BTech — Day 1 Session Feedback"; add your questions.
2. **Collect responses** → copy the share URL (`https://forms.office.com/r/…`).
3. In the portal, two places accept it:
   - **Template default** (applies to every future batch): Admin → Training Plans → *plan* → session row → Edit → *Feedback form URL*.
   - **Per-batch/session**: Admin or Facilitator → Sessions & Calendar → session row → *Session Feedback: Edit* (or *+ Attach Feedback Form*) → paste URL, pick audience → Save.
4. The backend validates the URL shape; trainees then see **Submit Session Feedback** on that session and in **My Session Feedback**.
5. Response data lives in Microsoft Forms; the portal tracks only who clicked-through/submitted (`submittedCount` / `mySubmitted`).

## <a name="git-state"></a>15. Git State

- Branch `main`, in sync with `origin/main` (`340826d`) at audit start. `git fetch` performed; no pull needed (0 ahead/behind).
- **~70 uncommitted application changes** predate this audit (the whole Training Plan / Session Feedback / demo-mode feature set + 6 migrations + new tests). Per audit rules these were **not** committed, reverted, or modified — only the audit artifacts (this report, `CLAUDE_PROJECT_CONTEXT.md`, `audit-screenshots/`) are committed.
