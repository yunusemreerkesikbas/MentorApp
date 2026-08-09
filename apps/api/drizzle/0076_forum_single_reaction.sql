-- Custom SQL migration file, put your code below! --
DELETE FROM "forum_reactions" AS older
USING "forum_reactions" AS newer
WHERE older."thread_id" = newer."thread_id"
  AND older."user_id" = newer."user_id"
  AND (
    older."created_at" < newer."created_at"
    OR (older."created_at" = newer."created_at" AND older."id" < newer."id")
  );
--> statement-breakpoint
DELETE FROM "forum_post_reactions" AS older
USING "forum_post_reactions" AS newer
WHERE older."post_id" = newer."post_id"
  AND older."user_id" = newer."user_id"
  AND (
    older."created_at" < newer."created_at"
    OR (older."created_at" = newer."created_at" AND older."id" < newer."id")
  );
--> statement-breakpoint
DROP INDEX IF EXISTS "forum_reactions_unique_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "forum_reactions_unique_idx"
  ON "forum_reactions" USING btree ("thread_id", "user_id");
--> statement-breakpoint
DROP INDEX IF EXISTS "forum_post_reactions_unique_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "forum_post_reactions_unique_idx"
  ON "forum_post_reactions" USING btree ("post_id", "user_id");
