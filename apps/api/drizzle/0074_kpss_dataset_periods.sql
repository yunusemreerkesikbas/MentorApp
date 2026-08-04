-- APP-035: reference dataset periods.
--
-- Hand-written rather than generated: drizzle-kit cannot infer the backfill that maps each
-- existing `kpss_postings.round` label onto a dataset row, and getting that wrong would either
-- drop every posting or leave them unattached.

CREATE TABLE "reference_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_family" text NOT NULL,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"sort_key" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"description_tr" text,
	"description_en" text,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "reference_datasets_kind_period_idx" ON "reference_datasets" USING btree ("kind","period");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_datasets_current_kind_idx" ON "reference_datasets" USING btree ("kind") WHERE "reference_datasets"."is_current" = true;--> statement-breakpoint

-- One dataset row per round already in the table. Trust metadata is lifted from the postings
-- themselves so the edition keeps the provenance it was imported with.
-- sort_key: "2026-1" -> 20261. Text ordering would put "2026-10" before "2026-2".
INSERT INTO "reference_datasets"
  ("exam_family", "kind", "period", "sort_key", "source", "source_url", "verified_at")
SELECT
  'KPSS',
  'KPSS_POSTINGS',
  p."round",
  (split_part(p."round", '-', 1))::int * 10
    + coalesce(nullif(split_part(p."round", '-', 2), '')::int, 0),
  min(p."source"),
  min(p."source_url"),
  max(p."verified_at")
FROM "kpss_postings" p
GROUP BY p."round";--> statement-breakpoint

-- Newest imported round becomes the default view.
UPDATE "reference_datasets"
SET "is_current" = true
WHERE "kind" = 'KPSS_POSTINGS'
  AND "sort_key" = (SELECT max("sort_key") FROM "reference_datasets" WHERE "kind" = 'KPSS_POSTINGS');--> statement-breakpoint

ALTER TABLE "kpss_postings" ADD COLUMN "dataset_id" uuid;--> statement-breakpoint
UPDATE "kpss_postings" p
SET "dataset_id" = d."id"
FROM "reference_datasets" d
WHERE d."kind" = 'KPSS_POSTINGS' AND d."period" = p."round";--> statement-breakpoint
ALTER TABLE "kpss_postings" ALTER COLUMN "dataset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "kpss_postings" ADD CONSTRAINT "kpss_postings_dataset_id_reference_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."reference_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ÖSYM codes are unique within a round, not across rounds: the round has to be part of the key or
-- a later import silently overwrites an earlier one on any collision.
ALTER TABLE "kpss_postings" DROP CONSTRAINT "kpss_postings_pkey";--> statement-breakpoint
ALTER TABLE "kpss_postings" ADD CONSTRAINT "kpss_postings_pkey" PRIMARY KEY ("dataset_id","osym_code");--> statement-breakpoint
ALTER TABLE "kpss_postings" DROP COLUMN "round";--> statement-breakpoint

-- Every read is "this round, this province"; the composite leads with the round.
DROP INDEX IF EXISTS "kpss_postings_city_idx";--> statement-breakpoint
CREATE INDEX "kpss_postings_dataset_city_idx" ON "kpss_postings" USING btree ("dataset_id","city_code");--> statement-breakpoint

-- Global editorial reference: everyone reads, only SERVICE/ADMIN writes (mirrors titles/institutions).
ALTER TABLE "reference_datasets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reference_datasets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY reference_datasets_public_read ON "reference_datasets"
  FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY reference_datasets_service_write ON "reference_datasets"
  FOR ALL
  USING (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'))
  WITH CHECK (current_setting('app.role', true) IN ('SERVICE', 'ADMIN'));
