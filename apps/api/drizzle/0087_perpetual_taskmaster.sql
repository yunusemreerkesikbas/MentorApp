CREATE TABLE "ad_reward_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"placement_id" text NOT NULL,
	"platform" text DEFAULT 'WEB' NOT NULL,
	"provider" text DEFAULT 'GOOGLE_AD_MANAGER' NOT NULL,
	"proof_type" text DEFAULT 'CLIENT_EVENT' NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"reward_coin" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rewarded_at" timestamp with time zone,
	"rejection_code" text,
	"provider_transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_reward_sessions_reward_positive" CHECK ("ad_reward_sessions"."reward_coin" > 0),
	CONSTRAINT "ad_reward_sessions_status_check" CHECK ("ad_reward_sessions"."status" in ('CREATED', 'REWARDED', 'CLOSED', 'EXPIRED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "coin_grant_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"ref_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_grant_reservations_amount_positive" CHECK ("coin_grant_reservations"."amount" > 0),
	CONSTRAINT "coin_grant_reservations_status_check" CHECK ("coin_grant_reservations"."status" in ('ACTIVE', 'SETTLED', 'RELEASED'))
);
--> statement-breakpoint
ALTER TABLE "ad_reward_sessions" ADD CONSTRAINT "ad_reward_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_reward_sessions" ADD CONSTRAINT "ad_reward_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_grant_reservations" ADD CONSTRAINT "coin_grant_reservations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_grant_reservations" ADD CONSTRAINT "coin_grant_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_reward_sessions_user_status_expiry_idx" ON "ad_reward_sessions" USING btree ("user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "ad_reward_sessions_user_created_idx" ON "ad_reward_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_reward_sessions_provider_tx_unique_idx" ON "ad_reward_sessions" USING btree ("provider_transaction_id") WHERE "ad_reward_sessions"."provider_transaction_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_grant_reservations_source_ref_unique_idx" ON "coin_grant_reservations" USING btree ("source","ref_id");--> statement-breakpoint
CREATE INDEX "coin_grant_reservations_user_status_expiry_idx" ON "coin_grant_reservations" USING btree ("user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "coin_grant_reservations_user_created_idx" ON "coin_grant_reservations" USING btree ("user_id","created_at");
--> statement-breakpoint
-- Ads reward sessions and Economy reservations are internal control state. They are never queried
-- directly by end-user RLS; controllers cross the bounded-context service seam in SERVICE context.
ALTER TABLE "ad_reward_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_reward_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY ad_reward_sessions_service_all ON "ad_reward_sessions"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "coin_grant_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coin_grant_reservations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY coin_grant_reservations_service_all ON "coin_grant_reservations"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER ad_reward_sessions_set_updated_at BEFORE UPDATE ON "ad_reward_sessions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
