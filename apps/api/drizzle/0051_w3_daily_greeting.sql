CREATE TABLE "ai_daily_greetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"greeting_date" date NOT NULL,
	"greeting" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_daily_greetings" ADD CONSTRAINT "ai_daily_greetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_daily_greetings_user_date_idx" ON "ai_daily_greetings" USING btree ("user_id","greeting_date");

-- ===================== RLS (ai_daily_greetings — per-user generated behavioral data) =====================
ALTER TABLE "ai_daily_greetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_daily_greetings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY ai_daily_greetings_self_or_service ON "ai_daily_greetings"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );
