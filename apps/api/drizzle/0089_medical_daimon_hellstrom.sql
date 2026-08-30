CREATE TABLE "info_article_daily_views" (
	"article_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "info_article_daily_views_article_id_day_pk" PRIMARY KEY("article_id","day")
);
--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "gallery_images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "info_articles" ADD COLUMN "featured_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "info_article_daily_views" ADD CONSTRAINT "info_article_daily_views_article_id_info_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."info_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "info_article_daily_views_day_idx" ON "info_article_daily_views" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "info_articles_one_featured_per_family_idx" ON "info_articles" USING btree ("family") WHERE "info_articles"."is_featured" = true;--> statement-breakpoint
-- ===================== RLS (counts are public; writes stay SERVICE/ADMIN) =====================
ALTER TABLE "info_article_daily_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "info_article_daily_views" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY info_article_daily_views_public_read ON "info_article_daily_views"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY info_article_daily_views_service_write ON "info_article_daily_views"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));