# Earned plan preview verification (2026-11-01)

Scope: daily-greeting rereads, the shared photo quota and explicit Coin-funded plan-page previews.
Approved price: 20 Coin. Approved limit: one preview per rolling 24 hours. Both are admin knobs.
No full workspace test/lint/build pipeline or production rollout is part of this verification.

## Behavior

- A Free daily-greeting taste can reread today's saved note without another generation allowance
  or Coin. A different locale still needs generation access. Global AI-off closes the daily surface.
- Notebook and mock-exam photo calls share the existing `VISION` usage meter. A processed but
  unclassified image counts once; a failed storage read does not count.
- The plan wizard and evidence brief spend nothing. The final quoted confirmation is explicit.
  A changed price is rejected before generating; a new confirmation uses the admin's current price.
- A valid result is persisted before the Coin debit and READY publication commit atomically.
  Model failures, malformed output and no-change results never debit. No-change retains the Coin
  allowance while ordinary AI usage limits still apply. Malformed-output recovery remains available
  to the existing included route; the paid path refuses to charge for that rule replacement.
- Request ID, user, input and locale bind replays. Matching `Idempotency-Key` is mandatory on Coin
  POSTs. Concurrent requests share the rolling allowance; a duplicate cannot call the model twice.
- If another action spends the balance during generation, the result remains locked and can be
  settled later without another model call. Purchases closed: no unpaid confirmation is offered;
  completed owned previews remain readable. Expired abandoned claims never hold or debit Coin.
- Applying a saved preview uses existing plan-revision validation and no new Coin. Closing the
  waiting view does not cancel the server request. KVKK erasure removes preview content, retaining
  the append-only Coin ledger. Premium/capped tastes keep their included routes.
- The Coin catalog adds a plan entry using the same server offer. Its remaining-use labels are
  generic across chat/plan. The preview no longer labels earned access as Premium.

## Evidence

- 105 relevant unit tests passed across eight suites. The greeting regression and strict paid
  parser regression were observed failing before their fixes.
- 23 relevant HTTP/Postgres cases passed across three suites: plan preview, paid-surface access
  and shared photo quota. These cover ownership, idempotency, concurrency, prices/caps, failures,
  insufficient funds/budget, recovery, rolling windows, flags and erasure.
- All **15 plan cases passed again** after the final closure change, including the unpaid-result
  guard: it cannot advertise a Coin confirmation while economy is off.
- **Eight final browser scenarios passed**, four each on mobile and desktop. The browser journey earns its own 20 Coin through real
  profile/email quest events, uses the actual local API and fake model, and performs no seeded
  balance grant. It checks explicit confirmation, one debit, reload/reopen/apply, closed economy,
  stale admin quotes, new 10-Coin confirmation and cached daily-note rereads.
- API/web TypeScript, generated-client TypeScript and targeted changed-file ESLint checks passed.
  OpenAPI/client generation and the final diff whitespace check passed. An interrupted earlier
  browser run was resumed as a fresh fixture run; incomplete output was not counted as a pass.

Logs under `.artifacts/qa/paid-ai-audit-20261101/`: `plan-units-final.log`, `plan-http-final.log`,
`plan-http-closed-final.log`, `plan-browser-confirmed.log`, `plan-api-types-confirmed.log`,
`plan-web-types-confirmed.log`, `plan-client-types.log`, `plan-api-lint.log`, `plan-web-lint.log`,
`plan-openapi-final.log`, `plan-client-generate.log`, `plan-web-lint-confirmed.log` and
`plan-diff-check-final.log`.

## Reproduction and release boundary

Use the opt-in `playwright.notebook-live.config.ts` with
`--grep 'Coin plan preview|Free daily note|Coin-rich Free'`. Tests use the loopback-only disposable
fixture with email delivery disabled. Test fixtures explicitly reset Coin-plan/daily-note flags
so an interrupted prior run cannot change the next run's baseline.

Apply generated migration `0136_coin_plan_previews` before deploying the new API/web. The rollout
key `ai.plan.coin_enabled` defaults false. Enable it deliberately with economy/AI on; price is
`economy.coin.plan_preview_cost`, cap is `ai.plan.coin_daily_limit`. No developer/production
configuration, data or migration was changed in this task. Full CI remains a merge/release gate.

Task-owned databases: `mentor_earned_plan_20261101_test`, `mentor_notebook_live_20261031_test`.
Both were removed after verification. Remaining task-owned databases: zero; remaining listeners on
fixture ports 3501/3510: zero. No real paid AI/payment request or browser email delivery was used.
