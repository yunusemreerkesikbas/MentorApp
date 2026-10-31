# Coin spend safety verification

Date: 2026-10-31. Approved scope: prevent reused earned-Coin chat requests from running the model
again, and refuse deep-analysis purchases while AI is disabled. No runtime flags, prices, providers,
production data or schema were changed. The permanent extra-notebook model is a later slice; price
and maximum additional capacity remain pending owner input.

## Changes

- Both chat transports share the existing Coin authorization path. A spend reference already used
  returns localized HTTP 409 CONFLICT before a second model call/history write. Replays do not
  debit again or refund the original operation. Fresh failed requests retain compensating refunds.
- EconomyService now handles a unique-reference collision at INSERT, including different users
  holding different advisory locks. The losing insert reports alreadySpent rather than pretending
  that a debit landed.
- Deep-analysis state checks ai.enabled before reading the offer, and purchase checks again just
  before spending. Initially disabled requests return AI_DISABLED without a spend or unlock.

## Evidence

| Check | Result |
| --- | --- |
| Initial focused RED regressions | Five failures reproduced model replay and disabled-analysis debit; a sixth RED check reproduced misreported insert-time collisions. |
| Focused backend units | 101 passed across six files: chat, Mentor chat, weekly narration, economy, deep analysis and streak rescue. |
| Real HTTP/Postgres | 20 passed in ai-coach.e2e-spec.ts, with fake AI/provider adapters and an isolated loopback test database. Includes blocking/streaming replay rejection, unchanged usage/balance after replay, AI-off offer/purchase denial, and a concurrent two-user global-reference collision with one debit. |
| TypeScript and lint | API source compiler and touched-file ESLint passed. |
| Diff whitespace | Passed. |

The replay fixture now generates a fresh UUID per test run. Reusing its former fixed UUID against
an earlier run's immutable ledger correctly produces a conflict for the first request; the old fixture
was therefore unsuitable for reruns. No historical ledger row was removed to make it pass.

## Limits

This rejects duplicate Coin requests; it does not cache/replay their response or add Premium request
idempotency. A new send needs a new clientMessageId, including after a failure/refund; the web already
generates a new ID on send. Existing durable analysis unlock/retry semantics remain intact if a later
narration fails. Budget reservation/refund redesign and full workspace CI/build are outside this slice.
No real paid model, payment or production deployment was used for verification.
