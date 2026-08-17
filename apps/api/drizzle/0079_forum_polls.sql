CREATE TABLE "forum_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_polls_ends_after_created_chk" CHECK ("forum_polls"."ends_at" > "forum_polls"."created_at")
);
--> statement-breakpoint
CREATE TABLE "forum_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"text" varchar(25) NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_poll_options_position_chk" CHECK ("forum_poll_options"."position" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "forum_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_polls" ADD CONSTRAINT "forum_polls_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_poll_options" ADD CONSTRAINT "forum_poll_options_poll_id_forum_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."forum_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_poll_votes" ADD CONSTRAINT "forum_poll_votes_poll_id_forum_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."forum_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_poll_votes" ADD CONSTRAINT "forum_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_polls_thread_unique_idx" ON "forum_polls" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "forum_polls_ends_idx" ON "forum_polls" USING btree ("ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_poll_options_poll_position_idx" ON "forum_poll_options" USING btree ("poll_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_poll_options_poll_id_id_idx" ON "forum_poll_options" USING btree ("poll_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_poll_votes_poll_user_idx" ON "forum_poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX "forum_poll_votes_option_idx" ON "forum_poll_votes" USING btree ("option_id");--> statement-breakpoint
ALTER TABLE "forum_poll_votes" ADD CONSTRAINT "forum_poll_votes_poll_option_fk" FOREIGN KEY ("poll_id","option_id") REFERENCES "public"."forum_poll_options"("poll_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "forum_polls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_polls" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_polls_read ON "forum_polls" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM forum_threads ft
    INNER JOIN forum_zones fz ON fz.id = ft.zone_id
    WHERE ft.id = thread_id AND ft.deleted_at IS NULL
      AND fz.visibility = 'PUBLIC' AND fz.is_archived = false
      AND current_setting('app.user_id', true) <> ''
  ) OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
);--> statement-breakpoint
CREATE POLICY forum_polls_write ON "forum_polls" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

ALTER TABLE "forum_poll_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_poll_options" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_poll_options_read ON "forum_poll_options" FOR SELECT USING (
  EXISTS (SELECT 1 FROM forum_polls fp WHERE fp.id = poll_id)
  OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
);--> statement-breakpoint
CREATE POLICY forum_poll_options_write ON "forum_poll_options" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

ALTER TABLE "forum_poll_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_poll_votes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_poll_votes_read ON "forum_poll_votes" FOR SELECT USING (
  user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
);--> statement-breakpoint
CREATE POLICY forum_poll_votes_write ON "forum_poll_votes" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
