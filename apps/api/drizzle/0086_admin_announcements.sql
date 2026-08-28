-- W5: admin-authored broadcast. Fanned out into `user_notifications` (category SYSTEM) by the
-- `notifications.dispatch-announcement` job. NOTE: drizzle-kit also re-emitted the composite
-- notebook FK/index from 0084 (its snapshot never recorded them); those already exist in the DB,
-- so they were hand-trimmed here — 0086_snapshot.json heals the baseline (same fix as 0008).
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link_url" text,
	"audience" jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_status_check" CHECK ("announcements"."status" IN ('DRAFT', 'SENDING', 'SENT'))
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_created_idx" ON "announcements" USING btree ("created_at");--> statement-breakpoint
-- ===================== RLS (§8/§9) — admin-only broadcast source =====================
-- Cross-user by nature: only SERVICE (the dispatch job / admin services) and ADMIN may touch it.
-- End users never read this table — they read their own `user_notifications` rows.
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY announcements_service_all ON "announcements"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON "announcements"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
