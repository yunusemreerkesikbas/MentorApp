-- W8 · the coach's AI brief, cached on the link.
--
-- No table of its own. The brief is one text per relationship, overwritten in place — the same
-- shape as `coach_note`, which already lives here for the same reason. Living on the link is also
-- the entire KVKK story: MentorshipErasureService deletes link rows outright, so the brief goes
-- with them and the erasure service needs no new clause.
--
-- `brief_fingerprint` hashes the report the brief was written from. An unchanged report returns
-- the stored text instead of paying an LLM to write the same summary twice; a changed one misses
-- and regenerates. `end()` clears all three, because re-linking revives this very row and a brief
-- about a relationship both sides walked away from must not come back months later.
--
-- Nullable columns only: no CHECK, no FK, so no NOT VALID split is needed even though
-- `coach_students` is a populated table.

ALTER TABLE "coach_students" ADD COLUMN "brief" text;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "brief_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "brief_fingerprint" text;