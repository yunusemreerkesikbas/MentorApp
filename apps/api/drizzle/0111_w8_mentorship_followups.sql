CREATE TABLE "mentorship_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"title" varchar(120) NOT NULL,
	"private_note" text,
	"shared_decision" text,
	"response" text DEFAULT 'PENDING' NOT NULL,
	"follow_up_date" date,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"replaces_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "mentorship_followups_status_check" CHECK ("mentorship_followups"."status" IN ('OPEN', 'COMPLETED', 'CANCELLED')),
	CONSTRAINT "mentorship_followups_response_check" CHECK ("mentorship_followups"."response" IN ('PENDING', 'ACCEPTED', 'CHANGE_REQUESTED')),
	CONSTRAINT "mentorship_followups_version_check" CHECK ("mentorship_followups"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "mentorship_followups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "period_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "mentorship_followups" ADD CONSTRAINT "mentorship_followups_link_id_coach_students_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."coach_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_followups" ADD CONSTRAINT "mentorship_followups_replaces_id_mentorship_followups_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."mentorship_followups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_followups_operation_idx" ON "mentorship_followups" USING btree ("link_id","period_id","operation_id");--> statement-breakpoint
CREATE INDEX "mentorship_followups_period_idx" ON "mentorship_followups" USING btree ("link_id","period_id","created_at");--> statement-breakpoint
CREATE INDEX "mentorship_followups_due_idx" ON "mentorship_followups" USING btree ("status","follow_up_date");--> statement-breakpoint
CREATE POLICY "mentorship_followups_service" ON "mentorship_followups" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');
