ALTER TABLE "coach_conversations" ADD COLUMN "origin_type" text;--> statement-breakpoint
ALTER TABLE "coach_conversations" ADD COLUMN "origin_ref_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_conversations" ADD COLUMN "origin_meta" jsonb;--> statement-breakpoint
ALTER TABLE "forum_tags" ADD COLUMN "coach_intent" text;--> statement-breakpoint

ALTER TABLE "forum_tags" ADD CONSTRAINT "forum_tags_coach_intent_check"
  CHECK ("coach_intent" IS NULL OR "coach_intent" IN ('PLAN', 'NEXT_STEP', 'STUDY_METHOD', 'STRATEGY'));--> statement-breakpoint

ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_origin_check"
  CHECK (
    ("origin_type" IS NULL AND "origin_ref_id" IS NULL AND "origin_meta" IS NULL)
    OR (
      "origin_type" = 'COMMUNITY_THREAD'
      AND "origin_ref_id" IS NOT NULL
      AND jsonb_typeof("origin_meta") = 'object'
      AND "origin_meta"->>'intent' IN ('PLAN', 'NEXT_STEP', 'STUDY_METHOD', 'STRATEGY')
      AND COALESCE("origin_meta"->>'tagSlug', '') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  );--> statement-breakpoint

UPDATE "forum_tags"
SET "coach_intent" = CASE "slug"
  WHEN 'planlama' THEN 'PLAN'
  WHEN 'motivasyon' THEN 'NEXT_STEP'
  WHEN 'calisma-ipuclari' THEN 'STUDY_METHOD'
  WHEN 'sinav-stratejisi' THEN 'STRATEGY'
  ELSE NULL
END
WHERE "slug" IN (
  'planlama',
  'motivasyon',
  'calisma-ipuclari',
  'sinav-stratejisi',
  'kaynak-onerisi',
  'soru-cozumu'
);
