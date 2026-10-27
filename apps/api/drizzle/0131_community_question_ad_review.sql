ALTER TABLE "ad_question_reviews" ADD COLUMN "community_content_revision" text;--> statement-breakpoint
ALTER TABLE "ad_question_reviews" ADD COLUMN "community_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "ad_question_reviews" ADD COLUMN "community_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ad_question_reviews" ADD CONSTRAINT "ad_question_reviews_community_reviewed_by_users_id_fk" FOREIGN KEY ("community_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;