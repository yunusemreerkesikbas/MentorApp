CREATE TABLE "info_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"family" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verified_by" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"embedding" vector(1536),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "info_articles_slug_unique_idx" ON "info_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "info_articles_family_category_idx" ON "info_articles" USING btree ("family","category");--> statement-breakpoint
CREATE TRIGGER info_articles_set_updated_at BEFORE UPDATE ON "info_articles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
-- ===================== RLS (published public read; service/admin write + drafts) =====================
ALTER TABLE "info_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "info_articles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY info_articles_public_read ON "info_articles"
  FOR SELECT USING (
    published_at IS NOT NULL
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE POLICY info_articles_service_write ON "info_articles"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));