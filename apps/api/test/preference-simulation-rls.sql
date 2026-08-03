\set ON_ERROR_STOP on

BEGIN;

CREATE ROLE preference_rls_smoke NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON preference_scenarios, preference_scenario_items
  TO preference_rls_smoke;

INSERT INTO users (id, email, password_hash, display_name, exam_type, kvkk_accepted_at)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'preference-rls-a@example.test', 'test', 'RLS A', 'YKS', now()),
  ('10000000-0000-4000-8000-000000000002', 'preference-rls-b@example.test', 'test', 'RLS B', 'YKS', now()),
  ('10000000-0000-4000-8000-000000000003', 'preference-rls-c@example.test', 'test', 'RLS C', 'YKS', now());

INSERT INTO preference_scenarios (id, user_id, exam_type, dataset_version, rank_say)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'YKS', 'rls-smoke', 1000),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'YKS', 'rls-smoke', 2000);

INSERT INTO preference_scenario_items (
  id, scenario_id, user_id, position, program_code, program_name, faculty,
  level, score_type, quota, guide_year, placement_year, success_rank,
  university_id, university_name, city_code, city_name, source, source_url,
  verified_at
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', 1, '100000001', 'Program A',
    'Faculty A', 'LISANS', 'SAY', 10, 2026, 2025, 1500,
    '40000000-0000-4000-8000-000000000001', 'University A', '42', 'Konya',
    'Smoke test', 'https://example.test/a', now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002', 1, '100000002', 'Program B',
    'Faculty B', 'LISANS', 'EA', 10, 2026, 2025, 2500,
    '40000000-0000-4000-8000-000000000002', 'University B', '06', 'Ankara',
    'Smoke test', 'https://example.test/b', now()
  );

SET LOCAL ROLE preference_rls_smoke;
SELECT set_config('app.user_id', '10000000-0000-4000-8000-000000000001', true);

DO $test$
DECLARE
  scenario_count integer;
  item_count integer;
  affected integer;
BEGIN
  SELECT count(*) INTO scenario_count FROM preference_scenarios;
  SELECT count(*) INTO item_count FROM preference_scenario_items;
  IF scenario_count <> 1 OR item_count <> 1 THEN
    RAISE EXCEPTION 'RLS read isolation failed: scenarios %, items %', scenario_count, item_count;
  END IF;

  UPDATE preference_scenarios
  SET rank_say = 9999
  WHERE user_id = '10000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'RLS cross-user update isolation failed';
  END IF;

  BEGIN
    INSERT INTO preference_scenarios (id, user_id, exam_type, dataset_version)
    VALUES (
      '20000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000003',
      'YKS',
      'rls-smoke'
    );
    RAISE EXCEPTION 'RLS cross-user insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO preference_scenario_items (
      id, scenario_id, user_id, position, program_code, program_name, faculty,
      level, score_type, quota, guide_year, placement_year, success_rank,
      university_id, university_name, city_code, city_name, source, source_url,
      verified_at
    ) VALUES (
      '30000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001', 2, '100000003', 'Cross item',
      'Faculty C', 'LISANS', 'SAY', 10, 2026, 2025, 3500,
      '40000000-0000-4000-8000-000000000003', 'University C', '34', 'İstanbul',
      'Smoke test', 'https://example.test/c', now()
    );
    RAISE EXCEPTION 'RLS cross-scenario item insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$test$;

RESET ROLE;

DELETE FROM users WHERE id = '10000000-0000-4000-8000-000000000001';

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1 FROM preference_scenarios
    WHERE user_id = '10000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM preference_scenario_items
    WHERE user_id = '10000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Account deletion cascade failed';
  END IF;
END
$test$;

ROLLBACK;
