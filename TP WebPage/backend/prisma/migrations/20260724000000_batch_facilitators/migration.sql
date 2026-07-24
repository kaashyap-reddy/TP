-- Multi-facilitator batch teams with exactly one primary coordinator. batches.facilitator_id
-- stays as a denormalized cache of whichever row below currently has is_primary_coordinator =
-- true, kept in sync by services/facilitatorAssignments.service.ts.

-- CreateEnum
CREATE TYPE "FacilitatorRole" AS ENUM ('Primary Coordinator', 'Lead Facilitator', 'Trainer', 'Guest Trainer', 'Assignment Reviewer', 'Backup Facilitator');

-- CreateEnum
CREATE TYPE "FacilitatorAssignmentStatus" AS ENUM ('Active', 'Upcoming', 'Temporarily Unavailable', 'Completed', 'Removed');

-- CreateTable
CREATE TABLE "batch_facilitators" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "facilitator_id" TEXT NOT NULL,
    "role" "FacilitatorRole" NOT NULL,
    "is_primary_coordinator" BOOLEAN NOT NULL DEFAULT false,
    "status" "FacilitatorAssignmentStatus" NOT NULL DEFAULT 'Active',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "batch_facilitators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_facilitators_batch_id_idx" ON "batch_facilitators"("batch_id");

-- CreateIndex
CREATE INDEX "batch_facilitators_facilitator_id_idx" ON "batch_facilitators"("facilitator_id");

-- Partial-uniqueness backstop: at most one non-removed row per (batch, facilitator) pair. A
-- removed-then-rejoined facilitator gets a fresh row instead of reusing history, so this can't be
-- a plain composite unique constraint -- the application layer (create()) enforces the same rule
-- as its primary defense; this is a DB-level backstop against races/bugs.
CREATE UNIQUE INDEX "batch_facilitators_active_unique" ON "batch_facilitators"("batch_id", "facilitator_id") WHERE "status" <> 'Removed';

-- AddForeignKey
ALTER TABLE "batch_facilitators" ADD CONSTRAINT "batch_facilitators_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_facilitators" ADD CONSTRAINT "batch_facilitators_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_facilitators" ADD CONSTRAINT "batch_facilitators_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
