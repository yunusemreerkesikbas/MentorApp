CREATE TABLE "study_room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"theme" text NOT NULL,
	"capacity" integer NOT NULL,
	"invite_code" text NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_rooms_capacity_range" CHECK ("study_rooms"."capacity" between 2 and 10)
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_room_id_study_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."study_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_room_members" ADD CONSTRAINT "study_room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_rooms" ADD CONSTRAINT "study_rooms_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_room_members_pair_unique_idx" ON "study_room_members" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "study_room_members_user_idx" ON "study_room_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_room_members_room_joined_idx" ON "study_room_members" USING btree ("room_id","joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "study_rooms_invite_code_unique_idx" ON "study_rooms" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "study_rooms_owner_idx" ON "study_rooms" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_room_id_study_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."study_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_sessions_room_status_idx" ON "study_sessions" USING btree ("room_id","status");--> statement-breakpoint
ALTER TABLE "study_rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_rooms" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "study_rooms_service_all" ON "study_rooms" FOR ALL
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');--> statement-breakpoint
ALTER TABLE "study_room_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_room_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "study_room_members_service_all" ON "study_room_members" FOR ALL
  USING (current_setting('app.role', true) = 'SERVICE')
  WITH CHECK (current_setting('app.role', true) = 'SERVICE');
