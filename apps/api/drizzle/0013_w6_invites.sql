CREATE TABLE "invite_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"inviter_user_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD CONSTRAINT "invite_redemptions_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD CONSTRAINT "invite_redemptions_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_redemptions_invited_unique_idx" ON "invite_redemptions" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "invite_redemptions_inviter_idx" ON "invite_redemptions" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_code_unique_idx" ON "invites" USING btree ("code");--> statement-breakpoint
-- ===================== RLS (§8/§9) — invites & redemptions =====================
-- invites: the inviter reads own code; SERVICE/ADMIN any. Writes SERVICE/ADMIN.
-- redemptions: system-managed (SERVICE/ADMIN only) — redeem/convert run in SERVICE context.
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY invites_self_read ON "invites" FOR SELECT
  USING (
    inviter_user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY invites_service_write ON "invites"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "invite_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invite_redemptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY invite_redemptions_service ON "invite_redemptions"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
