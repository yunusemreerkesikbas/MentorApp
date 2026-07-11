CREATE TABLE "coach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_messages_user_created_idx" ON "coach_messages" USING btree ("user_id","created_at");--> statement-breakpoint
-- ===================== RLS (coach_messages — per-user behavioral data) =====================
ALTER TABLE "coach_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY coach_messages_self_or_service ON "coach_messages"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );