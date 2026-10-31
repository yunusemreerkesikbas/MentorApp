# Ritual progress without economy rewards

Owner approved 2026-10-31. Daily rituals, their actions and completion progress remain available when economy.enabled=false. XP/Coin balances, amounts, earning celebrations and purchases stay closed. Existing plan/mood/session behavior and ledger history remain intact.

## Implementation

1. Separate quest completion persistence from reward issuance. Keep the existing authenticated quest endpoint available; return NONE/zero reward metadata when closed. Record completed periods once without ledger writes so reopening cannot pay those periods retroactively. Preserve reward caps and transaction rollback while enabled.
2. Gate economy presentation and synchronization with effective availability and disabled responses. Keep ritual reads/actions; clear stale balance presentation and suppress receipts/celebrations. Hide economic actions and chest reward amounts while retaining progress.
3. Add focused backend and browser regressions for closed progress, no grants/backpay, open rewards, cold-load closure and closure with an open sheet. Run targeted package checks, review the change, and append feature timelines.

## Limits

No new currency, entitlement store, database migration or dependency. No environment flag changes, AI purchases, pricing changes or extra notebook feature in this slice. Reopening is picked up on a fresh document load; no realtime flag subscription is introduced.
