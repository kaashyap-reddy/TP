-- Generated offline via:
--   npx prisma migrate diff --from-schema-datamodel prisma/schema.old.prisma --to-schema-datamodel prisma/schema.prisma --script
-- (schema.old.prisma is a scratch copy of the pre-change schema, deleted after generating this
-- file — no live database was available to diff against directly.) Purely additive: no columns
-- are dropped or renamed, no existing rows are altered except the backfill INSERT below, so this
-- is safe to run against a database already on the `20260711110517_init` migration. Reviewed for
-- destructive SQL — there is none. Has NOT been applied to or proven against a real PostgreSQL
-- instance in this environment; verify with `prisma migrate deploy` (or `dev`, locally) against
-- a live database before treating it as production-ready.

-- CreateEnum
CREATE TYPE "FeedbackDirection" AS ENUM ('FacilitatorToTrainee', 'TraineeToFacilitator');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "end_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "attachment_mime_type" TEXT,
ADD COLUMN     "attachment_original_filename" TEXT,
ADD COLUMN     "attachment_size_bytes" INTEGER,
ADD COLUMN     "attachment_storage_key" TEXT;

-- AlterTable
ALTER TABLE "submission_attachments" ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "feedback_entries" ADD COLUMN     "direction" "FeedbackDirection" NOT NULL DEFAULT 'FacilitatorToTrainee';

-- CreateTable
CREATE TABLE "assignment_batches" (
    "assignment_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_batches_pkey" PRIMARY KEY ("assignment_id","batch_id")
);

-- CreateIndex
CREATE INDEX "assignment_batches_batch_id_idx" ON "assignment_batches"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_attachment_storage_key_key" ON "assignments"("attachment_storage_key");

-- CreateIndex
CREATE INDEX "submission_attachments_submission_id_is_current_idx" ON "submission_attachments"("submission_id", "is_current");

-- CreateIndex
CREATE INDEX "feedback_entries_facilitator_id_idx" ON "feedback_entries"("facilitator_id");

-- CreateIndex
CREATE INDEX "feedback_entries_direction_idx" ON "feedback_entries"("direction");

-- AddForeignKey
ALTER TABLE "assignment_batches" ADD CONSTRAINT "assignment_batches_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_batches" ADD CONSTRAINT "assignment_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing assignment's current primary batch (assignments.batch_id) becomes its
-- first join-table row, so the many-to-many read path returns the same batch a pre-migration
-- client already saw via the single `batchId` field. Idempotent (safe to re-run).
INSERT INTO "assignment_batches" ("assignment_id", "batch_id", "created_at")
SELECT "id", "batch_id", "created_at" FROM "assignments"
ON CONFLICT ("assignment_id", "batch_id") DO NOTHING;

