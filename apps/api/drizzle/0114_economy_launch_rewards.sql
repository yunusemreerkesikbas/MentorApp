CREATE TABLE "economy_reward_receipts" (
	"ledger_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "economy_reward_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD COLUMN "source_payment_id" text;--> statement-breakpoint
ALTER TABLE "invite_redemptions" ADD COLUMN "reward_outcome" text;--> statement-breakpoint
ALTER TABLE "economy_reward_receipts" ADD CONSTRAINT "economy_reward_receipts_ledger_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy_reward_receipts" ADD CONSTRAINT "economy_reward_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economy_reward_receipts" ADD CONSTRAINT "economy_reward_receipts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "economy_reward_receipts_unseen_idx" ON "economy_reward_receipts" USING btree ("user_id") WHERE "economy_reward_receipts"."seen_at" is null;--> statement-breakpoint
CREATE POLICY "economy_reward_receipts_service" ON "economy_reward_receipts" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "economy_reward_receipts_owner_read" ON "economy_reward_receipts" AS PERMISSIVE FOR SELECT TO public USING ("economy_reward_receipts"."user_id" = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "economy_reward_receipts_owner_update" ON "economy_reward_receipts" AS PERMISSIVE FOR UPDATE TO public USING ("economy_reward_receipts"."user_id" = nullif(current_setting('app.user_id', true), '')::uuid) WITH CHECK ("economy_reward_receipts"."user_id" = nullif(current_setting('app.user_id', true), '')::uuid);