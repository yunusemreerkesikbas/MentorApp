\set ON_ERROR_STOP on

-- Repeatable high-volume Discovery V2 smoke check. Every temporary row is rolled back.
-- Acceptance review: no "Sort Method: external" / temp-file spill; the tag plan should use
-- forum_tags_slug_idx and forum_thread_tags_tag_thread_idx (or their bitmap equivalents).
BEGIN;
SELECT set_config('app.role', 'SERVICE', true);

WITH seed AS (
  SELECT
    (SELECT id FROM forum_zones WHERE is_archived = false ORDER BY created_at LIMIT 1) AS zone_id,
    (SELECT id FROM users WHERE status = 'ACTIVE' ORDER BY created_at LIMIT 1) AS author_id
)
INSERT INTO forum_threads (
  zone_id,
  author_id,
  title,
  body,
  last_activity_at,
  created_at,
  updated_at
)
SELECT
  seed.zone_id,
  seed.author_id,
  'Discovery explain seed ' || series.n,
  'Temporary high-volume row used only by EXPLAIN.',
  now() - ((series.n % 96) || ' hours')::interval,
  now() - ((series.n % 720) || ' hours')::interval,
  now()
FROM seed
CROSS JOIN generate_series(1, 10000) AS series(n)
WHERE seed.zone_id IS NOT NULL AND seed.author_id IS NOT NULL;

