-- Enforce ENABLE + FORCE ROW LEVEL SECURITY across all Drizzle-managed RLS tables
-- and all 13 behavioral/PII/queue tables in schema.ts previously missing RLS.
ALTER TABLE "notebook_reviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notebook_reviews" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_event_attendees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_event_attendees" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_event_series" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_event_series" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_followups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_followups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "economy_reward_receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "economy_reward_receipts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_student_briefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_student_briefs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "storage_budget_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "storage_budget_state" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "storage_object_manifest" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "storage_object_manifest" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "storage_reservations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "storage_reservations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_plan_previews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_plan_previews" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_weekly_recaps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_weekly_recaps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_budget_reservations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_budget_reservations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ai_budget_reservations_service" ON "ai_budget_reservations";
--> statement-breakpoint
CREATE POLICY "ai_budget_reservations_service" ON "ai_budget_reservations"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
--> statement-breakpoint
ALTER TABLE "ai_chat_quota_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_chat_quota_attempts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ai_chat_quota_attempts_service" ON "ai_chat_quota_attempts";
--> statement-breakpoint
CREATE POLICY "ai_chat_quota_attempts_service" ON "ai_chat_quota_attempts"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
--> statement-breakpoint
ALTER TABLE "signup_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "signup_invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "signup_invitations_service" ON "signup_invitations";
--> statement-breakpoint
CREATE POLICY "signup_invitations_service" ON "signup_invitations"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "jobs_service" ON "jobs";
--> statement-breakpoint
CREATE POLICY "jobs_service" ON "jobs"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "email_verification_resend_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_verification_resend_attempts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "email_verification_resend_attempts_isolation" ON "email_verification_resend_attempts";
--> statement-breakpoint
CREATE POLICY "email_verification_resend_attempts_isolation" ON "email_verification_resend_attempts"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id::text = current_setting('app.user_id', true) OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (user_id::text = current_setting('app.user_id', true) OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mentorship_coach_applications_service" ON "mentorship_coach_applications";
--> statement-breakpoint
CREATE POLICY "mentorship_coach_applications_service" ON "mentorship_coach_applications"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "mentorship_cohort_briefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_cohort_briefs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mentorship_cohort_briefs_service" ON "mentorship_cohort_briefs";
--> statement-breakpoint
CREATE POLICY "mentorship_cohort_briefs_service" ON "mentorship_cohort_briefs"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "mentorship_dropped_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_dropped_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mentorship_dropped_assignments_service" ON "mentorship_dropped_assignments";
--> statement-breakpoint
CREATE POLICY "mentorship_dropped_assignments_service" ON "mentorship_dropped_assignments"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "mentorship_invite_codes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_invite_codes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mentorship_invite_codes_service" ON "mentorship_invite_codes";
--> statement-breakpoint
CREATE POLICY "mentorship_invite_codes_service" ON "mentorship_invite_codes"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "mentorship_program_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "mentorship_program_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mentorship_program_templates_service" ON "mentorship_program_templates";
--> statement-breakpoint
CREATE POLICY "mentorship_program_templates_service" ON "mentorship_program_templates"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "coach_students" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "coach_students" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "coach_students_service" ON "coach_students";
--> statement-breakpoint
CREATE POLICY "coach_students_service" ON "coach_students"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "buddy_pairs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "buddy_pairs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "buddy_pairs_service" ON "buddy_pairs";
--> statement-breakpoint
CREATE POLICY "buddy_pairs_service" ON "buddy_pairs"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "user_follows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_follows" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_follows_service" ON "user_follows";
--> statement-breakpoint
CREATE POLICY "user_follows_service" ON "user_follows"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "forum_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "forum_attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "forum_attachments_service" ON "forum_attachments";
--> statement-breakpoint
CREATE POLICY "forum_attachments_service" ON "forum_attachments"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "forum_bookmarks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "forum_bookmarks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "forum_bookmarks_isolation" ON "forum_bookmarks";
--> statement-breakpoint
CREATE POLICY "forum_bookmarks_isolation" ON "forum_bookmarks"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id::text = current_setting('app.user_id', true) OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (user_id::text = current_setting('app.user_id', true) OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
--> statement-breakpoint
ALTER TABLE "forum_pending_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "forum_pending_attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "forum_pending_attachments_service" ON "forum_pending_attachments";
--> statement-breakpoint
CREATE POLICY "forum_pending_attachments_service" ON "forum_pending_attachments"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
