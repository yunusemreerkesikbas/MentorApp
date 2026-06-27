-- W5 extension: in-app notification inbox.
-- Stores user-visible notifications (daily-reminder, streak, content) for the drawer UI.
-- RLS: user-scoped self access only (reads + updates for mark-read).
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notifications"
  ADD CONSTRAINT "user_notifications_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_notifications_user_created_idx"
  ON "user_notifications" USING btree ("user_id","created_at" DESC);
--> statement-breakpoint
ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Self-access: read own rows, mark own rows read (no delete — soft history preserved)
CREATE POLICY user_notifications_user ON "user_notifications"
  FOR ALL
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);
--> statement-breakpoint
-- Service context can insert notifications on behalf of users (daily-reminder dispatch)
CREATE POLICY user_notifications_service ON "user_notifications"
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
