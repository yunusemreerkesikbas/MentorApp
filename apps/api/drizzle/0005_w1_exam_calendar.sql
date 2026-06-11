CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"variant" text,
	"net_rule" jsonb NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"type" text NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verified_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exams_slug_unique_idx" ON "exams" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "exams_family_idx" ON "exams" USING btree ("family");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_events_exam_type_unique_idx" ON "exam_events" USING btree ("exam_id","type");--> statement-breakpoint
CREATE INDEX "exam_events_exam_type_idx" ON "exam_events" USING btree ("exam_id","type");--> statement-breakpoint
CREATE TRIGGER exams_set_updated_at BEFORE UPDATE ON "exams"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER exam_events_set_updated_at BEFORE UPDATE ON "exam_events"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- ===================== RLS (public read, service/admin write) =====================
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY exams_public_read ON "exams"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY exams_service_write ON "exams"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "exam_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exam_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY exam_events_public_read ON "exam_events"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY exam_events_service_write ON "exam_events"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
