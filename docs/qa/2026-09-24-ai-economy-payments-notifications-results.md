# Mentor QA — 24 September 2026 — Stage 3 AI, economy, payments and notifications

## Scope and environment

The agreed third wave used the dirty `feature/APP-110` checkout at
`0915d92cb7e04fe721fe8e26eba2f531519f1b72`. The [start snapshot](evidence/2026-09-24-stage3-snapshot.json)
records the existing uncommitted work; the [final hash manifest](evidence/2026-09-24-stage3-final-snapshot.json)
identifies this QA change. Other mentorship and web changes were already in progress in the shared
worktree. Browser results apply to the existing Next production build `dtKtArCT2p0DgzqY_xW69`
and the rebuilt API after the Free calibration fix, not to later web source edits.

The test database was `mentor_test` on local Postgres port 5433. AI, vision, storage, payments and
email used fake providers. Chrome used fresh Playwright contexts and disposable `example.test`
accounts, never a personal browser profile. Real API browser tests ran on web `localhost:3200`
and API `localhost:3201/v1`; mocked subscription UI tests intercepted API responses separately.
No live model, payment, push or email was sent.

## Scenario results

`PASS` means observed in this local environment. `BLOCKED` is reserved for controls requiring a
deployed service or a real provider. API and unit durations are shared suite durations because
their runner did not report a stable per-assertion wall time.

| ID | Expected | Actual result and evidence | Status | Duration |
| --- | --- | --- | --- | --- |
| A01 Free rights | A Free account without an earned right cannot open AI chat or persist a calibration exchange; TR/EN gate agrees with API. | Initial Chrome/API regression returned 201 for direct first-turn calibration while `/coach/access` denied chat. A targeted test failed first. Blocking and streaming calibration now reject before persistence; verified official and safety replies remain local and create no AI usage. Chrome confirms the actual gated page and localized explanation on both routes. [API regression](../../apps/api/test/ai-coach.e2e-spec.ts), [real API Chrome](../../apps/web/e2e/qa-stage3-real-api.spec.ts). | PASS after fix | API red 28.08 s; green 29.80 s; shared final Chrome suite 28.4 s. |
| A02 Premium chat and budget | Fake Premium streams a reply; no Coin spend. Global budget reservations, failure release and cap denial protect paid calls. | The real API streamed a fake reply into Chrome on both viewports; [mobile screenshot](evidence/2026-09-24-stage3-premium-chat-mobile-chromium.png), [desktop screenshot](evidence/2026-09-24-stage3-premium-chat-desktop-chromium.png). Existing AI E2E verifies Premium/coin access, daily limits and idempotent message IDs; targeted budget and usage repository units verify atomic reservation and release. A live-provider billing comparison was not attempted. | PASS locally; provider verification BLOCKED | API/AI shared suites; shared final Chrome suite 28.4 s. |
| E01 Economy ledger and rights | Quest and invitation rewards are bounded, self-scoped, idempotent and append-only; refund reversal never creates a negative usable balance. | Quest and invite E2E passed against Postgres, including concurrent repeat and refund cases. The economy service's 24 unit cases passed for caps, lock order, spend and reversal. [Quest E2E](../../apps/api/test/economy-quests.e2e-spec.ts), [invite E2E](../../apps/api/test/economy-invite.e2e-spec.ts), [ledger units](../../apps/api/src/modules/economy/application/economy.service.spec.ts). | PASS locally | Shared 146.09 s E2E and 19.59 s unit runs. |
| P01 Payment lifecycle | Fake checkout and signed webhook drive entitlement once; bad signatures and replay do not grant twice; UI reflects active or unavailable checkout states. | Payment E2E passed for Free, trial, success/failure/cancel, invalid signature, replay and incomplete checkout. Chrome real API showed the seeded fake Active subscription; the **separate mocked UI suite** passed price, disabled checkout, paywall and result screens, 10/10. [Payment E2E](../../apps/api/test/payments.e2e-spec.ts), [mock UI](../../apps/web/e2e/subscription.spec.ts). | PASS locally; real iyzico BLOCKED | Shared 146.09 s API run; mock Chrome 14.9 s total. |
| N01 Notification settings and queue | Browser preference survives reload; cron requires its secret; fake email job completes. | Email reminder switch persisted through mobile and desktop Chrome reloads. Four notification queue E2E tests passed; no external mail was sent. [Browser test](../../apps/web/e2e/qa-stage3-real-api.spec.ts), [queue E2E](../../apps/api/test/notifications.e2e-spec.ts). | PASS locally | Shared final Chrome suite 28.4 s; shared API run. |
| N02 Stream and push safety | One-time stream token is session-bound; revoked sessions close; push failures retry without false delivery records. | Four stream-token and two push-handler unit cases passed. Stage 1 separately tested push target policy and SSE token misuse locally. Browser push delivery and a deployed multi-instance stream were not exercised. [Stream units](../../apps/api/src/modules/notifications/application/notification-stream.service.spec.ts), [push units](../../apps/api/src/modules/notifications/application/handlers/send-push.handler.spec.ts). | PASS locally; live delivery BLOCKED | Shared 19.59 s unit run. |

