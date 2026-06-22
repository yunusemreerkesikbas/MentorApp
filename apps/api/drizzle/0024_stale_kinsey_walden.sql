CREATE TABLE "forum_moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_scope" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_moderation_actions" ADD CONSTRAINT "forum_moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_moderation_actions" ADD CONSTRAINT "forum_moderation_actions_zone_id_forum_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."forum_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_zone_id_forum_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."forum_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_moderation_actions_zone_created_idx" ON "forum_moderation_actions" USING btree ("zone_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_reports_unique_idx" ON "forum_reports" USING btree ("target_type","target_id","reporter_id");--> statement-breakpoint
CREATE INDEX "forum_reports_zone_status_idx" ON "forum_reports" USING btree ("zone_id","status");--> statement-breakpoint
CREATE INDEX "forum_reports_status_idx" ON "forum_reports" USING btree ("status");--> statement-breakpoint
-- ===================== RLS (§6/§4) — moderation (all access app-policy-gated in SERVICE context) =====================
-- Reports + actions are owner/mod/staff surfaces; reads + writes run in SERVICE context and are
-- policy-checked in the app (forum.policy.canModerateZone). forum_moderation_actions has NO
-- update/delete policy ⇒ append-only audit (like ledger_entries).
ALTER TABLE "forum_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_reports" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_reports_rw ON "forum_reports" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "forum_moderation_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_moderation_actions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_moderation_actions_read ON "forum_moderation_actions" FOR SELECT
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE POLICY forum_moderation_actions_insert ON "forum_moderation_actions" FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));