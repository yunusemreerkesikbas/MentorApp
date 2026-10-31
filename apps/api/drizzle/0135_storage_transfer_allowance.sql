ALTER TABLE "storage_budget_state" ADD COLUMN "transfer_bytes" bigint;--> statement-breakpoint
ALTER TABLE "storage_reservations" ADD COLUMN "reserved_transfer_bytes" bigint;--> statement-breakpoint
ALTER TABLE "storage_budget_state" ADD CONSTRAINT "storage_transfer_nonnegative" CHECK ("storage_budget_state"."transfer_bytes" >= 0);--> statement-breakpoint
ALTER TABLE "storage_reservations" ADD CONSTRAINT "storage_reservation_transfer_nonnegative" CHECK ("storage_reservations"."reserved_transfer_bytes" >= 0);