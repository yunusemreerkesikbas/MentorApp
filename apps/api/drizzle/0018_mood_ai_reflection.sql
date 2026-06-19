ALTER TABLE "mood_checkins" ADD COLUMN "struggle_note" text;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD COLUMN "ai_reflection" text;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD COLUMN "ai_model" text;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD COLUMN "ai_reflected_at" timestamp with time zone;