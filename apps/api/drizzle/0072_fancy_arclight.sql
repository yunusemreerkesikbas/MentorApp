CREATE TABLE "campus_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"coverage_status" text NOT NULL,
	"render_mode" text NOT NULL,
	"initial_latitude" numeric(9, 6) NOT NULL,
	"initial_longitude" numeric(9, 6) NOT NULL,
	"initial_altitude" numeric(10, 2) NOT NULL,
	"initial_heading" numeric(6, 2) NOT NULL,
	"initial_tilt" numeric(5, 2) NOT NULL,
	"initial_range" numeric(10, 2) NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_experiences_coverage_chk" CHECK ("campus_experiences"."coverage_status" IN ('PHOTOREALISTIC', 'TERRAIN_ONLY', 'UNKNOWN')),
	CONSTRAINT "campus_experiences_render_mode_chk" CHECK ("campus_experiences"."render_mode" IN ('PHOTOREALISTIC', 'HYBRID')),
	CONSTRAINT "campus_experiences_enabled_verified_chk" CHECK ("campus_experiences"."is_enabled" = false OR "campus_experiences"."coverage_status" <> 'UNKNOWN')
);
--> statement-breakpoint
CREATE TABLE "campus_pois" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campus_experience_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	"title_tr" text NOT NULL,
	"title_en" text NOT NULL,
	"summary_tr" text NOT NULL,
	"summary_en" text NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"altitude" numeric(10, 2) NOT NULL,
	"heading" numeric(6, 2) NOT NULL,
	"tilt" numeric(5, 2) NOT NULL,
	"range" numeric(10, 2) NOT NULL,
	"position" smallint NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_pois_position_chk" CHECK ("campus_pois"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "preference_scenario_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"program_code" varchar(9) NOT NULL,
	"program_name" text NOT NULL,
	"faculty" text NOT NULL,
	"level" text NOT NULL,
	"score_type" text NOT NULL,
	"quota" integer NOT NULL,
	"guide_year" smallint NOT NULL,
	"placement_year" smallint NOT NULL,
	"success_rank" integer,
	"university_id" uuid NOT NULL,
	"university_name" text NOT NULL,
	"city_code" varchar(2) NOT NULL,
	"city_name" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preference_scenario_items_position_chk" CHECK ("preference_scenario_items"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "preference_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"exam_type" text NOT NULL,
	"dataset_version" varchar(80) NOT NULL,
	"rank_say" integer,
	"rank_ea" integer,
	"rank_soz" integer,
	"rank_dil" integer,
	"rank_tyt" integer,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preference_scenarios_revision_chk" CHECK ("preference_scenarios"."revision" > 0),
	CONSTRAINT "preference_scenarios_exam_chk" CHECK ("preference_scenarios"."exam_type" = 'YKS')
);
--> statement-breakpoint
CREATE TABLE "program_catalog_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_type" text NOT NULL,
	"version" varchar(80) NOT NULL,
	"guide_year" smallint NOT NULL,
	"placement_year" smallint NOT NULL,
	"official_preference_limit" smallint NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_catalog_datasets_years_chk" CHECK ("program_catalog_datasets"."guide_year" >= "program_catalog_datasets"."placement_year"),
	CONSTRAINT "program_catalog_datasets_limit_chk" CHECK ("program_catalog_datasets"."official_preference_limit" > 0)
);
--> statement-breakpoint
ALTER TABLE "campus_experiences" ADD CONSTRAINT "campus_experiences_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_pois" ADD CONSTRAINT "campus_pois_campus_experience_id_campus_experiences_id_fk" FOREIGN KEY ("campus_experience_id") REFERENCES "public"."campus_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_scenario_items" ADD CONSTRAINT "preference_scenario_items_scenario_id_preference_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."preference_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_scenario_items" ADD CONSTRAINT "preference_scenario_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_scenarios" ADD CONSTRAINT "preference_scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_scenarios" ADD CONSTRAINT "preference_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campus_experiences_university_idx" ON "campus_experiences" USING btree ("university_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_pois_experience_slug_idx" ON "campus_pois" USING btree ("campus_experience_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "campus_pois_experience_position_idx" ON "campus_pois" USING btree ("campus_experience_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_scenario_items_position_idx" ON "preference_scenario_items" USING btree ("scenario_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_scenario_items_program_idx" ON "preference_scenario_items" USING btree ("scenario_id","program_code");--> statement-breakpoint
CREATE INDEX "preference_scenario_items_user_idx" ON "preference_scenario_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_scenarios_user_idx" ON "preference_scenarios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "preference_scenarios_org_idx" ON "preference_scenarios" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_catalog_datasets_version_idx" ON "program_catalog_datasets" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "program_catalog_datasets_active_exam_idx" ON "program_catalog_datasets" USING btree ("exam_type") WHERE "program_catalog_datasets"."is_active" = true;
--> statement-breakpoint
-- APP-034: global editorial reference data — public read, SERVICE/ADMIN write only.
ALTER TABLE "program_catalog_datasets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_catalog_datasets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY program_catalog_datasets_public_read ON "program_catalog_datasets"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY program_catalog_datasets_service_write ON "program_catalog_datasets"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

ALTER TABLE "campus_experiences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campus_experiences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY campus_experiences_public_read ON "campus_experiences"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY campus_experiences_service_write ON "campus_experiences"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

ALTER TABLE "campus_pois" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campus_pois" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY campus_pois_public_read ON "campus_pois"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY campus_pois_service_write ON "campus_pois"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

-- Per-user behavioral data — every read/write is self-scoped at both DB and repository levels.
ALTER TABLE "preference_scenarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preference_scenarios" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY preference_scenarios_self_or_service ON "preference_scenarios"
  FOR ALL
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint

ALTER TABLE "preference_scenario_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preference_scenario_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY preference_scenario_items_self_or_service ON "preference_scenario_items"
  FOR ALL
  USING (
    current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
    OR (
      user_id::text = current_setting('app.user_id', true)
      AND EXISTS (
        SELECT 1
        FROM preference_scenarios parent_scenario
        WHERE parent_scenario.id = scenario_id
          AND parent_scenario.user_id = preference_scenario_items.user_id
      )
    )
  )
  WITH CHECK (
    current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
    OR (
      user_id::text = current_setting('app.user_id', true)
      AND EXISTS (
        SELECT 1
        FROM preference_scenarios parent_scenario
        WHERE parent_scenario.id = scenario_id
          AND parent_scenario.user_id = preference_scenario_items.user_id
      )
    )
  );--> statement-breakpoint

CREATE TRIGGER program_catalog_datasets_set_updated_at
  BEFORE UPDATE ON "program_catalog_datasets"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER campus_experiences_set_updated_at
  BEFORE UPDATE ON "campus_experiences"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER campus_pois_set_updated_at
  BEFORE UPDATE ON "campus_pois"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER preference_scenarios_set_updated_at
  BEFORE UPDATE ON "preference_scenarios"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
