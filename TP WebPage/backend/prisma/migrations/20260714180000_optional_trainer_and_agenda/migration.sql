-- Hand-authored (no live database available in this environment) — incremental on top of
-- 20260714120000_training_plan_workflow. Aligns the schema with the org's real workflow:
--   * Trainer is optional at the Session/Assignment level (batches already allowed a null
--     facilitator; sessions/assignments generated from a Training Plan template have no
--     specific trainer pre-assigned, only the batch's overall facilitator if one is set).
--   * Assignments (template and instance) gain an "agenda" field — what the assignment is
--     meant to achieve (e.g. "Requirement Gathering", "SQL Basics") — shown in Assignment
--     Details alongside the description.
--   * Resources can now be URL-based (external link, e.g. copied from a Training Plan
--     template) instead of only ever an uploaded file — storage_key/mime_type/size_bytes
--     become optional and a new external_url column is added; the application layer enforces
--     "exactly one of storageKey or externalUrl is set", not a DB constraint.
-- Purely additive/relaxing: no data is dropped, no column is removed. Existing rows with a
-- NOT NULL facilitator_id remain valid after the constraint is relaxed. Verify with
-- `prisma migrate dev` locally against a live database before treating it as production-ready.

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "facilitator_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "assignments"
  ALTER COLUMN "facilitator_id" DROP NOT NULL,
  ADD COLUMN "agenda" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "training_plan_assignments" ADD COLUMN "agenda" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "resources"
  ALTER COLUMN "storage_key" DROP NOT NULL,
  ALTER COLUMN "mime_type" DROP NOT NULL,
  ALTER COLUMN "size_bytes" DROP NOT NULL,
  ADD COLUMN "external_url" TEXT;
