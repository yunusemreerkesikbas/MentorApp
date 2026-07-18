CREATE TABLE "streak_freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "streak_freezes" ADD CONSTRAINT "streak_freezes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "streak_freezes_user_date_unique_idx" ON "streak_freezes" USING btree ("user_id","date");--> statement-breakpoint
ALTER TABLE "streak_freezes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "streak_freezes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY streak_freezes_self_or_service ON "streak_freezes"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );