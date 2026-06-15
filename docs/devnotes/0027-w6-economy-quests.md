# 0027 — W6 · Economy Onboarding Quests

> Date: 2026-06-16 · Scope: api (economy + identity/payments reads) + admin UI + schema/migration ·
> Related: roadmap §3/§9, AGENTS §4 #2/#3, workstreams W6, builds on [0021](./0021-w6-light-economy.md)
> / [0022](./0022-w6-light-economy-invite.md). **Closes W6's functional scope.**

## What was done
- **Onboarding quests** that auto-grant **capped, idempotent coin** on completion — same reward engine as
  invite. Conditions are evaluated by READING other modules' **public services** (identity/payments) + the
  economy invite repo; **no cross-module table access** (workstreams §3). 4 quests:
  `onboarding.profile-setup` (examType set) · `email-verified` · `first-subscription` (subscription row
  exists) · `invite-redeemed`.
- **Static catalog** (`economy/domain/quest.catalog.ts`) — single source of truth; reward amount from config
  (`economy.quest.onboarding_reward_coin`, default 10). **Habit/milestone tiers = backlog** (need coaching
  signals; coaching emits no events / isn't exported — same constraint metrics hit).
- **New table** `user_quest_progress` (unique `(userId,questId)`) + migration `0014_quick_dagger.sql` with
  RLS (self-read + SERVICE/ADMIN). Reward is a ledger entry `refType="quest", refId=<progress row id>`.
- **QuestService** (`evaluateAndGrant`, `getUserProgress`, `getAdminProgress`): reads `UsersService.getMe`
  (examType/emailVerified), `SubscriptionsService.getView` (subscription), `InviteRepository.findRedemptionByInvited`;
  grants via `EconomyService.grant(enforceLimits:true)`. `QuestRepository.markCompleted` is `onConflictDoNothing`.
- **Triggers (no cron):** lazy-eval on `GET /economy/quests` (grants newly-completed) + `QuestEventsListener`
  on `payments.subscription.activated` + inline `evaluateAndGrant` in `InviteService.redeem`.
- **APIs:** user `GET /economy/quests` (gated by `economy.enabled`); admin economy overview gains a `quests`
  field. **Admin UI:** quest checklist in the user-detail economy card. **No B2C web UI** (not scheduled).
- Module wiring: `EconomyModule` imports `IdentityModule`; adds `QuestService`/`QuestRepository`/`QuestEventsListener`,
  exports `QuestService`. No dependency cycle (QuestService→InviteRepository, InviteService→QuestService).

## How to use (usage)
```bash
# Enable economy (admin): PATCH /v1/admin/config/economy.enabled { "value": true }
# User: GET /v1/economy/quests → catalog + progress; completed conditions auto-grant coin (capped).
# Admin: GET /v1/admin/users/:id/economy → includes quests[] (read-only).
```

## Gotchas
- **economy.enabled gate:** `evaluateAndGrant` self-guards; the user GET 404s when off. Default OFF → the
  whole quest flow is dormant in prod until the flag flips + B2C UI ships.
- **Double-belt idempotency:** `user_quest_progress` unique `(userId,questId)` + ledger unique `(refType,refId)`
  with `refId` = progress row id (invite redemption.id pattern). A quest grants at most once.
- **Cap = abuse shield:** quest reward `enforceLimits:true`; over-cap → grant skipped (logged, not fatal),
  completion still recorded. Deferred reward = Phase-2 reconcile/outbox (backlog).
- **No cron:** triggers are lazy-eval (GET) + the subscription event + the redeem hook. Without the B2C UI,
  profile/email quests only settle on a GET — acceptable since economy is gated off anyway (YAGNI).
- **Cross-module = reads only:** `getMe`/`getView` are public services; self-context reads work in every
  trigger path (user's own request, the activation listener, the redeem hook — all resolve to the target user).
- **Migration:** generated via `db:generate` (snapshot auto), RLS block hand-appended; applied to dev+test.
- **RLS:** all quest writes/reads run in SERVICE context. Local `mentor` superuser bypasses RLS → verify on Neon.

## Related files & decisions
- `apps/api/src/database/schema.ts` (`user_quest_progress`) · `drizzle/0014_quick_dagger.sql`
- `apps/api/src/common/config/config.catalog.ts` (`economy.quest.onboarding_reward_coin`)
- `apps/api/src/modules/economy/{domain/quest.catalog.ts, infrastructure/quest.repository.ts,
  application/quest.service.ts, application/quest-events.listener.ts, application/invite.service.ts,
  presentation/economy.controller.ts, economy.module.ts}`
- `apps/api/src/modules/admin/presentation/admin-economy.controller.ts`
- `apps/admin/src/app/(general)/users/[id]/page.tsx` · `lib/types.ts` (`AdminQuestProgress`)
- **Verified:** e2e 3 (GET evaluates+grants profile+first-subscription → 20 coin; idempotent 2nd call;
  404 when economy disabled); api lint+typecheck, admin typecheck+build green.
- Decisions (owner): onboarding-only (no coaching); static catalog + config reward; auto-grant via
  lazy-eval + cheap hooks (no cron); user GET + admin read, no B2C UI.

## Backlog
- Habit/milestone quests (sessions/streak/mock-exam) — need coaching events/port.
- B2C web economy/quest UI (apps/web). · Cron sweep (if quests must settle without a GET). · Per-quest reward config.
