-- Fixes drift discovered when applying migrations against a real Postgres database for the first
-- time (this environment previously had no live database, so several earlier hand-authored
-- migrations were never actually verified). None of these change behavior -- they only bring the
-- database's constraint/index names in line with what schema.prisma has described all along:
--   * 20260716090000_session_feedback_submitter_rename only renamed the trainee_id COLUMN via
--     `ALTER TABLE ... RENAME COLUMN` -- Postgres does not rename dependent constraint/index names
--     when a column is renamed, so the FK/unique/index on session_feedback_submissions were still
--     named ..._trainee_id_... even though the column itself had already become submitter_id.
--   * assignments/sessions' facilitator_id foreign keys are recreated with the exact same
--     ON DELETE SET NULL ON UPDATE CASCADE behavior -- a no-op recreate that clears a diff-engine
--     false positive (harmless either way; included so future `prisma migrate diff` runs are clean).
--   * session_feedback_forms.name had a stray column default left over from an earlier draft of
--     that migration; dropped to match schema.prisma (name has no default, is always provided).

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_facilitator_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_facilitator_id_fkey";

-- AlterTable
ALTER TABLE "session_feedback_forms" ALTER COLUMN "name" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "session_feedback_submissions" RENAME CONSTRAINT "session_feedback_submissions_trainee_id_fkey" TO "session_feedback_submissions_submitter_id_fkey";

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "session_feedback_submissions_form_id_trainee_id_key" RENAME TO "session_feedback_submissions_form_id_submitter_id_key";

-- RenameIndex
ALTER INDEX "session_feedback_submissions_trainee_id_idx" RENAME TO "session_feedback_submissions_submitter_id_idx";
