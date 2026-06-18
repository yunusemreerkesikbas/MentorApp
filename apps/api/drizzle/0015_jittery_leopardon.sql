CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_created_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
-- ===================== RLS (§8/§9) — AI usage metering =====================
-- The user reads own usage; SERVICE/ADMIN any. Writes (metering) run in SERVICE context.
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_usage" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY ai_usage_self_read ON "ai_usage" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY ai_usage_service_write ON "ai_usage"
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));