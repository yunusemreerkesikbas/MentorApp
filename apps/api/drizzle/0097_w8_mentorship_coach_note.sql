-- W8 · the coach's standing note to a student, shown on their /my-coach screen.
--
-- One column, overwritten in place: a note, not a thread. Phase-2 communication stays off-platform
-- and in-app chat is Phase 3 (roadmap §9), so there is no history table and nothing to moderate.
--
-- Named after `plan_tasks.coach_note` on purpose: same voice (the coach's own words, never mixed
-- into the student's `description`), different scope — that one rides a task, this one stands alone.
--
-- Nullable columns only, no CHECK or FK, so no NOT VALID split is needed even though
-- `coach_students` is not empty.
ALTER TABLE "coach_students" ADD COLUMN "coach_note" text;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "coach_note_at" timestamp with time zone;