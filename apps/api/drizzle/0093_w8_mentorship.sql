-- W8 · mentorship (human coach <-> student).
--
-- `coach_students` has existed since 0001 but was never written to (org/coach-ready schema, guardrail
-- #7). This slice puts it to work: lifecycle timestamps, the indexes the roster actually queries, and
-- the invariants that were only prose before (status/source allowlists, one active coach per student).
--
-- No RLS policy on either table: cross-user relations follow the `buddy_pairs` / `study_room_members`
-- pattern (SERVICE context + application-layer scoping via MentorshipLinkService.requireActiveLink).
-- Student behavioural tables keep their existing self-or-service policies untouched.
CREATE TABLE "mentorship_invite_codes" (
	"coach_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_students" ADD COLUMN "ended_by" uuid;--> statement-breakpoint
ALTER TABLE "mentorship_invite_codes" ADD CONSTRAINT "mentorship_invite_codes_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_invite_codes_code_unique_idx" ON "mentorship_invite_codes" USING btree ("code");--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_ended_by_users_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_students_student_idx" ON "coach_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "coach_students_coach_status_idx" ON "coach_students" USING btree ("coach_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_students_one_active_coach_idx" ON "coach_students" USING btree ("student_id") WHERE status = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_status_chk" CHECK ("coach_students"."status" in ('PENDING', 'ACTIVE', 'ENDED'));--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_source_chk" CHECK ("coach_students"."source" in ('INVITE', 'MARKETPLACE'));
--> statement-breakpoint
-- updated_at trigger (shared set_updated_at() from 0000)
CREATE TRIGGER mentorship_invite_codes_set_updated_at BEFORE UPDATE ON "mentorship_invite_codes"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
