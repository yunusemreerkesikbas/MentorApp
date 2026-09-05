-- W8 · paid coach seats, as a property of the plan.
--
-- No new tier and no second product. A coach who wants more sponsored seats subscribes to a
-- `coach-pro-*` plan INSTEAD of a student plan: one open subscription like everybody else,
-- `isPremium` from the ordinary ACTIVE path (so their own AI works too), and the seat allowance
-- read off the row they already have. `SubscriptionTier` stays FREE|PREMIUM and
-- `computeEntitlement` is not touched — the 18 tests over it keep standing as the regression net.
--
-- Seat allowance = `mentorship.coach.free_seats` + this plan's `seat_count`. Exceeding it does NOT
-- block the link: the coach may still follow up to `mentorship.coach.max_active_students`, the
-- student simply is not sponsored. Quota overflow stays an error about FOLLOWING, never a paywall
-- on it.
--
-- PLACEHOLDER PRICES. Phase-0 WTP research is still open (roadmap §12), and the plans are kept out
-- of the purchasable catalog by `mentorship.seats.billing_enabled` until iyzico is verified —
-- listing a plan nobody can buy would promise a purchase flow that does not exist.
--
-- NOT NULL DEFAULT 0 on a populated table needs no NOT VALID split: Postgres 11+ stores the
-- default in the catalog and rewrites nothing.

ALTER TABLE "plans" ADD COLUMN "seat_count" integer DEFAULT 0 NOT NULL;

INSERT INTO "plans" ("id", "name", "period_months", "price_minor", "currency", "trial_days", "seat_count", "is_active")
VALUES
  ('coach-pro-10', 'Koç Pro 10', 1, 99900, 'TRY', 0, 10, true),
  ('coach-pro-25', 'Koç Pro 25', 1, 199900, 'TRY', 0, 25, true)
ON CONFLICT ("id") DO NOTHING;
