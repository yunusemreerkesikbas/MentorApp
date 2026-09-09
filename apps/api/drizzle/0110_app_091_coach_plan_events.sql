CREATE TABLE "plan_event_attendees" (
	"event_id" uuid NOT NULL,
	"organizer_user_id" uuid NOT NULL,
	"attendee_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_event_attendees_event_id_attendee_user_id_pk" PRIMARY KEY("event_id","attendee_user_id")
);
--> statement-breakpoint
ALTER TABLE "plan_event_attendees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_event_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_user_id" uuid NOT NULL,
	"org_id" uuid,
	"frequency" text NOT NULL,
	"time_zone" text DEFAULT 'Europe/Istanbul' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"occurrence_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_event_series_id_organizer_unique" UNIQUE("id","organizer_user_id"),
	CONSTRAINT "plan_event_series_frequency_chk" CHECK ("plan_event_series"."frequency" in ('DAILY', 'WEEKLY', 'MONTHLY')),
	CONSTRAINT "plan_event_series_time_zone_chk" CHECK ("plan_event_series"."time_zone" = 'Europe/Istanbul'),
	CONSTRAINT "plan_event_series_end_chk" CHECK (("plan_event_series"."ends_on" is null) <> ("plan_event_series"."occurrence_count" is null)),
	CONSTRAINT "plan_event_series_end_date_chk" CHECK ("plan_event_series"."ends_on" is null or "plan_event_series"."ends_on" >= "plan_event_series"."starts_on"),
	CONSTRAINT "plan_event_series_count_chk" CHECK ("plan_event_series"."occurrence_count" is null or "plan_event_series"."occurrence_count" between 2 and 100)
);
--> statement-breakpoint
ALTER TABLE "plan_event_series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid,
	"organizer_user_id" uuid NOT NULL,
	"org_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_events_id_organizer_unique" UNIQUE("id","organizer_user_id"),
	CONSTRAINT "plan_events_status_chk" CHECK ("plan_events"."status" in ('SCHEDULED', 'CANCELLED')),
	CONSTRAINT "plan_events_time_range_chk" CHECK ("plan_events"."end_time" is null or ("plan_events"."start_time" is not null and "plan_events"."end_time" > "plan_events"."start_time"))
);
--> statement-breakpoint
ALTER TABLE "plan_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mentorship_dropped_assignments" ADD COLUMN "assignment_group_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD COLUMN "assignment_group_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_event_attendees" ADD CONSTRAINT "plan_event_attendees_attendee_user_id_users_id_fk" FOREIGN KEY ("attendee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_event_attendees" ADD CONSTRAINT "plan_event_attendees_event_organizer_fk" FOREIGN KEY ("event_id","organizer_user_id") REFERENCES "public"."plan_events"("id","organizer_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_event_series" ADD CONSTRAINT "plan_event_series_organizer_user_id_users_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_event_series" ADD CONSTRAINT "plan_event_series_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_organizer_user_id_users_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_series_organizer_fk" FOREIGN KEY ("series_id","organizer_user_id") REFERENCES "public"."plan_event_series"("id","organizer_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_event_attendees_attendee_idx" ON "plan_event_attendees" USING btree ("attendee_user_id","event_id");--> statement-breakpoint
CREATE INDEX "plan_event_series_organizer_start_idx" ON "plan_event_series" USING btree ("organizer_user_id","starts_on");--> statement-breakpoint
CREATE INDEX "plan_events_organizer_date_idx" ON "plan_events" USING btree ("organizer_user_id","event_date");--> statement-breakpoint
CREATE INDEX "plan_events_series_date_idx" ON "plan_events" USING btree ("series_id","event_date");--> statement-breakpoint
CREATE INDEX "mentorship_dropped_assignments_group_idx" ON "mentorship_dropped_assignments" USING btree ("assignment_group_id");--> statement-breakpoint
CREATE INDEX "plan_tasks_assignment_group_idx" ON "plan_tasks" USING btree ("assignment_group_id");--> statement-breakpoint
CREATE POLICY "plan_event_attendees_read" ON "plan_event_attendees" AS PERMISSIVE FOR SELECT TO public USING ("plan_event_attendees"."attendee_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR "plan_event_attendees"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "plan_event_attendees_write" ON "plan_event_attendees" AS PERMISSIVE FOR ALL TO public USING ("plan_event_attendees"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("plan_event_attendees"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "plan_event_series_owner" ON "plan_event_series" AS PERMISSIVE FOR ALL TO public USING ("plan_event_series"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("plan_event_series"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "plan_events_read" ON "plan_events" AS PERMISSIVE FOR SELECT TO public USING ("plan_events"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR EXISTS (
        SELECT 1 FROM plan_event_attendees
        WHERE plan_event_attendees.event_id = "plan_events"."id"
          AND plan_event_attendees.attendee_user_id = nullif(current_setting('app.user_id', true), '')::uuid
      ) OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "plan_events_write" ON "plan_events" AS PERMISSIVE FOR ALL TO public USING ("plan_events"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("plan_events"."organizer_user_id" = nullif(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SERVICE');