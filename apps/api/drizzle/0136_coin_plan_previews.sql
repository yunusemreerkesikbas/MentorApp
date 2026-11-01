CREATE TABLE "ai_plan_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"locale" text NOT NULL,
	"status" text NOT NULL,
	"cost" integer NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_plan_previews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_plan_previews" ADD CONSTRAINT "ai_plan_previews_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_plan_previews" ADD CONSTRAINT "ai_plan_previews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_plan_previews_request_uq" ON "ai_plan_previews" USING btree ("user_id","client_request_id");--> statement-breakpoint
CREATE INDEX "ai_plan_previews_user_time_idx" ON "ai_plan_previews" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE POLICY "ai_plan_previews_service" ON "ai_plan_previews" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');