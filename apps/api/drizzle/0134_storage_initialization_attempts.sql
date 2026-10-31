ALTER TABLE "storage_budget_state" ADD COLUMN "active_initialization_id" uuid;--> statement-breakpoint
ALTER TABLE "storage_reservations" ADD COLUMN "initialization_id" uuid;--> statement-breakpoint
CREATE INDEX "storage_reservations_initialization_idx" ON "storage_reservations" USING btree ("initialization_id");