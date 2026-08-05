-- APP-036: vision board collage document.
--
-- Hand-written rather than generated, for the same reason 0074 is: `drizzle-kit generate` still
-- diffs against `meta/0073_snapshot.json`, because 0074 was hand-written and never produced a
-- snapshot. Running the generator today re-emits every 0074 statement (dataset_id, the composite
-- primary key, the indexes) on top of a database that already has them, so the generated file
-- would fail on migrate. One nullable column does not need the generator.
--
-- `board` holds `{ version, status, frame, background, items[] }`; NULL means the user has a goal
-- but has never opened the board editor. Nullable and default-free on purpose: a default would
-- make every existing goal look like an empty published board.

ALTER TABLE "vision_boards" ADD COLUMN "board" jsonb;
