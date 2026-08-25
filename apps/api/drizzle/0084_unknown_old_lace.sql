CREATE TABLE "notebooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"kind" text NOT NULL,
	"exam_id" uuid,
	"subject_ref" text,
	"title" text,
	"cover_color" text DEFAULT 'navy' NOT NULL,
	"cover_material" text DEFAULT 'cloth' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notebooks_kind_check" CHECK ("notebooks"."kind" IN ('MISTAKE', 'CUSTOM')),
	CONSTRAINT "notebooks_title_check" CHECK (("notebooks"."title" IS NULL AND "notebooks"."kind" = 'MISTAKE') OR char_length("notebooks"."title") BETWEEN 1 AND 40)
);
--> statement-breakpoint
INSERT INTO "notebooks" ("user_id", "org_id", "kind")
SELECT "id", "organization_id", 'MISTAKE' FROM "users"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "mistake_notebook_pages" RENAME TO "notebook_pages";--> statement-breakpoint
ALTER TABLE "notebook_pages" DROP CONSTRAINT "mistake_notebook_pages_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "mistake_notebook_pages_user_idx";--> statement-breakpoint
ALTER TABLE "notebook_pages" ADD COLUMN "notebook_id" uuid;--> statement-breakpoint
UPDATE "notebook_pages" AS p
SET "notebook_id" = n."id"
FROM "notebooks" AS n
WHERE n."user_id" = p."user_id" AND n."kind" = 'MISTAKE';--> statement-breakpoint
UPDATE "notebooks" AS n
SET
  "title" = NULLIF(btrim(p."doc" #>> '{cover,title}'), ''),
  "cover_color" = COALESCE(p."doc" #>> '{cover,color}', n."cover_color"),
  "cover_material" = COALESCE(p."doc" #>> '{cover,material}', n."cover_material"),
  "updated_at" = GREATEST(n."updated_at", p."updated_at")
FROM "notebook_pages" AS p
WHERE n."id" = p."notebook_id" AND p."page_index" = 0 AND p."doc" ? 'cover';--> statement-breakpoint
UPDATE "notebook_pages"
SET "doc" = "doc" - 'cover'
WHERE "doc" ? 'cover';--> statement-breakpoint
ALTER TABLE "notebook_pages" ALTER COLUMN "notebook_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notebooks_one_mistake_per_user_idx" ON "notebooks" USING btree ("user_id") WHERE "notebooks"."kind" = 'MISTAKE';--> statement-breakpoint
CREATE UNIQUE INDEX "notebooks_id_user_unique_idx" ON "notebooks" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "notebooks_user_updated_idx" ON "notebooks" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "notebook_pages" ADD CONSTRAINT "notebook_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_pages" ADD CONSTRAINT "notebook_pages_notebook_user_fk" FOREIGN KEY ("notebook_id","user_id") REFERENCES "public"."notebooks"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notebook_pages_notebook_page_idx" ON "notebook_pages" USING btree ("notebook_id","page_index");--> statement-breakpoint
CREATE INDEX "notebook_pages_user_idx" ON "notebook_pages" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "notebooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notebooks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY notebooks_self_or_service ON "notebooks"
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.role', true) IN ('SERVICE', 'ADMIN')
  );--> statement-breakpoint
CREATE TRIGGER notebooks_set_updated_at BEFORE UPDATE ON "notebooks"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
