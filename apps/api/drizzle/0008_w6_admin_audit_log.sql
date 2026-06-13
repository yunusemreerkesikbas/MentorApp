CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
-- ===================== RLS (§8/§9) — admin-only audit trail =====================
-- Append-only: admin services run in SERVICE context; ADMIN role also permitted (no self belt
-- — the trail is cross-user). No UPDATE/DELETE policy ⇒ rows are immutable once written.
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY admin_audit_log_service_read ON "admin_audit_log" FOR SELECT
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE POLICY admin_audit_log_service_insert ON "admin_audit_log" FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
