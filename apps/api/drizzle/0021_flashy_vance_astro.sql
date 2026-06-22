CREATE TABLE "forum_zone_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'PUBLIC' NOT NULL,
	"join_policy" text DEFAULT 'OPEN' NOT NULL,
	"exam_type" text,
	"organization_id" uuid,
	"created_by" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_zone_members" ADD CONSTRAINT "forum_zone_members_zone_id_forum_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."forum_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_zone_members" ADD CONSTRAINT "forum_zone_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_zones" ADD CONSTRAINT "forum_zones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_zones" ADD CONSTRAINT "forum_zones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_zone_members_unique_idx" ON "forum_zone_members" USING btree ("zone_id","user_id");--> statement-breakpoint
CREATE INDEX "forum_zone_members_zone_status_idx" ON "forum_zone_members" USING btree ("zone_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_zones_slug_idx" ON "forum_zones" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "forum_zones_type_idx" ON "forum_zones" USING btree ("type");--> statement-breakpoint
-- ===================== RLS (§6/§4 #7) — zones + scoped membership =====================
-- Two-plane authz: read is RLS-gated (PUBLIC non-archived zones to any authed user; own
-- membership rows to self); all privileged writes + member-list reads run in SERVICE context
-- and are policy-checked in the application (forum.policy.ts). Phase 2 layers private zones.
ALTER TABLE "forum_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_zones" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_zones_read ON "forum_zones" FOR SELECT
  USING (
    (visibility = 'PUBLIC' AND is_archived = false AND current_setting('app.user_id', true) <> '')
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_zones_write ON "forum_zones" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "forum_zone_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_zone_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_zone_members_read ON "forum_zone_members" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_zone_members_write ON "forum_zone_members" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER forum_zones_set_updated_at BEFORE UPDATE ON "forum_zones"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER forum_zone_members_set_updated_at BEFORE UPDATE ON "forum_zone_members"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();