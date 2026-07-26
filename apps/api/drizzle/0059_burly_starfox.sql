ALTER TABLE "plan_tasks" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_time_range_chk"
  CHECK (("end_time" IS NULL) OR ("start_time" IS NOT NULL AND "end_time" > "start_time"));