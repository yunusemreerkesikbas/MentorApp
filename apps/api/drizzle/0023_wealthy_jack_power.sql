CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "status" text DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "accepted_post_id" uuid;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_posts_thread_created_idx" ON "forum_posts" USING btree ("thread_id","created_at");--> statement-breakpoint
-- ===================== RLS (§6/§4 #7) — QA answers =====================
-- Mirrors forum_threads: non-deleted answers readable by any authed user (or SERVICE/ADMIN);
-- all writes run in SERVICE context, policy-checked in the app (forum.policy.ts).
ALTER TABLE "forum_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_posts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_posts_read ON "forum_posts" FOR SELECT
  USING (
    (deleted_at IS NULL AND current_setting('app.user_id', true) <> '')
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_posts_write ON "forum_posts" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER forum_posts_set_updated_at BEFORE UPDATE ON "forum_posts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- Full-text search over QA questions (title + body). Expression GIN index (immutable regconfig);
-- no stored column/trigger. Queried with `... @@ websearch_to_tsquery('turkish', $q)`.
CREATE INDEX "forum_threads_search_idx" ON "forum_threads"
  USING gin (to_tsvector('turkish', coalesce(title, '') || ' ' || body));