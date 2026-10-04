-- W8 (QA F4, 2026-09-27) · the student's standing note to their coach, the mirror of coach_note.
--
-- One column, overwritten in place: a note, not a thread (in-app chat stays Phase 3, roadmap §9).
-- The student writes it for this coach; the coach reads it on the student's report. Cleared when
-- the link ends, like coach_note, because re-linking revives the same row.
--
-- Nullable columns only, no CHECK or FK, so no NOT VALID split is needed.
ALTER TABLE "coach_students" ADD COLUMN "student_note" text;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "student_note_at" timestamp with time zone;