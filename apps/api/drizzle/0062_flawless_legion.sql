CREATE TABLE "cities" (
	"code" varchar(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"region" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_code" varchar(2) NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"founded_year" integer,
	"website_url" text,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vision_boards" ADD COLUMN "target_city_code" varchar(2);--> statement-breakpoint
ALTER TABLE "vision_boards" ADD COLUMN "target_university_id" uuid;--> statement-breakpoint
ALTER TABLE "vision_boards" ADD COLUMN "career_group" text;--> statement-breakpoint
ALTER TABLE "universities" ADD CONSTRAINT "universities_city_code_cities_code_fk" FOREIGN KEY ("city_code") REFERENCES "public"."cities"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "universities_slug_unique_idx" ON "universities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "universities_city_idx" ON "universities" USING btree ("city_code");--> statement-breakpoint
ALTER TABLE "vision_boards" ADD CONSTRAINT "vision_boards_target_city_code_cities_code_fk" FOREIGN KEY ("target_city_code") REFERENCES "public"."cities"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vision_boards" ADD CONSTRAINT "vision_boards_target_university_id_universities_id_fk" FOREIGN KEY ("target_university_id") REFERENCES "public"."universities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- APP-032: RLS on geo reference data (mirrors the subjects/exams public-read pattern).
-- Global reference tables: no org_id/user_id — everyone reads, only SERVICE/ADMIN writes (seed).
ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY cities_public_read ON "cities"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY cities_service_write ON "cities"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "universities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "universities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY universities_public_read ON "universities"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY universities_service_write ON "universities"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));