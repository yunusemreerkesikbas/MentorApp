CREATE TABLE "ai_chat_quota_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_quota_attempts" ADD CONSTRAINT "ai_chat_quota_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chat_quota_attempts_user_created_idx" ON "ai_chat_quota_attempts" USING btree ("user_id","created_at");
--> statement-breakpoint
ALTER TABLE "ai_chat_quota_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_chat_quota_attempts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_chat_quota_attempts_service" ON "ai_chat_quota_attempts"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
