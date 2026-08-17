CREATE TABLE "forum_tag_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_name" text NOT NULL,
	"normalized_slug" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"suggested_by" uuid,
	"resolved_tag_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_tag_suggestions_status_check" CHECK ("forum_tag_suggestions"."status" in ('PENDING', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "forum_tag_suggestions" ADD CONSTRAINT "forum_tag_suggestions_suggested_by_users_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_tag_suggestions" ADD CONSTRAINT "forum_tag_suggestions_resolved_tag_id_forum_tags_id_fk" FOREIGN KEY ("resolved_tag_id") REFERENCES "public"."forum_tags"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_tag_suggestions" ADD CONSTRAINT "forum_tag_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "forum_tag_suggestions_pending_slug_idx" ON "forum_tag_suggestions" USING btree ("normalized_slug") WHERE "forum_tag_suggestions"."status" = 'PENDING';
--> statement-breakpoint
CREATE INDEX "forum_tag_suggestions_status_created_idx" ON "forum_tag_suggestions" USING btree ("status","created_at");
--> statement-breakpoint
ALTER TABLE "forum_tag_suggestions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "forum_tag_suggestions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY forum_tag_suggestions_service_all ON "forum_tag_suggestions" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
