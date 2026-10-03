CREATE TABLE "phone_otp_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"account_key" text NOT NULL,
	"phone_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_otp_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"session_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"phone_key" text NOT NULL,
	"previous_phone_number" text,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resend_available_at" timestamp with time zone NOT NULL,
	"send_status" text DEFAULT 'PENDING' NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "phone_trial_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_fingerprint" text NOT NULL,
	"user_id" uuid,
	"subscription_id" uuid,
	"plan_id" text NOT NULL,
	"code" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"provider_ref" text,
	"checkout_url" text,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_trial_claims_status_check" CHECK ("phone_trial_claims"."status" in ('PENDING', 'CONSUMED')),
	CONSTRAINT "phone_trial_claims_expiry_check" CHECK (("phone_trial_claims"."status" = 'PENDING' and "phone_trial_claims"."expires_at" is null and "phone_trial_claims"."consumed_at" is null) or ("phone_trial_claims"."status" = 'CONSUMED' and "phone_trial_claims"."expires_at" is not null and "phone_trial_claims"."consumed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "phone_trial_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_trial_claims" ADD CONSTRAINT "phone_trial_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_trial_claims" ADD CONSTRAINT "phone_trial_claims_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_trial_claims" ADD CONSTRAINT "phone_trial_claims_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_otp_attempts_account_idx" ON "phone_otp_attempts" USING btree ("account_key","kind","created_at");--> statement-breakpoint
CREATE INDEX "phone_otp_attempts_phone_idx" ON "phone_otp_attempts" USING btree ("phone_key","kind","created_at");--> statement-breakpoint
CREATE INDEX "phone_otp_attempts_created_idx" ON "phone_otp_attempts" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "phone_verifications_user_created_idx" ON "phone_verifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "phone_verifications_expiry_idx" ON "phone_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_trial_claims_fingerprint_unique" ON "phone_trial_claims" USING btree ("phone_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_trial_claims_pending_user_unique" ON "phone_trial_claims" USING btree ("user_id") WHERE "phone_trial_claims"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "phone_trial_claims_subscription_unique" ON "phone_trial_claims" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "phone_trial_claims_expiry_idx" ON "phone_trial_claims" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_active_phone_unique_idx" ON "users" USING btree ("phone_number") WHERE "users"."status" = 'ACTIVE' AND "users"."phone_verified_at" IS NOT NULL;--> statement-breakpoint
CREATE POLICY "phone_otp_attempts_service" ON "phone_otp_attempts" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "phone_verifications_service" ON "phone_verifications" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "phone_trial_claims_service" ON "phone_trial_claims" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');