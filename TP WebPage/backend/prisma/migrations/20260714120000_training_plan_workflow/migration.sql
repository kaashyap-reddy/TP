-- Generated offline via:
--   npx prisma migrate diff --from-schema-datamodel prisma/schema.old.prisma --to-schema-datamodel prisma/schema.prisma --script
-- (schema.old.prisma is a scratch copy of the pre-change schema, deleted after generating this
-- file — no live database was available to diff against directly.) Adds the Training Plan module
-- (training_plans / training_plan_sessions / training_plan_assignments / training_plan_resources /
-- training_plan_announcements), Session Feedback tables (session_feedback_forms /
-- session_feedback_submissions), and nullable template-link FKs on assignments/sessions/resources/
-- announcements. Only "batches.training_plan_id" is added NOT NULL with no default — this is safe
-- because no batch rows exist yet in any environment this schema has been deployed to (see the
-- prior migration's note; this whole history has not been applied to a live database yet). If you
-- ARE running this against a database that already has batch rows, add a nullable column, backfill
-- every row's training_plan_id (e.g. to the 'ba-btech' plan's id), then add the NOT NULL
-- constraint, before running this file as-is. Reviewed for destructive SQL — there is none. Has
-- NOT been applied to or proven against a real PostgreSQL instance in this environment; verify
-- with `prisma migrate dev` locally against a live database before treating it as production-ready.

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "training_plan_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "training_plan_assignment_id" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "training_plan_session_id" TEXT;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "training_plan_resource_id" TEXT;

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "training_plan_announcement_id" TEXT;

-- CreateTable
CREATE TABLE "training_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration_months" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_sessions" (
    "id" TEXT NOT NULL,
    "training_plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "day_offset" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "platform" "SessionPlatform" NOT NULL DEFAULT 'Other',
    "order" INTEGER NOT NULL,
    "feedback_form_url" TEXT,

    CONSTRAINT "training_plan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_assignments" (
    "id" TEXT NOT NULL,
    "training_plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "due_day_offset" INTEGER NOT NULL,
    "related_session_id" TEXT,

    CONSTRAINT "training_plan_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_resources" (
    "id" TEXT NOT NULL,
    "training_plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "training_plan_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_announcements" (
    "id" TEXT NOT NULL,
    "training_plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'Normal',

    CONSTRAINT "training_plan_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_feedback_forms" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "form_url" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_feedback_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_feedback_submissions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "trainee_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_plans_code_key" ON "training_plans"("code");

-- CreateIndex
CREATE INDEX "training_plan_sessions_training_plan_id_idx" ON "training_plan_sessions"("training_plan_id");

-- CreateIndex
CREATE INDEX "training_plan_assignments_training_plan_id_idx" ON "training_plan_assignments"("training_plan_id");

-- CreateIndex
CREATE INDEX "training_plan_resources_training_plan_id_idx" ON "training_plan_resources"("training_plan_id");

-- CreateIndex
CREATE INDEX "training_plan_announcements_training_plan_id_idx" ON "training_plan_announcements"("training_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_feedback_forms_session_id_key" ON "session_feedback_forms"("session_id");

-- CreateIndex
CREATE INDEX "session_feedback_submissions_trainee_id_idx" ON "session_feedback_submissions"("trainee_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_feedback_submissions_form_id_trainee_id_key" ON "session_feedback_submissions"("form_id", "trainee_id");

-- CreateIndex
CREATE INDEX "batches_training_plan_id_idx" ON "batches"("training_plan_id");

-- CreateIndex
CREATE INDEX "assignments_session_id_idx" ON "assignments"("session_id");

-- CreateIndex
CREATE INDEX "announcements_batch_id_idx" ON "announcements"("batch_id");

-- AddForeignKey
ALTER TABLE "training_plan_sessions" ADD CONSTRAINT "training_plan_sessions_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_assignments" ADD CONSTRAINT "training_plan_assignments_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_assignments" ADD CONSTRAINT "training_plan_assignments_related_session_id_fkey" FOREIGN KEY ("related_session_id") REFERENCES "training_plan_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_resources" ADD CONSTRAINT "training_plan_resources_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_announcements" ADD CONSTRAINT "training_plan_announcements_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "training_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_training_plan_assignment_id_fkey" FOREIGN KEY ("training_plan_assignment_id") REFERENCES "training_plan_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_training_plan_session_id_fkey" FOREIGN KEY ("training_plan_session_id") REFERENCES "training_plan_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_training_plan_resource_id_fkey" FOREIGN KEY ("training_plan_resource_id") REFERENCES "training_plan_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedback_forms" ADD CONSTRAINT "session_feedback_forms_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedback_forms" ADD CONSTRAINT "session_feedback_forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedback_submissions" ADD CONSTRAINT "session_feedback_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "session_feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedback_submissions" ADD CONSTRAINT "session_feedback_submissions_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_training_plan_announcement_id_fkey" FOREIGN KEY ("training_plan_announcement_id") REFERENCES "training_plan_announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

