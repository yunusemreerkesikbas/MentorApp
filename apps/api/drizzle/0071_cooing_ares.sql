CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kpss_postings" (
	"osym_code" varchar(12) PRIMARY KEY NOT NULL,
	"round" text NOT NULL,
	"education_level" text NOT NULL,
	"institution_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"city_code" varchar(2) NOT NULL,
	"district" text,
	"employment_type" text NOT NULL,
	"service_class" text,
	"grade" smallint,
	"quota" integer NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "titles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "vision_boards" ADD COLUMN "target_title_id" uuid;--> statement-breakpoint
ALTER TABLE "vision_boards" ADD COLUMN "target_institution_id" uuid;--> statement-breakpoint
ALTER TABLE "kpss_postings" ADD CONSTRAINT "kpss_postings_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpss_postings" ADD CONSTRAINT "kpss_postings_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpss_postings" ADD CONSTRAINT "kpss_postings_city_code_cities_code_fk" FOREIGN KEY ("city_code") REFERENCES "public"."cities"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpss_postings_city_idx" ON "kpss_postings" USING btree ("city_code");--> statement-breakpoint
CREATE INDEX "kpss_postings_title_idx" ON "kpss_postings" USING btree ("title_id");--> statement-breakpoint
CREATE INDEX "kpss_postings_institution_idx" ON "kpss_postings" USING btree ("institution_id");--> statement-breakpoint
ALTER TABLE "vision_boards" ADD CONSTRAINT "vision_boards_target_title_id_titles_id_fk" FOREIGN KEY ("target_title_id") REFERENCES "public"."titles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vision_boards" ADD CONSTRAINT "vision_boards_target_institution_id_institutions_id_fk" FOREIGN KEY ("target_institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- APP-032: RLS on KPSS reference data (mirrors the cities/universities/programs pattern).
-- Global editorial reference: everyone reads, only SERVICE/ADMIN writes (per-round ÖSYM import).
ALTER TABLE "titles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "titles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY titles_public_read ON "titles"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY titles_service_write ON "titles"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "institutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "institutions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY institutions_public_read ON "institutions"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY institutions_service_write ON "institutions"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "kpss_postings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kpss_postings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY kpss_postings_public_read ON "kpss_postings"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY kpss_postings_service_write ON "kpss_postings"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
