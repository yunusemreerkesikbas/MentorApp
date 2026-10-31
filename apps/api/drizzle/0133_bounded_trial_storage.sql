CREATE TABLE "storage_budget_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"scope_fingerprint" text,
	"status" text DEFAULT 'UNINITIALIZED' NOT NULL,
	"stored_bytes" bigint DEFAULT 0 NOT NULL,
	"class_a" integer DEFAULT 0 NOT NULL,
	"class_b" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_budget_singleton" CHECK ("storage_budget_state"."id" = 1),
	CONSTRAINT "storage_budget_status" CHECK ("storage_budget_state"."status" in ('UNINITIALIZED', 'VERIFYING', 'READY', 'BLOCKED')),
	CONSTRAINT "storage_budget_nonnegative" CHECK ("storage_budget_state"."stored_bytes" >= 0 and "storage_budget_state"."class_a" >= 0 and "storage_budget_state"."class_b" >= 0)
);
--> statement-breakpoint
ALTER TABLE "storage_budget_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "storage_object_manifest" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"write_reservation_id" uuid NOT NULL,
	"deletion_seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_manifest_positive_bytes" CHECK ("storage_object_manifest"."bytes" > 0),
	CONSTRAINT "storage_manifest_status" CHECK ("storage_object_manifest"."status" in ('PENDING', 'CONFIRMED', 'UNCERTAIN', 'DELETED'))
);
--> statement-breakpoint
ALTER TABLE "storage_object_manifest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "storage_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text,
	"reserved_bytes" integer DEFAULT 0 NOT NULL,
	"class_a" integer DEFAULT 0 NOT NULL,
	"class_b" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "storage_reservation_kind" CHECK ("storage_reservations"."kind" in ('put', 'copy', 'read', 'list', 'delete', 'initialization')),
	CONSTRAINT "storage_reservation_status" CHECK ("storage_reservations"."status" in ('PENDING', 'SUCCEEDED', 'UNCERTAIN')),
	CONSTRAINT "storage_reservation_charges" CHECK ("storage_reservations"."reserved_bytes" >= 0 and "storage_reservations"."class_a" >= 0 and "storage_reservations"."class_b" >= 0)
);
--> statement-breakpoint
ALTER TABLE "storage_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_object_manifest" ADD CONSTRAINT "storage_object_manifest_write_reservation_id_storage_reservations_id_fk" FOREIGN KEY ("write_reservation_id") REFERENCES "public"."storage_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_reservations_key_idx" ON "storage_reservations" USING btree ("storage_key");--> statement-breakpoint
CREATE POLICY "storage_service_only" ON "storage_budget_state" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "storage_service_only" ON "storage_object_manifest" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "storage_service_only" ON "storage_reservations" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');