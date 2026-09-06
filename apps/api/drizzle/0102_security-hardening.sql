CREATE TABLE "google_link_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"nonce_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_link_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_delivery_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"endpoint_hash" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"claim_token" uuid NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_delivery_claims_status_check" CHECK ("push_delivery_claims"."status" in ('PENDING', 'DELIVERED'))
);
--> statement-breakpoint
ALTER TABLE "push_delivery_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upload_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"org_id" uuid,
	"session_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"max_bytes" integer NOT NULL,
	"charged_bytes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_tickets_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "upload_tickets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "upload_tickets_status_check" CHECK ("upload_tickets"."status" in ('ISSUED', 'CLAIMED', 'COMPLETE', 'FAILED')),
	CONSTRAINT "upload_tickets_bytes_check" CHECK ("upload_tickets"."max_bytes" > 0 and "upload_tickets"."charged_bytes" >= 0 and "upload_tickets"."charged_bytes" <= "upload_tickets"."max_bytes")
);
--> statement-breakpoint
ALTER TABLE "upload_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "google_link_intents" ADD CONSTRAINT "google_link_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_link_intents" ADD CONSTRAINT "google_link_intents_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_delivery_claims" ADD CONSTRAINT "push_delivery_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_tickets" ADD CONSTRAINT "upload_tickets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_tickets" ADD CONSTRAINT "upload_tickets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_tickets" ADD CONSTRAINT "upload_tickets_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "google_link_intents_nonce_idx" ON "google_link_intents" USING btree ("nonce_hash");--> statement-breakpoint
CREATE INDEX "google_link_intents_user_session_idx" ON "google_link_intents" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_delivery_claims_dedupe_idx" ON "push_delivery_claims" USING btree ("user_id","template","dedupe_key","endpoint_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_tickets_owner_created_idx" ON "upload_tickets" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "upload_tickets_owner_status_idx" ON "upload_tickets" USING btree ("owner_id","status");--> statement-breakpoint
CREATE POLICY "google_link_intents_owner" ON "google_link_intents" AS PERMISSIVE FOR ALL TO public USING ("google_link_intents"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("google_link_intents"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "push_delivery_claims_owner" ON "push_delivery_claims" AS PERMISSIVE FOR ALL TO public USING ("push_delivery_claims"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("push_delivery_claims"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "auth_sessions_owner" ON "auth_sessions" AS PERMISSIVE FOR ALL TO public USING ("auth_sessions"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("auth_sessions"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
CREATE POLICY "upload_tickets_owner" ON "upload_tickets" AS PERMISSIVE FOR ALL TO public USING ("upload_tickets"."owner_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("upload_tickets"."owner_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE');
--> statement-breakpoint
ALTER TABLE "google_link_intents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "push_delivery_claims" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "upload_tickets" FORCE ROW LEVEL SECURITY;
