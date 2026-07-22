DROP INDEX "ai_daily_greetings_user_date_idx";--> statement-breakpoint
ALTER TABLE "ai_daily_greetings" ADD COLUMN "locale" varchar(5) DEFAULT 'tr' NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_exams" ADD COLUMN "ai_narration_locale" varchar(5);--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD COLUMN "ai_locale" varchar(5);--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "ai_locale" varchar(5);--> statement-breakpoint
ALTER TABLE "vision_boards" ADD COLUMN "ai_locale" varchar(5);--> statement-breakpoint
CREATE UNIQUE INDEX "ai_daily_greetings_user_date_locale_idx" ON "ai_daily_greetings" USING btree ("user_id","greeting_date","locale");