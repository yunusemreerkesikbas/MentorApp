CREATE TABLE "forum_pending_attachments" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_pending_attachments" ADD CONSTRAINT "forum_pending_attachments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_pending_attachments_created_idx" ON "forum_pending_attachments" USING btree ("created_at");