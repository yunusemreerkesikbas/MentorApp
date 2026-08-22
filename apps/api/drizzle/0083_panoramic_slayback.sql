CREATE TABLE "user_journey_level_celebrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"tier" smallint NOT NULL,
	"kind" text NOT NULL,
	"unlocked_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_journey_level_celebrations_tier_chk" CHECK ("user_journey_level_celebrations"."tier" between 1 and 12),
	CONSTRAINT "user_journey_level_celebrations_kind_chk" CHECK ("user_journey_level_celebrations"."kind" in ('INTRODUCTION', 'LEVEL_UP')),
	CONSTRAINT "user_journey_level_celebrations_resolution_chk" CHECK ("user_journey_level_celebrations"."resolution" is null or "user_journey_level_celebrations"."resolution" in ('SHOWN', 'SUPERSEDED')),
	CONSTRAINT "user_journey_level_celebrations_resolution_pair_chk" CHECK (("user_journey_level_celebrations"."resolved_at" is null and "user_journey_level_celebrations"."resolution" is null) or ("user_journey_level_celebrations"."resolved_at" is not null and "user_journey_level_celebrations"."resolution" is not null))
);
--> statement-breakpoint
ALTER TABLE "user_journey_level_celebrations" ADD CONSTRAINT "user_journey_level_celebrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_journey_level_celebrations" ADD CONSTRAINT "user_journey_level_celebrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_journey_level_celebrations_user_tier_unique_idx" ON "user_journey_level_celebrations" USING btree ("user_id","tier");--> statement-breakpoint
CREATE INDEX "user_journey_level_celebrations_user_unlocked_idx" ON "user_journey_level_celebrations" USING btree ("user_id","unlocked_at");--> statement-breakpoint
CREATE INDEX "user_journey_level_celebrations_org_user_idx" ON "user_journey_level_celebrations" USING btree ("org_id","user_id");--> statement-breakpoint

ALTER TABLE "user_journey_level_celebrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_journey_level_celebrations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY user_journey_level_celebrations_self_read ON "user_journey_level_celebrations" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) = 'SERVICE'
  );--> statement-breakpoint
CREATE POLICY user_journey_level_celebrations_service_insert ON "user_journey_level_celebrations" FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY user_journey_level_celebrations_self_or_service_resolve ON "user_journey_level_celebrations" FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) = 'SERVICE'
  )
  WITH CHECK (
    (user_id::text = current_setting('app.user_id', true) AND resolution = 'SHOWN')
    OR current_setting('app.role', true) = 'SERVICE'
  );--> statement-breakpoint

CREATE FUNCTION enforce_user_journey_level_celebration_immutability() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.unlocked_at IS DISTINCT FROM OLD.unlocked_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.resolved_at IS NOT NULL
     OR NEW.resolved_at IS NULL
     OR NEW.resolution IS NULL
  THEN
    RAISE EXCEPTION 'journey-level celebration rows are immutable except first resolution';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER user_journey_level_celebrations_immutable_trigger
  BEFORE UPDATE ON "user_journey_level_celebrations"
  FOR EACH ROW EXECUTE FUNCTION enforce_user_journey_level_celebration_immutability();
