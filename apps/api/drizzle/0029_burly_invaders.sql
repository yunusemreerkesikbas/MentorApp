CREATE TABLE "forum_post_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD COLUMN "parent_post_id" uuid;--> statement-breakpoint
ALTER TABLE "forum_post_reactions" ADD CONSTRAINT "forum_post_reactions_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_post_reactions" ADD CONSTRAINT "forum_post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_post_reactions_unique_idx" ON "forum_post_reactions" USING btree ("post_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "forum_post_reactions_post_idx" ON "forum_post_reactions" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_parent_post_id_forum_posts_id_fk" FOREIGN KEY ("parent_post_id") REFERENCES "public"."forum_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_posts_parent_idx" ON "forum_posts" USING btree ("parent_post_id");--> statement-breakpoint
-- ===================== RLS (§6/§4 #7) — comment (post) reactions =====================
-- Mirrors forum_reactions: a user sees only their OWN rows in user context (for myLiked);
-- cross-user counts run in SERVICE context. All writes run in SERVICE, policy-checked in the app.
ALTER TABLE "forum_post_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_post_reactions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_post_reactions_read ON "forum_post_reactions" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_post_reactions_write ON "forum_post_reactions" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
