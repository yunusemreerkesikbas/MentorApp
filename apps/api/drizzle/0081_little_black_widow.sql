CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"rule_version" smallint DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"earned_at" timestamp with time zone NOT NULL,
	"celebrated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_review_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_completions" ADD CONSTRAINT "weekly_review_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_user_achievement_unique_idx" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_earned_idx" ON "user_achievements" USING btree ("user_id","earned_at");--> statement-breakpoint
CREATE INDEX "user_achievements_org_user_idx" ON "user_achievements" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_review_completions_user_exam_week_unique_idx" ON "weekly_review_completions" USING btree ("user_id","exam_id","week_start");--> statement-breakpoint
CREATE INDEX "weekly_review_completions_user_completed_idx" ON "weekly_review_completions" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notifications_user_dedupe_idx" ON "user_notifications" USING btree ("user_id","dedupe_key") WHERE "user_notifications"."dedupe_key" is not null;--> statement-breakpoint

ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_achievements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY user_achievements_authenticated_read ON "user_achievements" FOR SELECT
  USING (
    current_setting('app.user_id', true) <> ''
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY user_achievements_service_insert ON "user_achievements" FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE POLICY user_achievements_self_celebrate ON "user_achievements" FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT user_achievements_source_chk
  CHECK (source IN ('LIVE', 'BACKFILL'));--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT user_achievements_rule_version_chk
  CHECK (rule_version > 0);--> statement-breakpoint
CREATE FUNCTION enforce_user_achievement_immutability() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.achievement_id IS DISTINCT FROM OLD.achievement_id
     OR NEW.rule_version IS DISTINCT FROM OLD.rule_version
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.earned_at IS DISTINCT FROM OLD.earned_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.celebrated_at IS NULL
     OR (OLD.celebrated_at IS NOT NULL AND NEW.celebrated_at IS DISTINCT FROM OLD.celebrated_at)
  THEN
    RAISE EXCEPTION 'user_achievements rows are immutable except first celebration acknowledgement';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER user_achievements_immutable_trigger
  BEFORE UPDATE ON "user_achievements"
  FOR EACH ROW EXECUTE FUNCTION enforce_user_achievement_immutability();--> statement-breakpoint

ALTER TABLE "weekly_review_completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "weekly_review_completions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY weekly_review_completions_self_or_service ON "weekly_review_completions"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );
