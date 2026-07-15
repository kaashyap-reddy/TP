-- Hand-authored (no live database available in this environment). Purely additive.
--   * Session gains "duration_minutes" so the UI can display a real end time (e.g. the org's
--     standard 2:30-4:30 PM instructor-led block is 120 minutes) instead of fabricating a fixed
--     60-minute range on every calendar row. Existing rows backfill to 120 (the standard block).
-- Verify with `prisma migrate dev` locally against a live database before treating it as
-- production-ready.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "duration_minutes" INTEGER NOT NULL DEFAULT 120;
