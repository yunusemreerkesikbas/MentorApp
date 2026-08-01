ALTER TABLE "plan_tasks" ADD COLUMN "origin_type" text;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD COLUMN "origin_ref_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD COLUMN "origin_meta" jsonb;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_origin_consistency_chk" CHECK ((
        ("plan_tasks"."origin_type" is null and "plan_tasks"."origin_ref_id" is null and "plan_tasks"."origin_meta" is null)
        or
        ("plan_tasks"."origin_type" = 'COMMUNITY_COACH' and "plan_tasks"."origin_ref_id" is not null and "plan_tasks"."origin_meta" is not null)
      ));