ALTER TABLE "user_quest_progress" ADD COLUMN "period_key" text DEFAULT 'once' NOT NULL;
DROP INDEX IF EXISTS "user_quest_progress_user_quest_unique_idx";
CREATE UNIQUE INDEX "user_quest_progress_user_quest_period_unique_idx" ON "user_quest_progress" USING btree ("user_id","quest_id","period_key");
