CREATE TABLE "mobile_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_push_tokens_platform_check" CHECK ("mobile_push_tokens"."platform" in ('ios', 'android'))
);
--> statement-breakpoint
ALTER TABLE "mobile_push_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mobile_push_tokens" ADD CONSTRAINT "mobile_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_push_tokens_token_idx" ON "mobile_push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "mobile_push_tokens_user_idx" ON "mobile_push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "mobile_push_tokens_owner" ON "mobile_push_tokens" AS PERMISSIVE FOR ALL TO public USING ("mobile_push_tokens"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE') WITH CHECK ("mobile_push_tokens"."user_id"::text = current_setting('app.user_id', true) OR current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
ALTER TABLE "mobile_push_tokens" FORCE ROW LEVEL SECURITY;
