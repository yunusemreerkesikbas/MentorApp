CREATE TABLE "public_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" varchar(2) DEFAULT 'TR' NOT NULL,
	"holiday_date" date NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'FULL' NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verified_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_holidays_country_date_unique_idx" ON "public_holidays" USING btree ("country","holiday_date");--> statement-breakpoint
CREATE INDEX "public_holidays_country_date_idx" ON "public_holidays" USING btree ("country","holiday_date");--> statement-breakpoint
CREATE TRIGGER public_holidays_set_updated_at BEFORE UPDATE ON "public_holidays"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- ===================== RLS (public read, service/admin write) =====================
ALTER TABLE "public_holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_holidays" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY public_holidays_public_read ON "public_holidays"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY public_holidays_service_write ON "public_holidays"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));