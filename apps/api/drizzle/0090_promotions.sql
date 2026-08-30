CREATE TABLE "promotion_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"promotion_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"plan_id" text NOT NULL,
	"list_price_minor" integer NOT NULL,
	"discount_minor" integer NOT NULL,
	"charged_price_minor" integer NOT NULL,
	"periods_remaining" integer NOT NULL,
	"status" text DEFAULT 'RESERVED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_redemptions_price_consistent" CHECK ("promotion_redemptions"."charged_price_minor" = "promotion_redemptions"."list_price_minor" - "promotion_redemptions"."discount_minor"),
	CONSTRAINT "promotion_redemptions_charge_positive" CHECK ("promotion_redemptions"."charged_price_minor" > 0),
	CONSTRAINT "promotion_redemptions_discount_positive" CHECK ("promotion_redemptions"."discount_minor" > 0),
	CONSTRAINT "promotion_redemptions_periods_nonnegative" CHECK ("promotion_redemptions"."periods_remaining" >= 0),
	CONSTRAINT "promotion_redemptions_status_check" CHECK ("promotion_redemptions"."status" in ('RESERVED', 'APPLIED', 'VOIDED'))
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"label_tr" text NOT NULL,
	"label_en" text NOT NULL,
	"rule_type" text DEFAULT 'ANYONE' NOT NULL,
	"rule_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"applies_to_periods" integer DEFAULT 1 NOT NULL,
	"plan_ids" text[],
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_redemptions" integer,
	"max_redemptions_per_user" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_discount_value_positive" CHECK ("promotions"."discount_value" > 0),
	CONSTRAINT "promotions_percent_bounds" CHECK ("promotions"."discount_type" <> 'PERCENT' or "promotions"."discount_value" between 1 and 90),
	CONSTRAINT "promotions_periods_positive" CHECK ("promotions"."applies_to_periods" >= 1),
	CONSTRAINT "promotions_per_user_positive" CHECK ("promotions"."max_redemptions_per_user" >= 1),
	CONSTRAINT "promotions_max_redemptions_positive" CHECK ("promotions"."max_redemptions" is null or "promotions"."max_redemptions" > 0),
	CONSTRAINT "promotions_rule_type_check" CHECK ("promotions"."rule_type" in ('ANYONE', 'NEW_USER', 'ACTIVE_DAYS', 'WIN_BACK')),
	CONSTRAINT "promotions_discount_type_check" CHECK ("promotions"."discount_type" in ('PERCENT', 'FIXED')),
	CONSTRAINT "promotions_window_order" CHECK ("promotions"."starts_at" is null or "promotions"."ends_at" is null or "promotions"."ends_at" > "promotions"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_redemptions_subscription_unique_idx" ON "promotion_redemptions" USING btree ("subscription_id") WHERE "promotion_redemptions"."subscription_id" is not null;--> statement-breakpoint
CREATE INDEX "promotion_redemptions_user_promotion_idx" ON "promotion_redemptions" USING btree ("user_id","promotion_id");--> statement-breakpoint
CREATE INDEX "promotion_redemptions_promotion_status_idx" ON "promotion_redemptions" USING btree ("promotion_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_active_code_unique_idx" ON "promotions" USING btree (lower("code")) WHERE "promotions"."code" is not null and "promotions"."is_active";--> statement-breakpoint
CREATE INDEX "promotions_active_window_idx" ON "promotions" USING btree ("is_active","starts_at","ends_at");
--> statement-breakpoint
-- Promotions are commercial control state: definitions are admin-authored, redemptions are written
-- only by the payments checkout/webhook path. Both cross the bounded-context seam in SERVICE
-- context, so neither needs an end-user RLS policy.
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "promotions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY promotions_service_all ON "promotions"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "promotion_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "promotion_redemptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY promotion_redemptions_service_all ON "promotion_redemptions"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER promotions_set_updated_at BEFORE UPDATE ON "promotions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER promotion_redemptions_set_updated_at BEFORE UPDATE ON "promotion_redemptions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
