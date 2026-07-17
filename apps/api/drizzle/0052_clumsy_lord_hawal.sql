-- ai_daily_greetings was created by the hand-written 0051_w3_daily_greeting.sql
-- (snapshot lagged behind); this migration only adds the users column.
ALTER TABLE "users" ADD COLUMN "daily_focus_goal_minutes" integer;
