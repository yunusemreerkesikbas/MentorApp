# Weekly analysis access verification (2026-10-31 / 2026-11-01)

Scope: align weekly analysis offers, Coin purchase, narration and the balance catalog without
changing the default 25 Coin price or enabling Free AI. Existing notebook pricing/capacity is unchanged.

## Verified behavior

| Scenario | Result |
| --- | --- |
| Legacy deep-analysis taste enabled, weekly narration disabled | No misleading free unlock; narration remains gated. |
| Weekly taste enabled with allowance remaining | Offer is included; purchase does not spend; narration succeeds. Both public feature-policy IDs report the weekly setting. |
| Rolling weekly taste exhausted | Offer becomes locked; ordinary narration is denied; Coin purchase grants the durable exam/week right. |
| AI disabled / economy disabled | Expected `AI_DISABLED` / `ECONOMY_DISABLED`; no new Coin debit. |
| Active AI reservations fill capacity | GET reports unavailable generation without creating a hold; POST returns `AI_BUDGET_EXCEEDED` without a debit. |
| Budget closes after an available offer | Purchase rechecks actual capacity. A rejected browser purchase removes the stale Coin/Premium actions and shows temporary unavailability. |
| Two concurrent purchases | One ledger debit, one exam/week right. |
| Provider fails after purchase | Right remains; purchase/retry does not charge again. |
| Purchased matching cached narration with exhausted budget | Cached report is returned without another provider call or Coin debit. |
| Premium subscription | Included without Coin spend; AI-off still blocks narration. |

## Results

- **55 focused unit tests passed** across deep analysis, weekly narration, catalog adaptation, budget
  guard, feature gate and feature-access decisions. Four new tests first reproduced the missing policy
  and budget checks; the stale-offer browser case also failed before its fix.
- **9 real HTTP/Postgres cases passed:** five in `weekly-analysis-access.e2e-spec.ts` and four existing
  catalog regressions in `economy-uses.e2e-spec.ts`. The five weekly cases passed again after adding
  canonical public-policy assertions and strengthening the active-reservation fixture. Real auth,
  historical completed plan tasks, subscriptions, feature configuration, budget reservations and
  ledger operations are exercised. Only the model provider is fake; one provider failure is injected.
- **14 browser cases passed**, seven at 375×812 and seven at 1280×800: budget closure, owned cached
  report, included access, closure after the offer, existing background narration, two-step Coin
  confirmation and TR/EN navigation/Escape. Mobile unavailability screenshot was visually inspected.
- API, web and shared client TypeScript checks passed. Targeted API/web/admin lint, mirrored TR/EN
  translation keys and `git diff --check` passed. OpenAPI and the generated client were regenerated;
  the recap now uses typed generated deep-analysis operations.

## Reproduction and isolation

API (from `apps/api`, after creating a dedicated loopback database ending in `_test`):

```powershell
$env:TEST_DATABASE_URL='postgres://mentor:mentor@localhost:5433/<dedicated>_test'
node node_modules/vitest/vitest.mjs run test/weekly-analysis-access.e2e-spec.ts test/economy-uses.e2e-spec.ts
```

Browser (from `apps/web`):

```powershell
node node_modules/@playwright/test/cli.js test --config=playwright.weekly-analysis.config.ts --grep 'AI Puhu|TR/EN|bütçe|dahil|tekliften sonra'
```

The browser config owns web 3520 and reuses the existing public SSR fixture on 3521. Browser API
actions are mocked; backend semantics are verified separately through actual HTTP/Postgres. An
initial run against the ordinary development API exposed a missing SSR availability response and
a keyboard-readiness race in the test. The dedicated SSR fixture and an explicit playback
interaction remove those dependencies; no production availability fallback was introduced.

The isolated database `mentor_weekly_access_20261031_test` was removed after confirming no open
connections. Both browser fixture listeners closed after teardown. Next-generated QA-only type paths
were restored. Developer/production flags and balances were not changed; no paid model call was made.

Ignored run logs are under `.artifacts/qa/economy-audit-20261031/`: `weekly-access-http.log`,
`weekly-access-http-final.log`, `weekly-access-browser-isolated.log`, `weekly-access-stale-red.log`,
and `weekly-access-browser-final.log`. Screenshots are under `apps/web/test-results/weekly-analysis/`.
Existing mascot image sizing/LCP warnings remain outside this change.

These are scoped development checks. Full workspace CI/build, deployment and production rollout
were not performed. A purchase grants the durable weekly right; a later provider/budget change may
delay generation. It does not reserve future model capacity indefinitely or introduce a refund flow.

Related: [implementation plan](../plans/2026-10-31-weekly-analysis-access.md),
[economy timeline](../features/economy.md), [AI timeline](../features/ai.md).
