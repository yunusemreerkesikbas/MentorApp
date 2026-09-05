-- W8 · a coach seat that carries the student's Premium.
--
-- A sponsored subscription is a REAL `subscriptions` row (provider 'SPONSOR', plan 'coach-seat',
-- price 0) rather than a second entitlement source. `computeEntitlement` is called on nearly every
-- request; teaching it to join across module boundaries would poison the hot path. Writing the row
-- instead means the expiry sweeper, the dunning grace, the win-back signal and the admin views all
-- keep working with no change at all.
--
-- `currentPeriodEnd` stays NULL while the seat holds: the ACTIVE branch skips the expiry check when
-- there is no end date (the same shape STAFF uses), so no monthly extension cron is needed.
--
-- ON DELETE SET NULL, not CASCADE: a subscription row is an access record, not an extension of the
-- relationship. When KVKK erasure deletes the link, the access history must outlive it.
--
-- The FK is split into NOT VALID + VALIDATE because `subscriptions` is a populated table
-- (backend.md): a plain ADD CONSTRAINT would take ACCESS EXCLUSIVE and full-scan it to verify rows
-- whose new column is NULL anyway. VALIDATE takes only SHARE UPDATE EXCLUSIVE.

ALTER TABLE "subscriptions" ADD COLUMN "sponsor_link_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_sponsor_link_id_coach_students_id_fk" FOREIGN KEY ("sponsor_link_id") REFERENCES "public"."coach_students"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "subscriptions" VALIDATE CONSTRAINT "subscriptions_sponsor_link_id_coach_students_id_fk";--> statement-breakpoint
CREATE INDEX "subscriptions_sponsor_link_idx" ON "subscriptions" USING btree ("sponsor_link_id") WHERE sponsor_link_id is not null;--> statement-breakpoint

-- The plan a sponsored seat points at. Price 0 and trialDays 0: nothing is charged and the seat is
-- not a trial, so it must never touch the trial-once rule. `is_active` true only so the existing
-- plan lookups do not have to special-case it; it is never offered at checkout (no UI lists it).
INSERT INTO "plans" ("id", "name", "period_months", "price_minor", "currency", "trial_days", "is_active")
VALUES ('coach-seat', 'Koç koltuğu', 1, 0, 'TRY', 0, true)
ON CONFLICT ("id") DO NOTHING;
