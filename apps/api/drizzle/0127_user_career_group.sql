ALTER TABLE "users" ADD COLUMN "career_group" text;--> statement-breakpoint
-- Backfill the mirror from the goal board, the value's owner (coaching writes it on every upsert).
UPDATE "users" u SET "career_group" = vb."career_group" FROM "vision_boards" vb WHERE vb."user_id" = u."id" AND vb."career_group" IS NOT NULL;
