CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"question_count" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"total_net" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_exam_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mock_exam_id" uuid NOT NULL,
	"subject_ref" text NOT NULL,
	"correct" integer NOT NULL,
	"wrong" integer NOT NULL,
	"blank" integer NOT NULL,
	"net" numeric(6, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_exam_subjects" ADD CONSTRAINT "mock_exam_subjects_mock_exam_id_mock_exams_id_fk" FOREIGN KEY ("mock_exam_id") REFERENCES "public"."mock_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_slug_unique_idx" ON "subjects" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_subjects_pair_idx" ON "exam_subjects" USING btree ("exam_id","subject_id");--> statement-breakpoint
CREATE INDEX "mock_exams_user_taken_idx" ON "mock_exams" USING btree ("user_id","taken_at");--> statement-breakpoint
CREATE INDEX "mock_exam_subjects_mock_idx" ON "mock_exam_subjects" USING btree ("mock_exam_id");--> statement-breakpoint
CREATE TRIGGER subjects_set_updated_at BEFORE UPDATE ON "subjects"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER mock_exams_set_updated_at BEFORE UPDATE ON "mock_exams"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- ===================== RLS (mock_exams — per-user behavioral data) =====================
ALTER TABLE "mock_exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mock_exams" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mock_exams_self_or_service ON "mock_exams"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
ALTER TABLE "mock_exam_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mock_exam_subjects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mock_exam_subjects_self_or_service ON "mock_exam_subjects"
  USING (
    EXISTS (
      SELECT 1 FROM mock_exams m
      WHERE m.id = mock_exam_subjects.mock_exam_id
        AND (
          m.user_id::text = current_setting('app.user_id', true)
          OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_exams m
      WHERE m.id = mock_exam_subjects.mock_exam_id
        AND (
          m.user_id::text = current_setting('app.user_id', true)
          OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
        )
    )
  );
