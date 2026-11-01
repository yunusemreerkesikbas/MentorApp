ALTER TABLE "user_quest_progress" ADD COLUMN "revealed_at" timestamp with time zone;--> statement-breakpoint
-- Chests completed before the opening scene shipped were already celebrated by the generic Coin popup:
-- mark them opened so nobody meets a "last week's chest" on launch day. The table forces RLS, so the
-- transaction-local service role is set for the update and cleared right after (same as 0129).
SELECT set_config('app.role', 'SERVICE', true);--> statement-breakpoint
UPDATE "user_quest_progress" SET "revealed_at" = "completed_at" WHERE "quest_id" = 'weekly.effort-allowance' AND "revealed_at" IS NULL;--> statement-breakpoint
SELECT set_config('app.role', '', true);
