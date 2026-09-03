-- W8 · append-only log of coach-assigned tasks the student deleted.
--
-- The student report renders the LIVING plan, so a deleted assignment left no trace and the coach
-- read its absence as "never assigned". Only deletion loses information: a completed task stays in
-- the plan marked DONE, and a MENTORSHIP task cannot be retitled or moved.
--
-- The FK carries no NOT VALID: the table is created empty in this same migration, so there is no
-- existing row to scan and no ACCESS EXCLUSIVE lock worth avoiding (backend.md's rule targets
-- constraints added to non-empty tables such as `plan_tasks`).
--
-- ON DELETE CASCADE is the whole KVKK story: MentorshipErasureService deletes `coach_students`
-- rows outright rather than anonymizing them, so the drops go with the link.
CREATE TABLE "mentorship_dropped_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"task_title" text NOT NULL,
	"task_date" date NOT NULL,
	"dropped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentorship_dropped_assignments" ADD CONSTRAINT "mentorship_dropped_assignments_link_id_coach_students_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."coach_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentorship_dropped_assignments_link_idx" ON "mentorship_dropped_assignments" USING btree ("link_id","dropped_at");