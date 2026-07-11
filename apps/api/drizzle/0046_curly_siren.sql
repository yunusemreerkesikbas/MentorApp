CREATE TABLE "coach_memory" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"model" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "feedback" smallint;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "suggested_task" jsonb;--> statement-breakpoint
ALTER TABLE "coach_memory" ADD CONSTRAINT "coach_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ===================== RLS (coach_memory — per-user behavioral data) =====================
ALTER TABLE "coach_memory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_memory" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY coach_memory_self_or_service ON "coach_memory"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );