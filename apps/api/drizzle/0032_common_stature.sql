CREATE TABLE "user_auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"provider_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_auth_accounts" ADD CONSTRAINT "user_auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_accounts_provider_subject_idx" ON "user_auth_accounts" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_accounts_user_provider_idx" ON "user_auth_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "user_auth_accounts_user_idx" ON "user_auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE TRIGGER user_auth_accounts_set_updated_at BEFORE UPDATE ON "user_auth_accounts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE "user_auth_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_auth_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY user_auth_accounts_service_only ON "user_auth_accounts"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
