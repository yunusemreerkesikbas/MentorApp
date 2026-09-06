-- W8 · the coach's "I have dealt with this student" mark.
--
-- Third pair of nullable columns on the link, after `coach_note` (0097) and `brief` (0100), and
-- for the same reason: one fact per relationship, overwritten in place, no table of its own. KVKK
-- comes free — MentorshipErasureService deletes link rows outright, so the mark goes with them.
--
-- `attended_flags` stores the flags the coach saw at mark time rather than recomputing them,
-- because that snapshot is the only thing that can tell "still the same problem" from "a new one
-- since you looked". The rule that reads both columns lives in `mentorship/domain/attention.ts`
-- and is shared with the daily risk digest, so the panel and the morning email agree about who
-- still needs the coach.
--
-- `end()` clears both, like the note and the brief: re-linking revives this very row, and an old
-- mark would open a new relationship looking calm.
--
-- Nullable columns only: no CHECK, no FK, so no NOT VALID split is needed on a populated table.

ALTER TABLE "coach_students" ADD COLUMN "attended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "attended_flags" text[];
