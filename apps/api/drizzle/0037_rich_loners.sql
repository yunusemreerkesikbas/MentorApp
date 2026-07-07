CREATE TABLE "forum_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_bookmarks" ADD CONSTRAINT "forum_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_bookmarks_user_target_unique_idx" ON "forum_bookmarks" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "forum_bookmarks_user_created_idx" ON "forum_bookmarks" USING btree ("user_id","created_at");