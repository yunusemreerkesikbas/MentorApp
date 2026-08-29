ALTER TABLE "ad_reward_sessions" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
UPDATE "coin_grant_reservations"
SET "status" = 'RELEASED', "released_at" = now()
WHERE "source" = 'ad_reward' AND "status" = 'ACTIVE' AND "expires_at" <= now();--> statement-breakpoint
UPDATE "ad_reward_sessions"
SET "status" = 'EXPIRED', "rejection_code" = 'SESSION_EXPIRED', "updated_at" = now()
WHERE "status" = 'CREATED' AND "expires_at" <= now();--> statement-breakpoint
CREATE INDEX "ad_reward_sessions_status_expiry_idx" ON "ad_reward_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_reward_sessions_user_idempotency_unique_idx" ON "ad_reward_sessions" USING btree ("user_id","idempotency_key") WHERE "ad_reward_sessions"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_reward_sessions_user_active_unique_idx" ON "ad_reward_sessions" USING btree ("user_id","placement_id") WHERE "ad_reward_sessions"."status" = 'CREATED';
