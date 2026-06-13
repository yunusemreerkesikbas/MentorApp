CREATE TABLE "config_overrides" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "config_overrides" ADD CONSTRAINT "config_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ===================== RLS (§8/§9) — platform config, admin-only =====================
-- Config is platform-wide (not user-scoped); only SERVICE/ADMIN may read or write. The registry
-- service runs in SERVICE context. Reads are cached in-process; writes go through the admin API.
ALTER TABLE "config_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_overrides" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY config_overrides_service_read ON "config_overrides" FOR SELECT
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE POLICY config_overrides_service_write ON "config_overrides"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));