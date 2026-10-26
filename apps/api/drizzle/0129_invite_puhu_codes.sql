-- Friend invite codes move from `MENTOR-<12 hex>` to `PUHU-<code>`. Existing codes keep their suffix, so a
-- code already shared or saved still resolves (the redeem input also maps a typed `MENTOR-` to `PUHU-`).
-- Only these two tables: coach invitation codes (`MENTOR-KOC-…`) live in the mentorship tables and stay.
-- `invites` and `invite_redemptions` force RLS; a role without BYPASSRLS would match zero rows and skip this
-- silently, so the transaction-local service role is set for the update and cleared right after.
SELECT set_config('app.role', 'SERVICE', true);--> statement-breakpoint
UPDATE "invites" SET "code" = 'PUHU-' || substr("code", 8) WHERE "code" LIKE 'MENTOR-%';--> statement-breakpoint
UPDATE "invite_redemptions" SET "code" = 'PUHU-' || substr("code", 8) WHERE "code" LIKE 'MENTOR-%';--> statement-breakpoint
SELECT set_config('app.role', '', true);
