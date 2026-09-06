-- W8 · coach applications — the curation pipeline (roadmap §5, "açık kayıt değil, kürasyon").
--
-- One row per person, and the APPROVED row IS the coach's profile. No second "profile" table: a
-- coach's profile is exactly what passed vetting, and the record of WHAT an admin approved already
-- lives in W6's append-only admin_audit_log. A second store would be a second copy of an existing
-- fact and a third place for KVKK erasure to chase.
--
-- Two writers, split by column and enforced in the service signatures:
--   applicant -> headline, bio, claim_*        (editable after approval, APP-083)
--   admin     -> status, verified_claims, reviewed_*  (review() is the only door)
--
-- No credential column. The paperwork of the evaluation happens off-platform; a document would be
-- the heaviest personal data in the system, retained for rejected applicants too, and the badge
-- only ever needed to record WHICH claim was checked.
--
-- UNIQUE (user_id) is also what guarantees a single open application — re-applying revives this
-- very row (the coach_students pattern), so no partial index is needed.
--
-- The table is born empty in this migration, so the FKs and the CHECK need no NOT VALID split.

CREATE TABLE "mentorship_coach_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"headline" text NOT NULL,
	"bio" text NOT NULL,
	"claim_institution" text,
	"claim_branch" text,
	"claim_years" integer,
	"claim_note" text,
	"verified_claims" text[] DEFAULT '{}'::text[] NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorship_coach_applications_status_chk" CHECK ("mentorship_coach_applications"."status" in ('PENDING', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" ADD CONSTRAINT "mentorship_coach_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" ADD CONSTRAINT "mentorship_coach_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_coach_applications_user_idx" ON "mentorship_coach_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mentorship_coach_applications_status_idx" ON "mentorship_coach_applications" USING btree ("status","submitted_at");