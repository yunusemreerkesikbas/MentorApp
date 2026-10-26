CREATE TABLE "ad_question_reviews" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"content_revision" text NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_question_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_question_reviews" ADD CONSTRAINT "ad_question_reviews_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_question_reviews" ADD CONSTRAINT "ad_question_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "ad_question_reviews_service" ON "ad_question_reviews" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');
--> statement-breakpoint
ALTER TABLE "ad_question_reviews" FORCE ROW LEVEL SECURITY;
