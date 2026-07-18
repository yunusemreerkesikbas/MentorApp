ALTER TABLE "info_articles" ADD COLUMN "body_format" text DEFAULT 'MARKDOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "author_title" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "author_bio" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "cover_image_key" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "cover_image_alt" text;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "cover_image_width" integer;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "cover_image_height" integer;