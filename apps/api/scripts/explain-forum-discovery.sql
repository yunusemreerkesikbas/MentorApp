\set ON_ERROR_STOP on

-- Repeatable high-volume discovery smoke check. Seed rows live only inside this transaction.
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

ANALYZE forum_threads;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  thread.id,
  thread.zone_id,
  thread.last_activity_at
FROM forum_threads AS thread
INNER JOIN forum_zones AS zone ON zone.id = thread.zone_id
WHERE
  thread.deleted_at IS NULL
  AND zone.is_archived = false
  AND thread.last_activity_at >= now() - interval '72 hours'
ORDER BY thread.last_activity_at DESC, thread.id DESC
LIMIT 21;

ROLLBACK;
