-- W8 slice 3: a human coach's assignment as a plan-task origin.
--
-- `MENTORSHIP` rows carry `origin_ref_id = coach_students.id` and NO `origin_meta`: the coach's
-- name is resolved when the row is read, not copied into jsonb, so KVKK erasure has no duplicate
-- to chase. The other two origins keep their meta-required shape unchanged.
ALTER TABLE "plan_tasks" DROP CONSTRAINT "plan_tasks_origin_consistency_chk";--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_origin_consistency_chk" CHECK ((
        ("plan_tasks"."origin_type" is null and "plan_tasks"."origin_ref_id" is null and "plan_tasks"."origin_meta" is null)
        or
        ("plan_tasks"."origin_type" in ('COMMUNITY_COACH', 'AI_COACH') and "plan_tasks"."origin_ref_id" is not null and "plan_tasks"."origin_meta" is not null)
        or
        ("plan_tasks"."origin_type" = 'MENTORSHIP' and "plan_tasks"."origin_ref_id" is not null and "plan_tasks"."origin_meta" is null)
      ));