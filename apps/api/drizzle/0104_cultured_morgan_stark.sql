CREATE TABLE "ai_budget_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"amount_micros" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_budget_reservations_expires_idx" ON "ai_budget_reservations" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "ai_budget_reservations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_budget_reservations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_budget_reservations_service" ON "ai_budget_reservations"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
