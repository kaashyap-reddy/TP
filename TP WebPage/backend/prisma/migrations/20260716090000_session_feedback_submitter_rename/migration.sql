-- Hand-authored (no live database available in this environment).
--   * SessionFeedbackSubmission.trainee_id renamed to submitter_id — a form's audience can target
--     trainees, facilitators, or both, so submissions were never trainee-only despite the old
--     column name. Existing FK/unique/index definitions follow the rename automatically in
--     Postgres; no data loss.
-- Verify with `prisma migrate dev` locally against a live database before treating it as
-- production-ready.

ALTER TABLE "session_feedback_submissions" RENAME COLUMN "trainee_id" TO "submitter_id";
