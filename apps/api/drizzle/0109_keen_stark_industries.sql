CREATE TABLE "notebook_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"entry_id" uuid NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"solved" boolean NOT NULL,
	"early" boolean NOT NULL,
	"before_status" text NOT NULL,
	"after_status" text NOT NULL,
	"before_count" integer NOT NULL,
	"after_count" integer NOT NULL,
	"next_review_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notebook_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notebook_reviews" ADD CONSTRAINT "notebook_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_reviews" ADD CONSTRAINT "notebook_reviews_entry_id_mistake_notebook_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."mistake_notebook_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebook_reviews_user_time_idx" ON "notebook_reviews" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "notebook_reviews_entry_idx" ON "notebook_reviews" USING btree ("entry_id");--> statement-breakpoint
CREATE POLICY "notebook_reviews_owner" ON "notebook_reviews" AS PERMISSIVE FOR ALL TO public USING ("notebook_reviews"."user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("notebook_reviews"."user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE');
