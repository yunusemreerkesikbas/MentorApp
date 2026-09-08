-- W8 · coach applications become the coach REGISTRY (APP-089).
--
-- Registration is self-service now. Nobody approves a request any more, so `status` stops being a
-- verdict on an application and becomes the coach's own standing:
--
--   APPROVED -> ACTIVE      the coach may coach. Self-registration writes this directly.
--   PENDING  -> PENDING     unchanged in name and in effect: no COACH role, no invite code. It used
--                           to mean "waiting to be let in"; it now means "an admin pulled them back
--                           for a look". Both are powerless, so existing rows need no rewrite.
--   REJECTED -> SUSPENDED   an admin removed them. Only an admin reinstates.
--
-- The default flips with it: a row is now born ACTIVE, written by the person themselves.
--
-- ORDER MATTERS. The old CHECK is dropped first, because the rows pass through values neither
-- constraint accepts while the UPDATEs run; the new CHECK goes on afterwards. It is added NOT VALID
-- and validated separately (docs/standards/backend.md): a plain ADD CONSTRAINT takes an ACCESS
-- EXCLUSIVE lock for a full scan. The table is empty on every environment today — mentorship.enabled
-- has never been on — so this costs nothing here, but the pattern is the rule, not a judgement call.

ALTER TABLE "mentorship_coach_applications" DROP CONSTRAINT IF EXISTS "mentorship_coach_applications_status_chk";--> statement-breakpoint
UPDATE "mentorship_coach_applications" SET "status" = 'ACTIVE' WHERE "status" = 'APPROVED';--> statement-breakpoint
UPDATE "mentorship_coach_applications" SET "status" = 'SUSPENDED' WHERE "status" = 'REJECTED';--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" ADD CONSTRAINT "mentorship_coach_applications_status_chk" CHECK ("mentorship_coach_applications"."status" in ('ACTIVE', 'PENDING', 'SUSPENDED')) NOT VALID;--> statement-breakpoint
ALTER TABLE "mentorship_coach_applications" VALIDATE CONSTRAINT "mentorship_coach_applications_status_chk";
