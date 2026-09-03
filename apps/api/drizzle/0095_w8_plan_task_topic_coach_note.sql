ALTER TABLE "plan_tasks" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD COLUMN "coach_note" text;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_coach_note_origin_chk" CHECK ("plan_tasks"."coach_note" is null or "plan_tasks"."origin_type" = 'MENTORSHIP');--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_topic_requires_subject_chk" CHECK ("plan_tasks"."topic" is null or "plan_tasks"."subject" is not null);