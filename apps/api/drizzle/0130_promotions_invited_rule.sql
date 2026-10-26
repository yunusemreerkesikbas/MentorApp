-- INVITED promotion rule (friend-invite discount). New rule type in the CHECK, and the keyed phone hash on
-- the redemption row: INVITED is once per phone across accounts, counted under the promotion lock at checkout.
-- Schema only, no data touched, so the RLS service role is not needed here.
ALTER TABLE "promotions" DROP CONSTRAINT "promotions_rule_type_check";--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD COLUMN "phone_fingerprint" text;--> statement-breakpoint
CREATE INDEX "promotion_redemptions_promotion_phone_idx" ON "promotion_redemptions" USING btree ("promotion_id","phone_fingerprint") WHERE "promotion_redemptions"."phone_fingerprint" is not null;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_rule_type_check" CHECK ("promotions"."rule_type" in ('ANYONE', 'NEW_USER', 'ACTIVE_DAYS', 'WIN_BACK', 'INVITED'));