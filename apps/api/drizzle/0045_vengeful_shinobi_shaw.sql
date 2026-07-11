CREATE TABLE "ai_weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"locale" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"narration" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_weekly_reviews" ADD CONSTRAINT "ai_weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_weekly_reviews_user_exam_week_locale_idx" ON "ai_weekly_reviews" USING btree ("user_id","exam_id","week_start","locale");

-- ===================== RLS (ai_weekly_reviews — per-user generated behavioral data) =====================
ALTER TABLE "ai_weekly_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_weekly_reviews" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY ai_weekly_reviews_self_or_service ON "ai_weekly_reviews"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );

