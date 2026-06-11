CREATE TABLE "daily_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_date" date NOT NULL,
	"has_session" boolean DEFAULT false NOT NULL,
	"tasks_done" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"checkin_date" date NOT NULL,
	"mood" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_date" date NOT NULL,
	"title" text NOT NULL,
	"subject" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streak_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"freeze_tokens" integer DEFAULT 2 NOT NULL,
	"last_active_date" date,
	"freeze_month" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"preset" text NOT NULL,
	"actual_focus_seconds" integer DEFAULT 0 NOT NULL,
	"subject" text,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_state" ADD CONSTRAINT "streak_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_activity_user_date_unique_idx" ON "daily_activity" USING btree ("user_id","activity_date");--> statement-breakpoint
CREATE UNIQUE INDEX "mood_checkins_user_date_unique_idx" ON "mood_checkins" USING btree ("user_id","checkin_date");--> statement-breakpoint
CREATE INDEX "plan_tasks_user_date_idx" ON "plan_tasks" USING btree ("user_id","task_date");--> statement-breakpoint
CREATE UNIQUE INDEX "streak_state_user_unique_idx" ON "streak_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_started_idx" ON "study_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
-- updated_at triggers (shared set_updated_at() from 0000)
CREATE TRIGGER plan_tasks_set_updated_at BEFORE UPDATE ON "plan_tasks"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER study_sessions_set_updated_at BEFORE UPDATE ON "study_sessions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER daily_activity_set_updated_at BEFORE UPDATE ON "daily_activity"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER streak_state_set_updated_at BEFORE UPDATE ON "streak_state"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER mood_checkins_set_updated_at BEFORE UPDATE ON "mood_checkins"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- ===================== RLS (double belt — §8) =====================
-- Every coaching table is per-user behavioral data. Policies read tx-scoped GUCs set by
-- withUserContext (database/rls.ts). FORCE makes the table owner obey RLS too (our pool
-- connects as owner). SERVICE/ADMIN bypass is kept for trusted server/admin paths.
ALTER TABLE "plan_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_tasks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY plan_tasks_self_or_service ON "plan_tasks"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
ALTER TABLE "study_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY study_sessions_self_or_service ON "study_sessions"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
ALTER TABLE "daily_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_activity" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY daily_activity_self_or_service ON "daily_activity"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
ALTER TABLE "streak_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "streak_state" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY streak_state_self_or_service ON "streak_state"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
ALTER TABLE "mood_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mood_checkins" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY mood_checkins_self_or_service ON "mood_checkins"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );