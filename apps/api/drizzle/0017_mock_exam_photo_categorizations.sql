CREATE TABLE "mock_exam_photo_categorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mock_exam_id" uuid NOT NULL,
	"subject_ref" text NOT NULL,
	"storage_key" text NOT NULL,
	"client_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mock_exam_photo_categorizations" ADD CONSTRAINT "mock_exam_photo_categorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_exam_photo_categorizations" ADD CONSTRAINT "mock_exam_photo_categorizations_mock_exam_id_mock_exams_id_fk" FOREIGN KEY ("mock_exam_id") REFERENCES "public"."mock_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mock_exam_photo_cat_user_created_idx" ON "mock_exam_photo_categorizations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mock_exam_photo_cat_mock_idx" ON "mock_exam_photo_categorizations" USING btree ("mock_exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mock_exam_photo_cat_client_req_idx" ON "mock_exam_photo_categorizations" USING btree ("user_id","client_request_id");--> statement-breakpoint
-- ===================== RLS (mock_exam_photo_categorizations — per-user behavioral data) =====================
ALTER TABLE "mock_exam_photo_categorizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mock_exam_photo_categorizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mock_exam_photo_cat_self_or_service ON "mock_exam_photo_categorizations"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );
