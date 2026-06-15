CREATE TABLE "user_quest_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_quest_progress_user_quest_unique_idx" ON "user_quest_progress" USING btree ("user_id","quest_id");--> statement-breakpoint
CREATE INDEX "user_quest_progress_user_idx" ON "user_quest_progress" USING btree ("user_id");--> statement-breakpoint
-- ===================== RLS (§8/§9) — onboarding quest progress =====================
-- The user reads own progress; SERVICE/ADMIN any. Writes (eval/grant) run in SERVICE context.
ALTER TABLE "user_quest_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_quest_progress" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY user_quest_progress_self_read ON "user_quest_progress" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY user_quest_progress_service_write ON "user_quest_progress"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));