CREATE TABLE "forum_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_zone_id_forum_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."forum_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_reactions_unique_idx" ON "forum_reactions" USING btree ("thread_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "forum_reactions_thread_idx" ON "forum_reactions" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "forum_threads_zone_created_idx" ON "forum_threads" USING btree ("zone_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_threads_zone_pinned_idx" ON "forum_threads" USING btree ("zone_id") WHERE "forum_threads"."is_pinned";--> statement-breakpoint
-- ===================== RLS (§6/§4 #7) — feed threads + reactions =====================
-- Reads RLS-gated (non-deleted threads to any authed user; own reactions to self). All writes +
-- aggregate reads (reaction counts) run in SERVICE context, policy-checked in app (forum.policy.ts).
-- Zone visibility/membership is enforced one layer up (service fetches the RLS-gated zone first).
ALTER TABLE "forum_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_threads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_threads_read ON "forum_threads" FOR SELECT
  USING (
    (deleted_at IS NULL AND current_setting('app.user_id', true) <> '')
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_threads_write ON "forum_threads" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "forum_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_reactions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_reactions_read ON "forum_reactions" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_reactions_write ON "forum_reactions" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint
CREATE TRIGGER forum_threads_set_updated_at BEFORE UPDATE ON "forum_threads"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();