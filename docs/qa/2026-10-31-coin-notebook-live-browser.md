# Real-API Coin → notebook browser verification

Date: 2026-10-31. Scope: complete the earned-Coin purchase journey in a real browser against
the real NestJS API and Postgres, without mocked network responses.

## Result

**Four checks passed: two complete journeys on mobile (375×812) and desktop (1280×800).**

| Journey | Verified behavior |
| --- | --- |
| Earn → buy → retain | Profile completion earns 10 Coin through the real profile endpoint/event. The real email verification page earns another 10, displays success and sends exactly one verification POST. The user dismisses Coin/level introductions, creates the included notebook, purchases +1 capacity for 20 Coin, creates another notebook, reloads, logs out, signs in through the login form, deletes and reuses the purchased capacity with no further charge. |
| Dynamic configuration → close/reopen | An admin changes the price from 20 to 10 while the offer is open. The stale click returns 409 and leaves 20 Coin intact. Explicit confirmation of the updated price buys two slots, consuming 20 Coin total. A third purchase is unavailable. Reducing the sale cap to 0 and disabling economy preserves three custom slots. Coin/XP chrome and purchase offers disappear on a fresh document. Deleting and replacing a notebook still works. Reopening economy preserves ownership and does not grant backpay. |

The database independently confirms the final run: four profile grants of +10, four email grants
of +10, two notebook debits of −20 and four notebook debits of −10. No seed Coin, quest completion
or notebook was inserted. Existing Free page/entry/photo quotas remain 20/50/5.

## Bug found and fixed

Development Strict Mode repeated the email page's effect. Network traces showed two verification
POSTs, one 200 and one 400. Postgres correctly recorded one reward, but the second response showed
an invalid-link error after successful verification. The page now shares the same token's request
across effect replays. Strict Mode and backend single-use token checks remain enabled. All four
real-browser cases require a successful verification screen and exactly one verification request.

## Isolation and reproduction

- API: `http://localhost:3501/v1`; web: `http://localhost:3510`.
- The API fixture accepts only loopback `mentor_notebook_live_20261031_test`, and requires explicit
  `QA_NOTEBOOK_LIVE=1` plus `TEST_DATABASE_URL`. Create that disposable database before running.
- From `apps/web`, set those variables and run the installed Playwright CLI with
  `--config playwright.notebook-live.config.ts`. The config starts/stops its own servers and uses
  the ignored `.next/notebook-live-qa` build directory. Each run gets fresh disposable identities.
- Only identities and known one-time email tokens are test fixtures. Normal API guards, Origin
  checks, session cookies, services, rewards and ledger writes run. Auth rate counters are disabled
  by the existing test harness. Email delivery is suppressed, AI/storage use fake providers and
  `ai.enabled=false` proves notebook rights do not require AI availability.
- The task-owned database was removed after verification. No developer/production setting or user
  balance was changed. Full workspace CI/build and production deployment were not performed.

## Evidence and files

- Final log: `.artifacts/qa/economy-audit-20261031/notebook-live-browser.log` (4 passed).
- Initial failure: `notebook-live-before-verification-fix.log` in the same directory. Failed traces
  demonstrated the double request; the final suite records a one-request regression assertion.
- Screenshots: `apps/web/test-results/notebook-live/`, purchased capacity and economy-off ownership
  at both viewport sizes. Screenshots were visually inspected.
- Web TypeScript and touched-file ESLint passed; the API fixture passed targeted ESLint.
- Related: `apps/web/e2e/economy-notebook-real-api.spec.ts`,
  `apps/web/playwright.notebook-live.config.ts`, `apps/api/test/fixtures/notebook-live-server.ts`,
  `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx` and identity/economy feature timelines.
