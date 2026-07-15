-- Assignment Feedback: external form links attached directly to an Assignment, mirroring the
-- session_feedback_forms / session_feedback_submissions pair. Reuses the existing
-- "SessionFeedbackAudience" enum for identical visibility semantics.

-- CreateTable
CREATE TABLE "assignment_feedback_forms" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "form_url" TEXT NOT NULL,
    "audience" "SessionFeedbackAudience" NOT NULL DEFAULT 'Both',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_feedback_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_feedback_submissions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "submitter_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_feedback_forms_assignment_id_key" ON "assignment_feedback_forms"("assignment_id");

-- CreateIndex
CREATE INDEX "assignment_feedback_submissions_submitter_id_idx" ON "assignment_feedback_submissions"("submitter_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_feedback_submissions_form_id_submitter_id_key" ON "assignment_feedback_submissions"("form_id", "submitter_id");

-- AddForeignKey
ALTER TABLE "assignment_feedback_forms" ADD CONSTRAINT "assignment_feedback_forms_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_feedback_forms" ADD CONSTRAINT "assignment_feedback_forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_feedback_submissions" ADD CONSTRAINT "assignment_feedback_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "assignment_feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_feedback_submissions" ADD CONSTRAINT "assignment_feedback_submissions_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
