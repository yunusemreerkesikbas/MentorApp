ALTER TABLE "mentorship_weekly_reports" ADD COLUMN "brief_coach_context" text;--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ADD COLUMN "brief_fingerprint" text;--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ADD COLUMN "brief_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ADD COLUMN "brief_started_at" timestamp with time zone;