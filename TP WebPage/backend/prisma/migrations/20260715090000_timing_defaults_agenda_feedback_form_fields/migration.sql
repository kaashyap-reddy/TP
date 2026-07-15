-- Hand-authored (no live database available in this environment). Purely additive:
--   * TrainingPlan gets reusable schedule-default columns (minutes from midnight) so the batch
--     automation and the Admin editing UI both read timings from one place instead of each
--     hardcoding the org's standard schedule (session 14:30-16:30, assignment due end-of-day)
--     separately. Existing plans backfill to those same standard defaults.
--   * TrainingPlanSession/Session gain an "agenda" column (what the session covers), mirroring
--     the existing Assignment.agenda pattern.
--   * SessionFeedbackForm gains name/description/audience so a feedback-form entry is a real,
--     named, describable record instead of just a bare URL.
-- Verify with `prisma migrate dev` locally against a live database before treating it as
-- production-ready.

-- CreateEnum
CREATE TYPE "SessionFeedbackAudience" AS ENUM ('Trainees', 'Facilitators', 'Both');

-- AlterTable
ALTER TABLE "training_plans"
  ADD COLUMN "default_session_start_minute" INTEGER NOT NULL DEFAULT 870,
  ADD COLUMN "default_session_end_minute" INTEGER NOT NULL DEFAULT 990,
  ADD COLUMN "default_assignment_start_minute" INTEGER NOT NULL DEFAULT 570,
  ADD COLUMN "default_assignment_deadline_minute" INTEGER NOT NULL DEFAULT 1439;

-- AlterTable
ALTER TABLE "training_plan_sessions" ADD COLUMN "agenda" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "agenda" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "session_feedback_forms"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "audience" "SessionFeedbackAudience" NOT NULL DEFAULT 'Both';
