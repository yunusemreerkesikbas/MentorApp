CREATE TABLE "program_scores" (
	"program_code" varchar(9) NOT NULL,
	"score_year" smallint NOT NULL,
	"min_score" numeric(9, 5),
	"success_rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"code" varchar(9) PRIMARY KEY NOT NULL,
	"university_id" uuid NOT NULL,
	"faculty" text NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"duration_years" smallint NOT NULL,
	"score_type" text NOT NULL,
	"quota" integer NOT NULL,
	"guide_year" smallint NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "program_scores" ADD CONSTRAINT "program_scores_program_code_programs_code_fk" FOREIGN KEY ("program_code") REFERENCES "public"."programs"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "program_scores_program_year_idx" ON "program_scores" USING btree ("program_code","score_year");--> statement-breakpoint
CREATE INDEX "programs_university_idx" ON "programs" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "programs_level_idx" ON "programs" USING btree ("level");--> statement-breakpoint
-- APP-032: RLS on program reference data (mirrors the cities/universities pattern).
-- Global editorial reference: everyone reads, only SERVICE/ADMIN writes (yearly ÖSYM import).
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "programs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY programs_public_read ON "programs"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY programs_service_write ON "programs"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "program_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_scores" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY program_scores_public_read ON "program_scores"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY program_scores_service_write ON "program_scores"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
