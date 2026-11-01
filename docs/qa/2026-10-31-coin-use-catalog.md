# Coin use catalog verification — 2026-10-31

Scope: the profile/settings balance sheet lists existing notebook, chat and weekly-analysis rights.
No price, earning rule, entitlement, purchase endpoint or chat-zone Coin surface was introduced.

## Results

| Check | Result |
| --- | --- |
| Focused backend units | 15 passed across economy catalog composition, AI catalog adaptation and existing coach access. Covers dynamic costs, owned/Premium/conditional rights, missing/unready review, balance, daily limits, AI/budget closure and conflicting legacy weekly taste gates. |
| Real HTTP/Postgres | 4 passed in `test/economy-uses.e2e-spec.ts`: auth and economy-off, notebook availability with AI-off, dynamic costs and actual daily ledger counters, Premium inclusion and closed budget. A spy confirms no LLM calls. Repeated catalog reads do not change balances; the only AI usage is the explicit test budget fixture. |
| Browser UI | 18 passed: eight catalog scenarios plus the existing balance/reward-refresh regression, at mobile 375×812 and desktop 1280×800. Includes live price refresh, insufficient Coin, Premium, owned weekly rights, error/retry, TR/EN, closed initial load, closure while open and a late successful pre-closure response. Affected closure/error cases passed again after the auto-dismiss refinement. |
| Real-API browser journey | 2 passed, mobile and desktop, using the dedicated web/API fixture without response mocks. Profile and email events earn 20 Coin; the balance catalog shows 20-Coin capacity and owned slots. Reading/opening a card leaves 20 Coin intact; the owning notebook purchase then consumes it. Reload, login, deletion and reuse preserve capacity. |
| Static checks | API/web/generated client TypeScript checks and targeted ESLint passed. OpenAPI/client were regenerated, new TR/EN keys are mirrored and diff whitespace passed. |

## Behavior

- Usage: Ayarlar/Profil → Bakiyen → Coin ile neler açabilirim? Each action opens the owning screen;
  no purchase is performed in the catalog. Weekly analysis links to the weekly story screen.
- Costs, eligibility, purchased capacity and rolling daily allowance come from the backend. Premium
  and included/owned rights carry no Coin price. XP is explicitly non-spendable and non-convertible.
- Refresh updates both wallet and catalog. A failed read removes old offers and shows retry.
  Economy-off hides Coin/XP and closes an open balance sheet. Late responses cannot reopen offers.
- Economy owns the read model and registers an AI resolver rather than importing AI back. Existing
  `CoachAccessService` and `DeepAnalysisService` remain authoritative. No cross-module table access,
  schema migration, price override or production mutation was added.
- The legacy weekly offer and narration taste switches differ. If they disagree the catalog uses
  UNAVAILABLE, avoiding a false free/paid promise. No underlying policy was broadened. An already
  purchased weekly right remains distinct from a new generation, whose own guards still apply.

## Evidence and isolation

- Logs under `.artifacts/qa/economy-audit-20261031/`: `coin-catalog-http.log`,
  `coin-catalog-browser-final.log`, `coin-catalog-closure-final.log`,
  `coin-catalog-fixture-final.log`, `coin-catalog-live-browser.log`.
- UI API responses are mocked in `economy-uses.spec.ts`; real backend behavior is tested separately.
  `economy-notebook-real-api.spec.ts` uses the actual API, auth cookies and Postgres. It was run with
  `playwright.notebook-live.config.ts --grep 'earned Coin'` for the two affected journeys.
- Dedicated local databases: `mentor_coin_catalog_20261031_test` and
  `mentor_notebook_live_20261031_test`. Both were removed after checks. Developer/production balances,
  flags and provider settings were untouched. AI/storage providers were fake; no paid model call.
- Screenshots in `apps/web/test-results/` were inspected. Large balance content scrolls within the
  shared sheet/modal; options remain reachable by touch and keyboard.
- Full workspace CI/build and production deployment were not run. These are scoped development checks.

Related: `economy-uses.service.ts`, `economy-uses.registry.ts`, `economy-ai-uses.service.ts`,
`economy-uses.controller.ts`, profile `economy-uses-card.tsx`, `economy-balance-card.tsx`,
`economy-section.tsx`, shared economy types, generated client, and the economy/AI feature timelines.
