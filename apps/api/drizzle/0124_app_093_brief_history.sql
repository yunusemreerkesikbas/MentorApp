CREATE TABLE "mentorship_student_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"brief" text NOT NULL,
	"model" text NOT NULL,
	"fingerprint" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"delta" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentorship_student_briefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mentorship_student_briefs" ADD CONSTRAINT "mentorship_student_briefs_link_id_coach_students_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."coach_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentorship_student_briefs_period_idx" ON "mentorship_student_briefs" USING btree ("link_id","period_id","generated_at");--> statement-breakpoint
CREATE POLICY "mentorship_student_briefs_service" ON "mentorship_student_briefs" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');