### Run totals and diagnostics

- Eight existing API E2E files: **63/63 passed in 146.09 s** before the new regression.
- Eight focused AI/economy/payments/notifications unit files: **76/76 passed in 19.59 s**.
- After the fix, AI coach E2E plus the two chat unit files: **67/67 passed in 37.85 s**.
- After adding an earned-right repeat and revoked-right regeneration regression, the full AI coach E2E file passed: **18/18 in 74.43 s**.
- Final installed Chrome with real API: **6/6 passed in 28.4 s** across mobile and desktop viewports, using one worker to avoid local Chrome resource contention.
- Installed Chrome with mocked payment API responses: **10/10 passed in 14.9 s**. These do not prove real webhook or checkout behavior.
- Targeted API TypeScript check, API production build and changed-file ESLint passed. Web changed-file ESLint passed. Full CI and a fresh web build were not run; the shared worktree includes unrelated ongoing web edits.

The first browser run exposed the real A01 calibration gap. Subsequent harness runs showed three
test-data issues, retained in Playwright traces under `apps/web/test-results` during execution:
an earlier AI E2E left `economy.enabled` on, so profile completion earned Coin; the account's
first journey-level celebration covered the chat send button; and the real local plan catalog
allowed fake checkout, while an initial browser assertion assumed checkout was disabled.
The fixture now uses an append-only Coin adjustment to create a no-right Free account,
acknowledges the separate level event before testing chat, and asserts the actual Active
subscription facts. The AI E2E teardown now restores `economy.enabled=false`.
Review also confirmed the local calibration prompt can repeat while a Free account has an earned
right. This is deterministic onboarding content: the regression asserts two repeats with no Coin
debit and no AI usage. Disabling the earned path then makes regenerate return 403 without changing
the stored coach reply. It does not grant repeated model calls. A standalone N01 browser run found
the first journey-level celebration could cover the settings switch; that test now acknowledges
its own pending celebration before clicking. One two-worker Chrome run timed out during mobile
context teardown; the independent N01 rerun and final one-worker six-test suite both passed.
An early targeted API test tried to create a sixth account inside the same fixture and correctly
hit the signup rate limit (429); it now reuses a disposable account and restores its ledger balance.
An unprivileged Chrome attempt could not reach the Docker test database; the approved isolated
rerun completed without using a personal browser session.

## Decision and next gate

No open local P0/P1 remains in this Stage 3 scope after the calibration fix. Official/safety
replies are intentionally deterministic and do not consume a model budget. The stage is locally
complete. Staging must still verify Cloudflare/Render/R2 behavior, real iyzico and push delivery,
and Chrome/Firefox/real Safari before release. The next product wave is community, mentorship and
admin with Free/Premium, relevant roles, TR/EN and mobile/desktop coverage.
