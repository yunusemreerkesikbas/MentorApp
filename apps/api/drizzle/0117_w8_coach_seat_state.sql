ALTER TABLE "coach_students" ADD COLUMN "seat" text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_students" ADD CONSTRAINT "coach_students_seat_chk" CHECK ("coach_students"."seat" in ('FREE', 'PAID', 'SELF', 'NONE'));--> statement-breakpoint
-- W8 · the seat lives on the link (phase B of the 2026-09-26 coach pricing review).
--
-- Existing live links are seated the way the accept lock seated them: oldest first, the first 3 on
-- a free seat, the rest on the coach's plan. The first reseat (the coach opening their home, or a
-- payments event) then moves a student who pays for themselves to SELF and a paid seat with no plan
-- behind it to NONE.
--
-- 3 is the catalog default of `mentorship.coach.free_seats`. An admin override is not read here:
-- `config_overrides` forces RLS and a migration runs with no app role. A higher override is picked
-- up by that first reseat, which moves paid seats onto the free quota; a lower one leaves these as
-- free seats already held, which is what lowering the quota means anyway.
UPDATE "coach_students" AS cs
SET "seat" = CASE WHEN ranked.rn <= 3 THEN 'FREE' ELSE 'PAID' END
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "coach_id" ORDER BY "accepted_at", "id") AS rn
  FROM "coach_students"
  WHERE "status" = 'ACTIVE'
) AS ranked
WHERE cs."id" = ranked."id";--> statement-breakpoint
-- Seat plans become tiers, sold with a per-student price in the copy. PLACEHOLDER PRICES: the
-- Faz-0 WTP research is open and the store commission is still to be folded in. They stay out of
-- the catalog while every coach channel (`mentorship.seats.billing_enabled`,
-- `mentorship.seats.mobile_billing_enabled`) is off, which is today.
INSERT INTO "plans" ("id", "name", "period_months", "price_minor", "currency", "trial_days", "seat_count", "is_active")
VALUES
  ('coach-plus-5', 'Koç +5', 1, 49900, 'TRY', 0, 5, true),
  ('coach-plus-10', 'Koç +10', 1, 89900, 'TRY', 0, 10, true),
  ('coach-plus-20', 'Koç +20', 1, 159900, 'TRY', 0, 20, true)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- The Pro packs were never sold: every coach channel has been off since they shipped. Retired, not
-- deleted, so a row a test or a dev database still points at keeps its seat_count.
UPDATE "plans" SET "is_active" = false, "updated_at" = now() WHERE "id" IN ('coach-pro-10', 'coach-pro-25');
