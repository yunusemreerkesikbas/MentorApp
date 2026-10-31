# Economy availability audit, 2026-10-31

## Scope and evidence limits

Read-only review of the current development application and isolated diagnostic tests. No application source, development feature flags, user balances or provider settings were changed. Diagnostic fixtures and logs are under this directory; they are not production regression tests. Browser checks use the current localhost:3000 web application with intercepted economy responses. The document-level availability provider still comes from the development server. Real HTTP/Postgres tests independently exercise the actual backend disabled flag. No live AI calls were made.

## Effective development state

GET http://127.0.0.1:3001/v1/app/availability returned economy=true, invites=true and aiCoach=true, twice during the audit. A read-only query of the local development database found config_overrides.key=economy.enabled with value=true, last updated 2026-08-01T12:02:51.987Z. Catalog defaults and the approved core-only trial plan are not the effective configuration of this running development instance. No production availability was established.

The supplied screenshot shows +5 XP quest offers, not proof of a new Coin ledger entry. With economy enabled, onboarding/profile and verified email each grant their own Coin; daily rituals grant XP.

## Disabled backend result

The isolated HTTP diagnostic sets economy.enabled=false through the actual config service before creating a separate synthetic student. Profile completion, email verification, mood save, task create/complete and elapsed-time-validated session finalization all succeed. The actual EconomyService administrative balance read returns xp=0, coinConfirmed=0 and coinPending=0.

Authenticated balance, quests, ledger, unread reward, invite, streak-rescue and deep-analysis reads return 404 ECONOMY_DISABLED. Streak-rescue and deep-analysis purchases also return 404. The public effective availability endpoint reports economy=false. This proves those tested organic actions do not generate new rewards while disabled; it does not erase historical balances or prohibit legitimate administrative/compensating adjustments.

Evidence: economy-off.e2e-spec.ts, economy-off-http.log. One scenario passed against the separate local mentor_economy_audit_20261031_01_test database.

## Browser observations

Both scenarios ran in Chromium at 375x812 and 1280x800.

1. All economy requests return ECONOMY_DISABLED from initial navigation. The dashboard core task can still be marked complete. The quest card and Coin/XP navigation pills are absent.
2. Open the quest sheet while its endpoint succeeds. Change its response to ECONOMY_DISABLED and dispatch the application's existing economy-changed refresh event. The request returns 404, yet the open sheet still displays +5 XP. This is a reproduced defect, not a successful closed-state acceptance.

The disabled page still emits balance, quests, streak-rescue and unread reward requests. Four diagnostic browser cases passed, including two cases deliberately asserting the observed defect. Screenshots are under browser-results.

## Source findings

- apps/web/src/components/economy-quests-card.tsx: onEconomyChanged swallows refresh errors, retaining currentQuests. An already-open sheet can therefore promise rewards after the backend has disabled them.
- apps/web/src/components/app-nav.tsx: balance pills depend on snapshot.balance and the viewer's role, without directly checking availability.economy.
- apps/web/src/components/economy-sync.tsx and the app shell: the synchronizer mounts without an economy availability gate and attempts unread-reward reads even after the balance loader observes the disabled response.
- apps/web/src/app/[locale]/(app)/dashboard/_components/use-panel-data.ts: quest/rescue reads are attempted unconditionally. A disabled quests response clears dashboard state; other mounted sheets own separate state.
- apps/web/src/lib/economy-store.ts: an ECONOMY_DISABLED balance response correctly clears the shared snapshot. A transient failure intentionally retains the previous balance.
- apps/web/src/lib/app-availability-server.ts: availability is a fresh document snapshot, not a live flag subscription. Existing documents need explicit runtime invalidation/closed-response handling.

## Proposed next slice, pending product discussion

Use effective economy availability to gate mounts, navigation pills, quest surfaces and related loaders. On an ECONOMY_DISABLED response, clear shared economy state and invalidate/close any already-open quest or balance sheet. Preserve ordinary plan/mood/session behavior and historical ledger data. Do not split XP and Coin into separate product switches without a separate decision: the current economy flag covers both earning paths.

Permanent regressions should cover disabled initial load, a flag turned off with sheets open, late in-flight responses, navigation/focus return and no new organic ledger entries. Do not introduce WebSockets or a generic entitlement store to solve this closure issue.

## Earlier investigation, deferred

228 selected unit tests passed; notebook quota browser checks passed on mobile/desktop. The initial 51-test HTTP run had five invite failures with old queue backlog; all 34 invite tests passed when rerun against a fresh isolated database. Two separate diagnostic reproductions established repeated chat completions with one debit when clientMessageId is reused, and a deep-analysis debit before narration refuses AI_DISABLED. These remain follow-up issues; no fixes were applied.
