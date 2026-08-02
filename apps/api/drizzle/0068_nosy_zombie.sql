CREATE TABLE "coach_memory_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text NOT NULL,
	"source_message_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_memory_facts_source_consistency_chk" CHECK ((
        ("coach_memory_facts"."source" = 'CHAT' and "coach_memory_facts"."source_message_id" is not null)
        or
        ("coach_memory_facts"."source" = 'USER_EDIT' and "coach_memory_facts"."source_message_id" is null)
      ))
);
--> statement-breakpoint
CREATE TABLE "coach_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"calibration_status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"memory_consent" text DEFAULT 'PENDING' NOT NULL,
	"support_preference" text,
	"directness_preference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_tasks" DROP CONSTRAINT "plan_tasks_origin_consistency_chk";--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "request_context" jsonb;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "action" jsonb;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "action_status" text;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "action_result_ref_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_memory_facts" ADD CONSTRAINT "coach_memory_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_memory_facts" ADD CONSTRAINT "coach_memory_facts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_memory_facts" ADD CONSTRAINT "coach_memory_facts_source_message_id_coach_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."coach_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_memory_facts_user_updated_idx" ON "coach_memory_facts" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_memory_facts_user_key_idx" ON "coach_memory_facts" USING btree ("user_id","key");--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_action_consistency_chk" CHECK ((
        ("coach_messages"."action" is null and "coach_messages"."action_status" is null and "coach_messages"."action_result_ref_id" is null)
        or
        ("coach_messages"."action" is not null and "coach_messages"."action_status" in ('PROPOSED', 'ACCEPTED', 'COMPLETED', 'CANCELLED'))
      ));--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_origin_consistency_chk" CHECK ((
        ("plan_tasks"."origin_type" is null and "plan_tasks"."origin_ref_id" is null and "plan_tasks"."origin_meta" is null)
        or
        ("plan_tasks"."origin_type" in ('COMMUNITY_COACH', 'AI_COACH') and "plan_tasks"."origin_ref_id" is not null and "plan_tasks"."origin_meta" is not null)
      ));--> statement-breakpoint
CREATE TRIGGER coach_profiles_set_updated_at BEFORE UPDATE ON "coach_profiles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER coach_memory_facts_set_updated_at BEFORE UPDATE ON "coach_memory_facts"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE "coach_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY coach_profiles_self_or_service ON "coach_profiles"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );--> statement-breakpoint
ALTER TABLE "coach_memory_facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_memory_facts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY coach_memory_facts_self_or_service ON "coach_memory_facts"
  FOR ALL
  USING (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'SERVICE'
    OR user_id = current_setting('app.user_id', true)::uuid
  );
