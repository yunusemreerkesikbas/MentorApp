-- APP-045: the mistake notebook's flashcard finally gets an answer on its back.
--
-- Hand-written for the reason 0074/0075/0077/0078 record: `drizzle-kit generate` still diffs
-- against a snapshot taken before 0074 was hand-written, so it re-emits statements the database
-- already has.
--
-- Until now the card's back carried what the mistake WAS -- error type, review count, the student's
-- own note -- but never what the answer was. Both columns are the student's own record of it:
-- nothing here is generated, and the photo still only ever categorises, never solves (AGENTS.md 4).
--
-- Nullable, with no backfill: a card without a solution is not a broken card, it is the normal
-- case for everything filed before today and for every entry whose owner never had the answer key
-- in front of them.
--
-- `solution_storage_key` lives under the same `notebook/{userId}/` R2 prefix as the question photo,
-- which means the orphan sweep sees it as a candidate for deletion. `listAllReferencedImageKeys`
-- MUST return this column too -- see the comment there.

ALTER TABLE "mistake_notebook_entries"
  ADD COLUMN "solution_storage_key" text;--> statement-breakpoint
ALTER TABLE "mistake_notebook_entries"
  ADD COLUMN "solution_note" text;
