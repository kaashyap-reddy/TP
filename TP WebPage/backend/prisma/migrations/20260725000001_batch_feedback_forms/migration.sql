-- Batch/program-level feedback forms (Mid-Program, Final Program Feedback, etc.) -- a
-- one-to-many counterpart to the existing SessionFeedbackForm/AssignmentFeedbackForm (one form
-- per session/assignment) since a single batch can have several forms attached at once. This
-- gives a real backend to the frontend's already-shipped, previously Demo-Mode-only
-- BatchFeedbackDrawer.tsx / batchFeedbackService.ts.

-- CreateEnum
CREATE TYPE "FeedbackFormBroadAudience" AS ENUM ('Trainees', 'Facilitators', 'PrimaryCoordinators', 'Admins', 'MultipleRoles');

-- CreateEnum
CREATE TYPE "BatchFeedbackFormType" AS ENUM ('BatchFeedback', 'MidProgramFeedback', 'FinalProgramFeedback', 'CustomFeedback');

-- CreateEnum
CREATE TYPE "FeedbackFormStatus" AS ENUM ('Draft', 'Scheduled', 'Active', 'Closed', 'Archived', 'InvalidLink');

-- CreateTable
CREATE TABLE "batch_feedback_forms" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "form_url" TEXT NOT NULL,
    "form_type" "BatchFeedbackFormType" NOT NULL DEFAULT 'BatchFeedback',
    "audience" "FeedbackFormBroadAudience" NOT NULL DEFAULT 'Trainees',
    "status" "FeedbackFormStatus" NOT NULL DEFAULT 'Draft',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "open_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_feedback_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_feedback_submissions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "submitter_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_feedback_forms_batch_id_idx" ON "batch_feedback_forms"("batch_id");

-- CreateIndex
CREATE INDEX "batch_feedback_submissions_submitter_id_idx" ON "batch_feedback_submissions"("submitter_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_feedback_submissions_form_id_submitter_id_key" ON "batch_feedback_submissions"("form_id", "submitter_id");

-- AddForeignKey
ALTER TABLE "batch_feedback_forms" ADD CONSTRAINT "batch_feedback_forms_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_feedback_forms" ADD CONSTRAINT "batch_feedback_forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_feedback_submissions" ADD CONSTRAINT "batch_feedback_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "batch_feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_feedback_submissions" ADD CONSTRAINT "batch_feedback_submissions_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