-- Attach every temporary thread to a tag while keeping the target tag at 1% selectivity. This
-- avoids a misleading tiny-table sequential scan and makes the production tag index path visible.
INSERT INTO forum_tags (slug, name_tr, name_en, is_active)
VALUES
  ('discovery-explain-target', 'Discovery Explain Target', 'Discovery Explain Target', true),
  ('discovery-explain-noise', 'Discovery Explain Noise', 'Discovery Explain Noise', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;

WITH smoke_tags AS (
  SELECT
    (SELECT id FROM forum_tags WHERE slug = 'discovery-explain-target') AS target_id,
    (SELECT id FROM forum_tags WHERE slug = 'discovery-explain-noise') AS noise_id
),
seed_threads AS (
  SELECT id, row_number() OVER (ORDER BY id) AS row_number
  FROM forum_threads
  WHERE title LIKE 'Discovery explain seed %'
)
INSERT INTO forum_thread_tags (thread_id, tag_id)
SELECT
  seed_threads.id,
  CASE WHEN seed_threads.row_number % 100 = 0 THEN smoke_tags.target_id ELSE smoke_tags.noise_id END
FROM seed_threads
CROSS JOIN smoke_tags
ON CONFLICT DO NOTHING;

ANALYZE forum_threads;
ANALYZE forum_thread_tags;
ANALYZE forum_tags;

\echo '--- Discovery recent (created_at cursor order) ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  thread.id,
  thread.zone_id,
  thread.created_at,
  thread.last_activity_at
FROM forum_threads AS thread
INNER JOIN forum_zones AS zone ON zone.id = thread.zone_id
WHERE
  thread.deleted_at IS NULL
  AND zone.visibility = 'PUBLIC'
  AND zone.is_archived = false
ORDER BY thread.created_at DESC, thread.last_activity_at DESC, thread.id DESC
LIMIT 21;

\echo '--- Discovery trending (72-hour score window) ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  thread.id,
  (
    (SELECT count(DISTINCT participant_id) FROM (
      SELECT post.author_id AS participant_id
      FROM forum_posts AS post
      WHERE post.thread_id = thread.id AND post.deleted_at IS NULL
      UNION
      SELECT reaction.user_id AS participant_id
      FROM forum_reactions AS reaction
      WHERE reaction.thread_id = thread.id
    ) AS participants) * 3
    + (
      (SELECT count(*) FROM forum_reactions AS reaction WHERE reaction.thread_id = thread.id)
      + (SELECT count(*)
         FROM forum_post_reactions AS post_reaction
         INNER JOIN forum_posts AS post ON post.id = post_reaction.post_id
         WHERE post.thread_id = thread.id AND post.deleted_at IS NULL)
    )
    + (
      (SELECT count(*) FROM forum_bookmarks AS bookmark
       WHERE bookmark.target_type = 'THREAD' AND bookmark.target_id = thread.id)
      + (SELECT count(*)
         FROM forum_bookmarks AS bookmark
         INNER JOIN forum_posts AS post ON post.id = bookmark.target_id
         WHERE bookmark.target_type = 'POST'
           AND post.thread_id = thread.id
           AND post.deleted_at IS NULL)
    ) * 2
    + (
      (SELECT count(*) FROM forum_helpful_votes AS vote
       WHERE vote.target_type = 'THREAD' AND vote.target_id = thread.id)
      + (SELECT count(*)
         FROM forum_helpful_votes AS vote
         INNER JOIN forum_posts AS post ON post.id = vote.target_id
         WHERE vote.target_type = 'POST'
           AND post.thread_id = thread.id
           AND post.deleted_at IS NULL)
    ) * 2
    + CASE WHEN thread.accepted_post_id IS NOT NULL THEN 5 ELSE 0 END
  )::int AS score,
  thread.last_activity_at
FROM forum_threads AS thread
INNER JOIN forum_zones AS zone ON zone.id = thread.zone_id
WHERE
  thread.deleted_at IS NULL
  AND zone.visibility = 'PUBLIC'
  AND zone.is_archived = false
  AND thread.last_activity_at >= now() - interval '72 hours'
ORDER BY score DESC, thread.last_activity_at DESC, thread.id DESC
LIMIT 21;

\echo '--- Discovery top (30-day score window) ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  thread.id,
  (
    (SELECT count(DISTINCT participant_id) FROM (
      SELECT post.author_id AS participant_id
      FROM forum_posts AS post
      WHERE post.thread_id = thread.id AND post.deleted_at IS NULL
      UNION
      SELECT reaction.user_id AS participant_id
      FROM forum_reactions AS reaction
      WHERE reaction.thread_id = thread.id
    ) AS participants) * 3
    + (SELECT count(*) FROM forum_reactions AS reaction WHERE reaction.thread_id = thread.id)
    + (SELECT count(*) FROM forum_bookmarks AS bookmark
       WHERE bookmark.target_type = 'THREAD' AND bookmark.target_id = thread.id) * 2
    + (SELECT count(*) FROM forum_helpful_votes AS vote
       WHERE vote.target_type = 'THREAD' AND vote.target_id = thread.id) * 2
    + CASE WHEN thread.accepted_post_id IS NOT NULL THEN 5 ELSE 0 END
  )::int AS score,
  thread.last_activity_at
FROM forum_threads AS thread
INNER JOIN forum_zones AS zone ON zone.id = thread.zone_id
WHERE
  thread.deleted_at IS NULL
  AND zone.visibility = 'PUBLIC'
  AND zone.is_archived = false
  AND thread.last_activity_at >= now() - interval '30 days'
ORDER BY score DESC, thread.last_activity_at DESC, thread.id DESC
LIMIT 21;

\echo '--- Discovery active-tag filter (selective index path) ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  thread.id,
  thread.created_at,
  thread.last_activity_at
FROM forum_tags AS tag
INNER JOIN forum_thread_tags AS thread_tag ON thread_tag.tag_id = tag.id
INNER JOIN forum_threads AS thread ON thread.id = thread_tag.thread_id
INNER JOIN forum_zones AS zone ON zone.id = thread.zone_id
WHERE
  tag.slug = 'discovery-explain-target'
  AND tag.is_active = true
  AND thread.deleted_at IS NULL
  AND zone.visibility = 'PUBLIC'
  AND zone.is_archived = false
ORDER BY thread.created_at DESC, thread.last_activity_at DESC, thread.id DESC
LIMIT 21;

ROLLBACK;
