CREATE TABLE "signup_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"locale" text DEFAULT 'tr' NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_at" timestamp with time zone,
	"invited_by" uuid
);
--> statement-breakpoint
ALTER TABLE "signup_invitations" ADD CONSTRAINT "signup_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_invitations" ADD CONSTRAINT "signup_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signup_invitations_email_uq" ON "signup_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "signup_invitations_status_created_idx" ON "signup_invitations" USING btree ("status","created_at");
--> statement-breakpoint
ALTER TABLE "signup_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "signup_invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "signup_invitations_service" ON "signup_invitations"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
