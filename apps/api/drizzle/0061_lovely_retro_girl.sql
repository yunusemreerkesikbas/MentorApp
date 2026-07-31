CREATE TABLE "forum_helpful_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"exam_type" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_thread_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
UPDATE "forum_threads"
SET "last_activity_at" = COALESCE("updated_at", "created_at");--> statement-breakpoint
ALTER TABLE "forum_threads" ALTER COLUMN "last_activity_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "forum_threads" ALTER COLUMN "last_activity_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "featured_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "featured_by" uuid;--> statement-breakpoint
ALTER TABLE "forum_helpful_votes" ADD CONSTRAINT "forum_helpful_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_tags" ADD CONSTRAINT "forum_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_tags" ADD CONSTRAINT "forum_tags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_thread_tags" ADD CONSTRAINT "forum_thread_tags_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_thread_tags" ADD CONSTRAINT "forum_thread_tags_tag_id_forum_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."forum_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forum_helpful_votes_unique_idx" ON "forum_helpful_votes" USING btree ("target_type","target_id","user_id");--> statement-breakpoint
CREATE INDEX "forum_helpful_votes_target_idx" ON "forum_helpful_votes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_tags_slug_idx" ON "forum_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "forum_tags_active_exam_idx" ON "forum_tags" USING btree ("is_active","exam_type");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_thread_tags_unique_idx" ON "forum_thread_tags" USING btree ("thread_id","tag_id");--> statement-breakpoint
CREATE INDEX "forum_thread_tags_tag_thread_idx" ON "forum_thread_tags" USING btree ("tag_id","thread_id");--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_featured_by_users_id_fk" FOREIGN KEY ("featured_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_threads_discovery_activity_idx" ON "forum_threads" USING btree ("last_activity_at","id");--> statement-breakpoint
CREATE INDEX "forum_threads_featured_idx" ON "forum_threads" USING btree ("featured_until") WHERE "forum_threads"."featured_until" is not null;--> statement-breakpoint

ALTER TABLE "forum_helpful_votes"
  ADD CONSTRAINT "forum_helpful_votes_target_type_check" CHECK ("target_type" IN ('THREAD', 'POST')),
  ADD CONSTRAINT "forum_helpful_votes_value_check" CHECK ("value" = 1);--> statement-breakpoint
ALTER TABLE "forum_tags"
  ADD CONSTRAINT "forum_tags_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint

INSERT INTO "forum_tags" ("slug", "name_tr", "name_en") VALUES
  ('motivasyon', 'Motivasyon', 'Motivation'),
  ('calisma-ipuclari', 'Çalışma İpuçları', 'Study Tips'),
  ('planlama', 'Planlama', 'Planning'),
  ('sinav-stratejisi', 'Sınav Stratejisi', 'Exam Strategy'),
  ('kaynak-onerisi', 'Kaynak Önerisi', 'Resource Recommendation'),
  ('soru-cozumu', 'Soru Çözümü', 'Problem Solving')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

CREATE OR REPLACE FUNCTION forum_limit_thread_tags() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM forum_thread_tags WHERE thread_id = NEW.thread_id AND tag_id = NEW.tag_id
  ) AND (SELECT count(*) FROM forum_thread_tags WHERE thread_id = NEW.thread_id) >= 3 THEN
    RAISE EXCEPTION 'forum thread tag limit exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER forum_thread_tags_limit_before_insert
  BEFORE INSERT ON "forum_thread_tags"
  FOR EACH ROW EXECUTE FUNCTION forum_limit_thread_tags();--> statement-breakpoint

CREATE OR REPLACE FUNCTION forum_touch_thread_activity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_thread_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'forum_posts' THEN
    target_thread_id := NEW.thread_id;
  ELSIF TG_TABLE_NAME = 'forum_reactions' THEN
    target_thread_id := NEW.thread_id;
  ELSIF TG_TABLE_NAME = 'forum_post_reactions' THEN
    SELECT thread_id INTO target_thread_id FROM forum_posts WHERE id = NEW.post_id;
  ELSIF TG_TABLE_NAME = 'forum_helpful_votes' AND NEW.target_type = 'THREAD' THEN
    target_thread_id := NEW.target_id;
  ELSIF TG_TABLE_NAME = 'forum_helpful_votes' THEN
    SELECT thread_id INTO target_thread_id FROM forum_posts WHERE id = NEW.target_id;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE forum_threads
  SET last_activity_at = GREATEST(last_activity_at, NEW.created_at)
  WHERE id = target_thread_id;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER forum_posts_touch_thread_activity
  AFTER INSERT ON "forum_posts"
  FOR EACH ROW EXECUTE FUNCTION forum_touch_thread_activity();--> statement-breakpoint
CREATE TRIGGER forum_reactions_touch_thread_activity
  AFTER INSERT ON "forum_reactions"
  FOR EACH ROW EXECUTE FUNCTION forum_touch_thread_activity();--> statement-breakpoint
CREATE TRIGGER forum_post_reactions_touch_thread_activity
  AFTER INSERT ON "forum_post_reactions"
  FOR EACH ROW EXECUTE FUNCTION forum_touch_thread_activity();--> statement-breakpoint
CREATE TRIGGER forum_helpful_votes_touch_thread_activity
  AFTER INSERT ON "forum_helpful_votes"
  FOR EACH ROW EXECUTE FUNCTION forum_touch_thread_activity();--> statement-breakpoint

ALTER TABLE "forum_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_tags_read ON "forum_tags" FOR SELECT
  USING (
    (is_active = true AND current_setting('app.user_id', true) <> '')
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_tags_write ON "forum_tags" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

ALTER TABLE "forum_thread_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_thread_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_thread_tags_read ON "forum_thread_tags" FOR SELECT
  USING (
    current_setting('app.user_id', true) <> ''
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_thread_tags_write ON "forum_thread_tags" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

ALTER TABLE "forum_helpful_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "forum_helpful_votes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY forum_helpful_votes_read ON "forum_helpful_votes" FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY forum_helpful_votes_write ON "forum_helpful_votes" FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));--> statement-breakpoint

CREATE TRIGGER forum_tags_set_updated_at BEFORE UPDATE ON "forum_tags"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
