CREATE TABLE "ai_weekly_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"exam_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"locale" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cost" integer NOT NULL,
	"review" jsonb NOT NULL,
	"narration" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_weekly_recaps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_weekly_recaps" ADD CONSTRAINT "ai_weekly_recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_weekly_recaps" ADD CONSTRAINT "ai_weekly_recaps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_weekly_recaps_identity_uq" ON "ai_weekly_recaps" USING btree ("user_id","exam_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_weekly_recaps_request_uq" ON "ai_weekly_recaps" USING btree ("user_id","client_request_id");--> statement-breakpoint
CREATE INDEX "ai_weekly_recaps_archive_idx" ON "ai_weekly_recaps" USING btree ("user_id","opened_at");--> statement-breakpoint
CREATE POLICY "ai_weekly_recaps_service" ON "ai_weekly_recaps" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');