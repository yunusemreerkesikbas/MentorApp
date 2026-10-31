# Economy earning and closure verification

Approved scope: verify all existing earning sources, caps, idempotency, economy closure/reopening,
admin configuration and retained notebook rights; include real-browser example journeys. Preserve
current product prices and limits. Do not enable economy or change balances in developer/production DBs.

- [x] Audit earning listeners, dated quest evaluation, caps, receipts and refund compensation.
- [x] Run existing quest/invite/admin-metrics HTTP suites in a task-owned local test database.
- [x] Add focused real-DB coverage for concurrent daily/weekly caps, minimum XP, five-day weekly
  earning, replay after closure and a first paid invite processed while economy is disabled.
- [x] Reproduce and fix disabled invite delivery/replay and misleading verification actions for
  met quests waiting on Coin earning conditions. Preserve the existing retry/current-reward policy.
- [x] Run real API browser journeys on mobile and desktop: earn/use Coin; closed core progress
  without backpay; caps/admin reward changes; weekly target changes; notebook ownership and pricing.
- [x] Record results, limitations, cleanup and rollout readiness. Run targeted checks for changes.
  See [verification report](../qa/2026-11-01-economy-verification.md).

Use the existing opt-in notebook browser harness and disposable accounts; add separate scenario files
and helpers instead of expanding the existing test file. Browser weekly earning may lower the target
through the audited admin endpoint to avoid waiting days; test the default five-day rule separately
with historical source activity in the API suite. No Coin is seeded in browser journeys.
