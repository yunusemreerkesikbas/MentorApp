-- W8 · the coach's cohort brief, one row per coach.
--
-- Unlike 0100 (the per-student brief, which lives on `coach_students` because it is one text per
-- relationship), this one is about the roster as a whole and has no link row to sit on. Hence a
-- table — the smallest one that answers the two questions a regeneration asks: "is the cohort the
-- same as when I last wrote?" (`fingerprint`) and "which of these lines did I already report?"
-- (`pairs`).
--
-- No history. The next brief needs exactly one thing from the last one, and that thing is `pairs`;
-- the morning digest makes the identical argument for reading its baseline off the previous
-- notification instead of keeping a state table.
--
-- `coach_id` is the primary key, not a surrogate: there is one current brief per coach, and
-- putting that in the key means no query can read a stale one by accident.
--
-- New, empty table, so the FK needs no NOT VALID / VALIDATE split (standards/backend.md).
-- ON DELETE CASCADE does NOT cover KVKK: erasure anonymizes `users` rather than deleting them, so
-- MentorshipErasureService purges this table explicitly — the same trap as templates (0097) and
-- applications (0105).

CREATE TABLE "mentorship_cohort_briefs" (
	"coach_id" uuid PRIMARY KEY NOT NULL,
	"brief" jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"pairs" text[] DEFAULT '{}'::text[] NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentorship_cohort_briefs" ADD CONSTRAINT "mentorship_cohort_briefs_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;