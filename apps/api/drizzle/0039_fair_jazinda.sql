ALTER TABLE "study_sessions" ADD COLUMN "ai_reflection" text;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "ai_model" text;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "ai_reflected_at" timestamp with time zone;