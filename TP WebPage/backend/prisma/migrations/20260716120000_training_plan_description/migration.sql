-- Hand-authored (no live database available in this environment). Purely additive: adds a
-- free-text "description" column to TrainingPlan so the Admin Training Plan Details page has
-- somewhere to show/edit a longer description alongside the existing name.
-- Verify with `prisma migrate dev` locally against a live database before treating it as
-- production-ready.

-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
