-- 0054 was merged after 0055 had already been applied in some environments.
-- Drizzle does not backfill older timestamps, so repair without breaking
-- databases where 0054 already ran.
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "body_format" text DEFAULT 'MARKDOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "author_name" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "author_title" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "author_bio" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "cover_image_key" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "cover_image_alt" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "cover_image_width" integer;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN IF NOT EXISTS "cover_image_height" integer;
