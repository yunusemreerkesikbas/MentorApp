-- W8 · a week the coach saved to reuse on another student.
--
-- The real bottleneck at the 20-student quota is rewriting the same program by hand. A template
-- stores day offsets from its own first day, never dates, because the point is that it can be
-- re-dated onto whatever week the composer is parked on.
--
-- `tasks` is jsonb rather than a child table: the array is bounded by the 21-task ceiling the
-- assignment schema already enforces, it is always read and written whole, and it is never queried
-- by field. A second table would only be a second join.
--
-- UNIQUE (coach_id, name) is the upsert key. Saving under an existing name overwrites, which is
-- how a template is edited; there is deliberately no separate update endpoint.
--
-- The FK carries no NOT VALID: the table is created empty in this same migration, so there is no
-- existing row to scan (backend.md's rule targets constraints added to non-empty tables).
-- ON DELETE CASCADE is not the whole erasure story here, unlike `mentorship_dropped_assignments`:
-- MentorshipErasureService ANONYMIZES the `users` row rather than deleting it, so no cascade
-- fires and the service purges templates explicitly.
--
-- No RLS policy — same as `mentorship_invite_codes`: SERVICE context, scoped by `coach_id` in the
-- repository.

CREATE TABLE "mentorship_program_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"name" text NOT NULL,
	"exam_type" text,
	"tasks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentorship_program_templates" ADD CONSTRAINT "mentorship_program_templates_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_program_templates_coach_name_idx" ON "mentorship_program_templates" USING btree ("coach_id","name");--> statement-breakpoint
CREATE INDEX "mentorship_program_templates_coach_idx" ON "mentorship_program_templates" USING btree ("coach_id","updated_at");