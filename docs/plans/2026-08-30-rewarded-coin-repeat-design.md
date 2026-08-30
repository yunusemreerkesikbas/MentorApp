# Rewarded Coin Repeat and Banner Redesign

## Product decision

Free users may complete both daily rewarded-ad rights consecutively. The configurable cooldown is
zero; each ad still requires a separate explicit click, reward session and idempotent completion.
The dashboard banner markets the broader Coin-task opportunity rather than advertising itself:
`Günlük görevlerinde {count} Coin seni bekliyor. Görevleri aç →`. The task row remains transparent
before the ad opens: `Kısa bir reklam izle` / `Reklamı izle`.

## Interaction design

The static dashboard top banner stays at the top of the content flow and receives a calm,
token-based horizontal gradient. Its Coin total derives from `rewardCoin * dailyRemaining`. After
the first completion it remains visible with the remaining Coin amount; after the daily limit is
reached it disappears. Session dismissal behavior is unchanged.

The rewarded task stays in the open Tasks sheet. A successful completion produces a short success
toast, then the same row refreshes from the backend offer. With one right left it prepares a fresh
GPT slot and enables a second explicit `Reklamı izle` action. At zero rights it becomes a passive
`2/2` completed row. The organic ritual percentage, XP and streak remain unchanged.

## State and failure handling

Completion never manufactures local eligibility. The rewarded component disposes the completed
slot and listeners, re-fetches the backend offer and builds a fresh slot only when that response is
eligible. Parent dashboard state receives the same refreshed offer for banner copy and visibility.
No-fill and uncertain completion retain the existing close/retry/idempotency rules.

## Verification

The Ads Playwright scenario must prove two explicit clicks create two distinct sessions, award Coin
twice, keep the banner after the first completion, show a toast, and hide the banner only after the
second completion. Targeted web unit tests, touched-file lint and web typecheck complete the scope.
