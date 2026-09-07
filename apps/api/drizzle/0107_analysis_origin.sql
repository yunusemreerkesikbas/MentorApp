ALTER TABLE "plan_tasks" DROP CONSTRAINT "plan_tasks_origin_consistency_chk";--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_origin_consistency_chk" CHECK ((
        ("plan_tasks"."origin_type" is null and "plan_tasks"."origin_ref_id" is null and "plan_tasks"."origin_meta" is null)
        or
        ("plan_tasks"."origin_type" in ('COMMUNITY_COACH', 'AI_COACH', 'ANALYSIS') and "plan_tasks"."origin_ref_id" is not null and "plan_tasks"."origin_meta" is not null)
        or
        ("plan_tasks"."origin_type" = 'MENTORSHIP' and "plan_tasks"."origin_ref_id" is not null and "plan_tasks"."origin_meta" is null)
      ));