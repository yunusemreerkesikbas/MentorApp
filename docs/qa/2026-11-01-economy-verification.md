# Economy earning and closure verification (2026-11-01)

Scope: existing Coin/XP sources, earning caps, repeat processing, closure/reopening, admin changes
and notebook ownership. This report supplements the notebook, use-catalog and weekly-analysis audits.

## Findings and fixes

1. **Disabled invite payments were discarded instead of settled.** The listener returned before
   recording an outcome. The conversion service itself also lacked the economy check. Delivery now
   reaches that service while closed, recording `CONVERTED / DISABLED` and the source payment without
   Coin. Reopening and replaying that delivered event cannot grant it. A unit test reproduced the
   discrepancy before the fix; a real fake-provider webhook/outbox case verifies the complete path.
2. **A verified step blocked by earning conditions still offered verification again.** Self quest
   reads now return optional localized `rewardPendingMessage` and `action: null`. The row shows a
   completed-step indicator and the pending explanation, without an immediate payout or repeat action.
   The actual grant/completion still retries under the existing rules. Hints are period-scoped and
   disappear after grant or economy closure. OpenAPI/shared contracts/client were updated. Config
   reads and response mapping were extracted to keep `QuestService` within the repository size target.

## Verified scenarios

| Scenario | Observed result |
| --- | --- |
| Three concurrent grants against a 10 Coin daily cap | One grant; the others rejected. Spending 5 Coin does not restore earning headroom. |
| Rolling weekly cap with a 36-hour-old organic grant | The weekly cap blocks a second grant even though today's cap has room. |
| Minimum XP and admin correction | Coin waits for required XP. An audited correction does not consume organic earning headroom. |
| Default weekly target | Four active dates do not pay; five pay 15 Coin once per ISO week. Another week can pay once. A recorded closed week does not backpay after reopening. |
| Normal invite lifecycle | First positive payment, duplicate delivery, coach exclusions, refunds, promotions, public preview and rate limits pass existing regressions. Source-payment refund still reverses a real grant while economy is off. |
| Closed browser account | Profile, email verification and a task complete without Coin/XP. Quests remain visible without reward amounts; reopening pays none of those recorded completions. |
| Daily cap / live reward setting | Profile pays 10 Coin; email verifies but its reward waits at the cap. The UI explains the wait and offers no verification action. Admin changes the reward to 7 and cap to 17; one later claim produces exactly 17 total, with ledger amounts 10 and 7. A student cannot change config (403). |
| Weekly browser example | Real plan task creation/completion gives one active day. The default target remains five; the audited test-only change to one pays 15 Coin once. Undo/re-complete cannot farm another payment. Balance moves from onboarding 20 to 35 Coin. |
| Notebook browser examples | Earned 20 Coin buys permanent +1 capacity. Reload/login/deletion preserve/reuse it. Stale 20-to-10 Coin quotes require reconfirmation; the two-slot cap works. Closure and a lower sale cap preserve owned capacity. Other Free quotas remain intact. |

## Evidence

- **106 unit tests passed:** economy, quests, dated triggers and invites. RED evidence:
  `invite-closure-red.log`, `quest-pending-red.log`. Final: `economy-units-final.log`.
- **56 distinct HTTP/Postgres cases passed:** 11 existing quest cases, 34 invite cases, five admin
  metrics cases and six new earning-audit cases. Affected suites were rerun after changes. Final
  earning verification includes English localization and closed-hint removal.
- **10 real-API browser cases passed** at mobile 375×812 and desktop 1280×800. The complete cohort
  passed again after pending-right UI changes. No browser response mocks or seeded Coin were used.
  Screenshots of closed progress, pending rewards, changed balances and weekly completion were viewed.
- API/web/shared-client TypeScript, targeted API/web ESLint, TR/EN key parity and diff whitespace
  checks passed. Shared types and the generated client were built; OpenAPI/client regenerated.
- One test initially asserted conversion before a background worker finished its job. Database
  evidence showed the job `RUNNING`, with no handler error. The test now waits for the persisted
  settlement instead of assuming its own manual batch owns every job. The six-case rerun passed.

Logs: `.artifacts/qa/economy-audit-20261101/`. Relevant files include `existing-economy-http.log`,
`invite-http-final.log`, `earning-quests-http-final.log`, `earning-audit-verified.log`,
`live-browser-first.log` and `live-browser-final.log`. The combined intermediate HTTP log records
the timing failure above; `earning-audit-verified.log` is the corrected final six-case result.
Screenshots: `apps/web/test-results/notebook-live/`, including `capped-reward-pending.png`,
`closed-ritual-progress.png`, `admin-cap-and-reward.png`, and `weekly-earned-once.png`.

## Reproduction and limits

API: create a disposable loopback database ending in `_test`, set `TEST_DATABASE_URL`, then run the
installed Vitest CLI in `apps/api` for `test/economy-earning-audit.e2e-spec.ts`,
`test/economy-quests.e2e-spec.ts`, `test/economy-invite.e2e-spec.ts`, and
`test/admin-economy-metrics.e2e-spec.ts`. Units use `vitest.unit.config.ts` and the four suites above.

Browser: create `mentor_notebook_live_20261031_test`, set `QA_NOTEBOOK_LIVE=1` and that dedicated
`TEST_DATABASE_URL`, then run the installed Playwright CLI in `apps/web` with
`--config=playwright.notebook-live.config.ts`. This starts/stops API 3501 and web 3510, seeds only
disposable identities/email tokens, disables paid AI/storage and suppresses email delivery. The
browser weekly example explicitly lowers the target to avoid waiting days; the default five-day
rule is tested separately against historical source activity in the API suite. Admin mutations
use the real audited API; the separate admin-panel UI was not driven.

Both task-owned databases (`mentor_economy_audit_20261101_test` and
`mentor_notebook_live_20261031_test`) were removed after checking there were no open connections.
Browser listeners closed and QA-only Next type paths were restored. Developer/production settings
and balances were not changed. Payment notifications use the fake provider; no paid AI call was made.

The invite gate is evaluated at event delivery: this fix makes a disabled delivery durable. It
does not reconstruct historical flag state for events not delivered yet or automatically repair
older discarded events. Cap-denied quests may retry at the current reward while eligible; recorded
closed completions do not backpay. Existing small-screen title ellipsis and motion/image warnings
remain; no tested action was obstructed.

These scoped checks verify the economy flows. Full workspace CI/build, an isolated merge review
and deployment remain separate requirements before declaring the branch release-ready.
