# Weekly Wrapped access verification (2026-11-01)

Scope: owned full Wrapped stories, one earned first report, rolling Coin access, durable AI
narration and archives. This is scoped development verification, not a full-workspace green claim.

## Target and provider safety

- Dedicated task-created loopback database: `mentor_wrapped_20261101_test`, PostgreSQL port 5433.
  New generated migration: `0137_weekly_wrapped_reports`. No developer/production DB was used.
- API fixture uses fake AI/vision/payment/storage providers; browser fixture suppresses email and
  explicitly checks the disposable database name. No real paid model or delivery was exercised.
- Browser users verify email through the real flow and earn their profile/email Coin. Last week's
  completed study evidence is prepared only in the test fixture; Free past-plan editing is not relaxed.
- Runtime settings are changed only in that disposable fixture, including real audited admin HTTP
  updates in the browser tests. No live production setting was changed. A subsequent user-approved
  follow-up sets the catalog's access-enforcement default to on; explicit admin overrides still win.

## Results

- **51 relevant existing/new unit tests passed** across report policy, weekly narration, Coin
  access/catalog, Premium feature gates, completion, private erasure and fail-closed gate registration.
- **18 HTTP/PostgreSQL cases passed** in `test/weekly-recap-access.e2e-spec.ts`: server-side direct
  gates, free base analysis, explicit ownership, immutable rereads, verified first grant, separate
  Coin quota, cross-exam concurrent claims, shared rolling history and dynamic duration/limits,
  stale quotes, provider failure, missing idempotency header, duplicate requests, generated-result
  settlement recovery, legacy paid rights/cache, global budget, expired-worker fencing, archive
  pagination, subscription expiry, explicit Coin recovery of saved earned output after grant reuse,
  and tenant/private erasure.
- **Four real-browser cases passed** on mobile (375×812) and desktop (1280×800): earned report
  generation, owned playback/archive with AI off, stale admin quote refresh and explicit Coin
  purchase, and preserving an owned report when the Coin cap becomes zero.
- **32 distinct browser scenarios verified** across both viewports: the final complete matrix
  passed 30 cases, and the two retry-error cases passed in the focused follow-up after correcting
  their development-mode fixture. This includes READY/PARTIAL/EMPTY playback, keyboard/swipe,
  TR/EN routes and Escape, legacy budget behavior, explicit Coin confirmation and the real API
  ownership/archive journeys. Logs: `browser-final.log` (30 passed) and
  `browser-retry-final.log` (2 passed). No full-matrix green run is implied by these separate runs.
- API/web/shared client type checks and changed-file API/web/admin/shared-contract lint passed.
  Generated client whitespace is normalized to the
  existing checked-in convention, without changing unrelated operations.

## Review and limits

An independent read-only review identified that an expired worker could write its cache before
checking the claim fence. Cache persistence now happens in the same short transaction after
validating the active claim; the HTTP regression proves that a resumed loser cannot overwrite
the winner or debit again. Retained prices for already accepted/generated work and completion of
a Premium request accepted before expiry are intentional, matching the accepted-claim contract.

Process failure before persistence can require another external model attempt; all attempts remain
metered. The guarantee is one published owned narration and one Coin debit, not exactly-once
remote inference in the presence of a crash. Stored reports retain their original language.

Existing dev-browser warnings include reduced-motion diagnostics and image-sizing/LCP hints from
shared/auth/old-story surfaces. They were not treated as new behavior or silently suppressed.

A mistaken lint file filter briefly scanned the API package generally and exposed existing errors
in unrelated scripts. The filter was corrected and the changed-file run passed. Those unrelated
errors were not modified. Full workspace tests/build/CI, merge and deployment were not performed.

The legacy browser fixture initially targeted the normal test API port instead of this isolated
fixture. The live QA config now supplies the matching API URL and origin. Subsequent regressions
also exposed a real legacy reload race: loading the economy flag restarted the story request and
could hide a fetch error without user retry. Story reads and legacy access reads are now separate.
Unrelated onboarding celebrations are acknowledged through the ordinary self API before the real
Wrapped browser journey, avoiding two overlapping setup overlays.
Development-mode Strict Mode replays the initial effect, so the retry fixture now returns errors
until the user explicitly retries, then asserts exactly one additional weekly request. It no longer
consumes a one-shot failure on an aborted initial effect. No production behavior was weakened.

The task-owned disposable database was removed after verification. API/web fixture servers stopped;
no listeners remained on their dedicated ports. Unrelated workspace changes were preserved.

## Default-on follow-up

At the user's request, `coaching.weekly_recap.access_enabled` now defaults to true. All 19 registry
tests passed, including default-on behavior and admin off/on overrides. Targeted lint passed for
the catalog, registry tests and the two explicitly legacy HTTP test fixtures. The latter opt out
of the new default deliberately so their legacy-policy assertions remain meaningful; they were
not rerun against a database for this configuration-only follow-up. No live DB override was written.

## Reproduction

- Unit: from `apps/api`, run the relevant `src/modules/{ai,coaching,economy}/**/*.spec.ts` paths
  with `node node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts`.
- HTTP: set `TEST_DATABASE_URL` to a disposable loopback `_test` database and run
  `node node_modules/vitest/vitest.mjs run test/weekly-recap-access.e2e-spec.ts`.
- Browser: from `apps/web`, set `QA_NOTEBOOK_LIVE=1`, `QA_WRAPPED_LIVE=1` and the same dedicated
  `TEST_DATABASE_URL`; run `node node_modules/@playwright/test/cli.js test --config
  playwright.notebook-live.config.ts weekly-recap-real-api.spec.ts weekly-recap.spec.ts
  weekly-analysis-access.spec.ts`. The fixture rejects any other database name.

Local logs/screenshots: `.artifacts/qa/wrapped/` and
`apps/web/test-results/notebook-live/`. Use the dated feature timelines for rollout instructions.
