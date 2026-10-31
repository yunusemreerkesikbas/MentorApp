# Coin notebook capacity verification — 2026-10-31

Product configuration: 20 Coin for permanent +1 custom notebook capacity, up to two extra slots
per user by default. Both settings are bounded, sensitive and editable in Admin → Ayarlar → Ekonomi.

## Verified

- **106 unit tests / 7 suites:** notebook purchase policy, reusable Free quotas, collection service,
  ledger display, shared Coin spending, chat retry protection and deep-analysis availability.
- **31 real HTTP/Postgres tests:** four notebook-slot scenarios, seven existing notebook collection
  scenarios and 20 existing AI/Coin scenarios. Tests use fake AI/storage providers and a dedicated
  local `mentor_notebook_slots_20261031_test` database, not the developer or shared test database.
- **26 Chromium browser tests:** mobile 375×812 and desktop 1280×800. Notebook UI tests mock API
  responses, while document availability comes from the local API. Real backend behavior is covered
  separately by the HTTP/Postgres suites. Existing create/edit/delete/open flows and English
  reduced-motion collection rendering pass. Purchase scenarios cover the live quote, insufficient
  balance, cap reached, economy-off, changed-price reconfirmation, lost-response retry and refresh
  failure after a successful purchase without a second charge.
- Screenshots of the purchase dialog were inspected at both viewport sizes. It uses the shared
  modal/bottom sheet and buttons, with no clipped text or blocked actions.
- API, web, admin and generated client TypeScript checks passed. Targeted API/web ESLint and
  `git diff --check` passed. Shared types/validation were rebuilt and OpenAPI/client regenerated.

## Persistence and race checks

- Concurrent calls with the same key produce one debit. Different keys with the same stale
  capacity quote cannot accidentally buy multiple slots. Reference keys are scoped to the buyer.
- Confirmed Coin is required; insufficient balance cannot produce a capacity grant.
- Price changes from the audited admin endpoint affect the next purchase; stale displayed prices
  return 409 before spending. Invalid price 0 is rejected. A non-admin cannot edit settings.
- A per-user purchase cap is enforced under the economy transaction lock. Lowering it to 0 stops
  new sales while preserving the two slots already purchased.
- Creation sees the increased quota. Deleting a notebook releases occupancy. Economy-off rejects
  purchase reads/writes while preserving ownership and normal notebook creation within owned capacity.
- Free page, entry and photo quotas stay at their configured values. Premium users cannot be charged.

## Reproduction and limits

- Unit runner: API `vitest.unit.config.ts` with the seven touched/relevant service and mapper suites.
- HTTP runners: `test/notebook-slots.e2e-spec.ts`, `test/notebooks.e2e-spec.ts`,
  `test/ai-coach.e2e-spec.ts`, using an isolated local `TEST_DATABASE_URL` ending in `_test`.
- Browser runner: `PLAYWRIGHT_BASE_URL=http://localhost:3000`, `e2e/notebooks.spec.ts`, both Chromium
  projects. Wait until local API availability is ready and avoid API watcher restarts during the run;
  unavailable SSR snapshots intentionally hide Coin offers.
- Logs: `.artifacts/qa/economy-audit-20261031/notebook-slots-browser-final.log`,
  `notebook-slots-coin-http-regression.log` and `notebook-slots-http.log` (collection suite).
- No production deployment, production setting mutation, real AI call or storage upload was performed.
  Full workspace CI/build was not run; these are scoped development checks, not merge readiness.
