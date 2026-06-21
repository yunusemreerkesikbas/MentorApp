CREATE TABLE "vision_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_title" text NOT NULL,
	"target_city" text,
	"motivation" text,
	"ai_note" text,
	"ai_model" text,
	"ai_note_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vision_boards" ADD CONSTRAINT "vision_boards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vision_boards_user_unique_idx" ON "vision_boards" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "vision_boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vision_boards" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY vision_boards_self_or_service ON "vision_boards"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );