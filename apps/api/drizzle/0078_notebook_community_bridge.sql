-- APP-042: mistake notebook <-> community bridge.
--
-- Hand-written for the reason 0074/0075/0077 record: `drizzle-kit generate` still diffs against a
-- snapshot taken before 0074 was hand-written, so it re-emits statements the database already has.
--
-- These three columns were deliberately left out of 0077 (YAGNI -- every entry was the user's own).
-- They arrive now that the bridge exists.
--
-- `community_thread_id` carries NO foreign key on purpose. Threads belong to the forum's bounded
-- context; a database-level edge would make coaching's table depend on forum's, which is exactly
-- the coupling the module rules forbid. A deleted thread leaves a dangling id that reads as
-- "no thread" -- the same soft-ref rule `exam_id` already follows.

ALTER TABLE "mistake_notebook_entries"
  ADD COLUMN "source" text DEFAULT 'OWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_notebook_entries"
  ADD COLUMN "community_thread_id" uuid;--> statement-breakpoint
ALTER TABLE "mistake_notebook_entries"
  ADD COLUMN "community_answered_at" timestamp with time zone;--> statement-breakpoint

-- The accepted-answer listener looks entries up BY thread, which is the only query that needs this.
CREATE INDEX "mistake_notebook_thread_idx"
  ON "mistake_notebook_entries" ("community_thread_id")
  WHERE "community_thread_id" IS NOT NULL;
