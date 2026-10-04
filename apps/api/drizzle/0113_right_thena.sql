CREATE TABLE "mentorship_weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"locale" varchar(5) DEFAULT 'tr' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"source_fingerprint" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"brief" jsonb,
	"brief_locale" varchar(5),
	"brief_prompt_version" text,
	"coach_evaluation" text,
	"replaces_id" uuid,
	"operation_id" uuid,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_weekly_reports_status_check" CHECK ("mentorship_weekly_reports"."status" IN ('DRAFT', 'BRIEF_PENDING', 'BRIEF_READY', 'BRIEF_FAILED', 'FINALIZED')),
	CONSTRAINT "mentorship_weekly_reports_version_check" CHECK ("mentorship_weekly_reports"."version" >= 0),
	CONSTRAINT "mentorship_weekly_reports_locale_check" CHECK ("mentorship_weekly_reports"."locale" IN ('tr', 'en')),
	CONSTRAINT "mentorship_weekly_reports_brief_locale_check" CHECK ("mentorship_weekly_reports"."brief_locale" IS NULL OR "mentorship_weekly_reports"."brief_locale" IN ('tr', 'en')),
	CONSTRAINT "mentorship_weekly_reports_finalized_check" CHECK (("mentorship_weekly_reports"."status" = 'FINALIZED' AND "mentorship_weekly_reports"."version" > 0 AND "mentorship_weekly_reports"."finalized_at" IS NOT NULL) OR ("mentorship_weekly_reports"."status" <> 'FINALIZED' AND "mentorship_weekly_reports"."version" = 0 AND "mentorship_weekly_reports"."finalized_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ADD CONSTRAINT "mentorship_weekly_reports_link_id_coach_students_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."coach_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_weekly_reports" ADD CONSTRAINT "mentorship_weekly_reports_replaces_id_mentorship_weekly_reports_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."mentorship_weekly_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_weekly_reports_version_idx" ON "mentorship_weekly_reports" USING btree ("link_id","period_id","week_start","version");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_weekly_reports_operation_idx" ON "mentorship_weekly_reports" USING btree ("link_id","period_id","operation_id") WHERE "mentorship_weekly_reports"."operation_id" is not null;--> statement-breakpoint
CREATE INDEX "mentorship_weekly_reports_archive_idx" ON "mentorship_weekly_reports" USING btree ("link_id","period_id","finalized_at");--> statement-breakpoint
CREATE POLICY "mentorship_weekly_reports_service" ON "mentorship_weekly_reports" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');