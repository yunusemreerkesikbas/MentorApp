CREATE TABLE "auth_rate_limits" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"next_allowed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "auth_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE POLICY "auth_rate_limits_service" ON "auth_rate_limits" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.role', true) = 'SERVICE') WITH CHECK (current_setting('app.role', true) = 'SERVICE');
--> statement-breakpoint
ALTER TABLE auth_rate_limits FORCE ROW LEVEL SECURITY;
