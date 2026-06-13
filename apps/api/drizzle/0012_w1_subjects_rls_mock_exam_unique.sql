-- W1: RLS on editorial subject taxonomy (mirror exams public-read pattern)
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY subjects_public_read ON "subjects"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY subjects_service_write ON "subjects"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "exam_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exam_subjects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY exam_subjects_public_read ON "exam_subjects"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY exam_subjects_service_write ON "exam_subjects"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
-- W2: one row per subject per mock exam
CREATE UNIQUE INDEX "mock_exam_subjects_pair_idx" ON "mock_exam_subjects" USING btree ("mock_exam_id","subject_ref");
