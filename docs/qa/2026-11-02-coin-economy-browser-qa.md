# Coin economy rebalance: browser QA and security review (2026-11-02)

Scope: the 2026-11-01 ×10 rebalance (free users earn 10 Coin per active day + 100 Coin weekly chest,
Premium earns XP instead, quiet Coin toasts) run in the local app with the economy on, plus a security
pass over reward farming, client-supplied dates, idempotency, entitlement checks and IDOR.

Setup: local API + web, local DB overrides rebalanced to the new catalog values (an old 2026-09-15
override set kept the chest at 15 Coin). Demo students from `apps/api/scripts/seed-economy-demo.ts`
(`ekonomi-ucretsiz@demo.test`, `ekonomi-premium@demo.test`; password in the script). Server days are
UTC: during the run the server day was 2026-11-01 while the browser showed 2 Kasım (Istanbul).
Every scenario was checked in the browser and against the ledger rows.

## Why the chest showed 15 Coin

1. The local `config_overrides` still held the 2026-09-15 values (`weekly_allowance_reward_coin` 15,
   onboarding 10, AI 5 Coin ...). Overrides beat catalog defaults. Fixed locally; **production may hold
   the same overrides**, see the audit step in `docs/core/deployment.md`.
2. A chest already paid under the old config keeps its ledger amount (no backfill, by design), so
   `sandik-hazir@demo.test` still shows 15. New weeks pay 100.

## Finding fixed

**Backdated study sessions paid past days' Coin.** `POST /v1/study-sessions` accepted any client
`startedAt`; finalizing such a session marked that old day active and evaluated quests for it. A free
user could claim 10 Coin for every past day and 100 Coin for every past week (up to the 500/2000 caps,
with the rest waiting as pending), and inflate the streak. No client sends `startedAt`. The server
now rejects a start older than the 24-hour resume window or more than one minute ahead
(`VALIDATION_ERROR`, 400). RED→GREEN: `session.service.spec.ts` (2 failing → 32/32); coaching e2e
"closes ancient orphans" now asserts the 400 and seeds the orphan directly (passes on the HTTP stack).

## Verified scenarios

| # | Scenario | Result |
| --- | --- | --- |
| A1 | Free: first panel visit | Onboarding +200 Coin full-screen celebration. Pass |
| A2 | Free: 5 active days last week | Chest scene shows +100 Coin; ledger 100. Pass |
| A3 | Free: daily quests | "Bugün 1 odak seansı ya da 1 plan görevi bitir · +10 Coin" row. Pass |
| A4 | Free: tick today's task | +10 Coin and +50 XP as toasts, no celebration; 310 Coin / 250 XP. Pass |
| A5 | Free: undo + redo the same task | No new toast, no new ledger row. Pass |
| C1 | Free: tick a task dated two days ahead | No toast, no ledger row, balance unchanged. Pass |
| C2 | Free: tick a task dated tomorrow (local today) | +10 Coin quiet toast, +50 XP, no celebration. Pass |
| D1 | Free: Ayarlar → Bakiyen | Notebook 200, coach message 50 Coin; level bar 550 / 1.000 XP. Pass |
| B1 | Premium: first panel visit | Onboarding +200 Coin celebration (welcome Coin is for everyone). Pass |
| B2 | Premium: daily quests | No daily Coin row; three XP rows only. Pass |
| B3 | Premium: open the chest | Chest scene shows +200 XP, no Coin. Pass |
| B4 | Premium: tick today's task | +50 XP toast only; `daily.active-day` recorded without a ledger row. Pass |
| S1 | Backdated session `startedAt` | Was farmable; now 400 (see above). Fixed |

## Security review notes

- Past plan days are read-only (`assertTaskDateMutable`); a task more than one day ahead cannot pay
  its day early (quest guard). Mood check-ins use the server day.
- Every economy endpoint takes the user from the token (`@CurrentUser`); none accepts a user id.
- Premium is read from the server entitlement once per evaluation; a lapsed Premium never backpays
  a hidden daily Coin (progress row recorded unpaid).
- Repeats are idempotent (progress unique key + ledger refId); concurrent earning is covered by
  `economy-earning-audit` and `economy-quests` e2e.
- Invite Coin (200) pays only after the invited user's first positive payment.
- Accepted risk (by design): an active day is self-reported (any ticked task or a session whose focus
  seconds the client reports). It pays once per day, so the honest maximum is the ceiling.

## Open item (pre-existing, not fixed)

After the first-login celebration the nav Coin pill can show the pre-grant balance (0) until the next
navigation: `EconomySync` reads the balance before `/economy/quests` grants and does not re-read it
after presenting receipts. Self-heals on the next page change.
