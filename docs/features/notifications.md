# Notifications

> Postgres job queue + email pipeline + web push + daily reminders. Module: `modules/notifications`.
> Workstream: W5. Also home of the **Config Registry + feature flags**.

## Overview

Notifications is the async backbone. It owns the `JobQueuePort` adapter (Postgres `jobs` table,
`FOR UPDATE SKIP LOCKED`), an auto-polling `JobRunnerService` (handler registry + retry/dead-letter),
the email pipeline (`EMAIL_PORT` — Postmark when `POSTMARK_TOKEN` set, logger fallback in dev), and
web push (`push_subscriptions`, `notification_preferences`, `notification_deliveries` dedupe). It also
hosts the **Config Registry** — the runtime, admin-editable business-config mechanism distinct from
`@nestjs/config` (env/secrets). Domain triggers: payments events → dunning/welcome emails; coaching
daily reminder (no session + no mood today).

## Architecture (key decisions)

- **Postgres queue + lightweight polling (not Redis)** — `JobQueuePort` behind an interface; MVP =
  Postgres+jobs table with `FOR UPDATE SKIP LOCKED`, Phase 2 = BullMQ+Redis if throughput requires it.
- **Auto runner + cron HTTP runner:** API instances poll `jobs` automatically every
  `notifications.jobs.poll_interval_seconds` seconds (default 10), so auth/payment emails are delivered
  without a separate manual trigger. `POST /v1/internal/cron/process-jobs` remains available for Render
  Cron/manual catch-up. `POST /v1/internal/cron/dispatch-daily-reminders`
  is guarded by `CRON_SECRET`. `@Public()` but requires `x-cron-secret` or
  `Authorization: Bearer <CRON_SECRET>`; secret comparison is constant-time (`crypto.timingSafeEqual`).
- **Email:** `EMAIL_PORT` moved to NotificationsModule (was identity). Identity auth emails enqueue
  `notifications.send-email`. Postmark HTML escape + http(s) URL validation (`email-html.util.ts`).
- **Web Push:** VAPID keypair; `sw.js` + profil notification settings. Daily reminders dedupe via
  `notification_deliveries` key `daily-reminder:{userId}:{YYYY-MM-DD}`.
- **Domain triggers:** Payments `@OnEvent` → dunning/welcome email jobs (uses `UsersService.
  getNotificationContact` + delivery dedupe — no identity repo access); coaching `CoachingQueryPort`
  (in `coaching/domain`) → rule-based daily reminder (no session + no mood today). Shared `todayIso`
  from coaching.
- **Config Registry** (`common/config`, `@Global() ConfigRegistryModule`) — code-defined catalog
  (`CONFIG_CATALOG` key → { category, type, Zod schema, default, sensitive, description }); DB stores
  **overrides only** (`config_overrides`, key PK, value jsonb). Admins can't invent keys; values
  validated against the key's schema (bounds in the schema). In-memory cache (lazy load,
  invalidate-on-write; process-scoped — fine for MVP single Render instance).
- **Feature flags ARE config-registry entries** (one mechanism, not two): `ai.enabled` (true, §4/§8 AI
  kill-switch), `economy.enabled` (false), `signup.enabled` (true). `FeatureFlag` key consts exported.
- **Secrets never in the registry** — values are plaintext in DB + audit trail; secrets stay in env only.

## Tutorials / Guides

```bash
# Local env (see .env.example)
CRON_SECRET=...min-32-chars...
POSTMARK_TOKEN=          # optional dev; required in production
POSTMARK_FROM=noreply@example.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # web profil push subscribe

# Process queued jobs manually (normally auto-polled by API instances):
curl -X POST http://localhost:3001/v1/internal/cron/process-jobs \
  -H "x-cron-secret: $CRON_SECRET"

# Dispatch daily reminders (e.g. 09:00 Europe/Istanbul cron):
curl -X POST http://localhost:3001/v1/internal/cron/dispatch-daily-reminders \
  -H "x-cron-secret: $CRON_SECRET"

pnpm --filter @mentor/api db:migrate   # applies 0007_w5_notifications.sql
pnpm --filter @mentor/api test
```

**Enqueue from any module:** inject `JOB_QUEUE_PORT` and call `enqueue(JobName.SEND_EMAIL, payload)`.

**Register a job handler** (W3 extension pattern): call `JobRunnerService.registerHandler('ai.embed-article', handler)`
from your module's `onModuleInit` (or import a registrar in `NotificationsModule`).

**Read a feature flag** (ConfigRegistryModule is `@Global`):
```ts
constructor(private readonly config: ConfigRegistryService) {}
if (await this.config.get(FeatureFlag.AI_ENABLED)) { /* … */ }
```

## API

| Endpoint | Purpose |
|---|---|
| `POST /v1/internal/cron/process-jobs` | Run queued jobs (CRON_SECRET-gated) |
| `POST /v1/internal/cron/dispatch-daily-reminders` | Dispatch daily reminder jobs (CRON_SECRET-gated) |
| `GET /v1/notifications` | List in-app notifications (JWT; query: `category`, `page`) |
| `PATCH /v1/notifications/read-all` | Mark all unread as read (JWT; 204) |
| `PATCH /v1/notifications/:id/read` | Mark one notification as read (JWT) |
| `PATCH /v1/notifications/:id/unread` | Mark one notification as unread (JWT) |
| `DELETE /v1/notifications/:id` | Delete one notification (JWT; 204) |
| `POST /v1/notifications/stream-token` | Issue a 60s one-time SSE token (JWT) |
| `GET /v1/notifications/stream?token=` | SSE stream — push `new_notification` events (token-auth, public route) |
| `GET /v1/admin/config` | List config catalog + effective values (SUPER_ADMIN) |
| `PATCH /v1/admin/config/:key` | Update a config/flag value (SUPER_ADMIN, audited) |

## Geliştirmeler (timeline)

- **Notifications + queue** — Postgres job queue (`JobQueuePort`, `FOR UPDATE SKIP LOCKED`);
  `JobRunnerService` (handler registry + retry/dead-letter); cron HTTP runner (`CRON_SECRET`-gated);
  email pipeline (`EMAIL_PORT` moved to NotificationsModule; Postmark/logger); web push
  (`push_subscriptions`/`notification_preferences`/`notification_deliveries` + RLS); domain triggers
  (payments dunning/welcome; coaching daily reminder). Migration `0007`. *(0019.)*
  - **Review fixes:** Postmark HTML escape + URL validation; payments listener uses
    `getNotificationContact` + delivery dedupe; `CoachingQueryPort` moved to `coaching/domain`;
    `0007_snapshot.json` restored + `0008` prevId chain fixed.
  - **Review fixes (2nd round):** missing-handler jobs go straight to DEAD (were retried 5× while
    counted as dead); `CronSecretGuard` constant-time compare; `NotificationPreferencesRepository.
    getOrCreate` uses `onConflictDoNothing` + re-select (survives concurrent same-user create).
  - **Auto runner:** `JobRunnerService` now polls pending jobs automatically using
    `notifications.jobs.poll_interval_seconds` (default 10), while preserving the cron endpoint for
    manual catch-up / Render Cron. This makes verification, password reset, payment, and reminder email
    jobs self-processing after enqueue. *(2026-07-05.)*
- **In-app notification inbox** — `user_notifications` table (RLS user-scoped, idx on
  `(user_id, created_at DESC)`); `UserNotificationRepository` (list/create/markRead/markUnread/markAllRead/delete);
  `NotificationsService.createInApp()` (writes via `withServiceContext`, category COACH/PLAN/CONTENT);
  5 REST endpoints (list, markRead, markUnread, markAllRead, delete); daily-reminder dispatch also writes
  an in-app notification. UI: `NotificationBell` + `NotificationDrawerProvider` in `@mentor/ui`
  (portal-based, mobile drawer / desktop popover); `NotificationDrawerShell` in `(app)/layout.tsx`
  (all app pages). Bell is in the sidebar header (next to "Mentor" logo on desktop) and in the mobile
  top bar. Item-level actions: swipe right >100px → mark read/unread auto-trigger; swipe left >110px
  → delete auto-trigger; smaller swipe snaps open action zone for tap. Desktop: hover reveals
  inline icon buttons. Migration `0025`. *(APP-014/015.)*
- **Real-time bell + streak trigger** — SSE stream (`GET /v1/notifications/stream`) with one-time
  token auth (`POST /v1/notifications/stream-token` → 60s UUID, consumed on connect); `NotificationsService`
  holds in-memory `streams` Map (Set of RxJS Subjects per userId); `createInApp()` pushes `{event:"new_notification"}`
  after DB write; frontend reconnects with 5s backoff + re-fetches list on tab focus. Streak broken
  trigger: `StreakService.getSummary()` emits `coaching.streak-broken` via EventEmitter2 when
  `currentStreak` drops to 0; `CoachingEventsListener` in NotificationsModule calls `createInApp(COACH)`. *(APP-015.)*
- **Notification tap navigation** — `user_notifications.link_url` (nullable text, migration `0026`);
  `createInApp()` accepts optional `linkUrl`; callers set it: `DailyReminderService → "/seans"`,
  `CoachingEventsListener → "/panel"`. Frontend: `NotificationDrawerItem` tap calls `onClickItem(notification)`
  (context marks read + closes drawer + calls `onNotificationClick`); web shell does
  `router.push(notification.linkUrl ?? CATEGORY_FALLBACK[category])` with fallbacks
  `COACH→/panel`, `PLAN→/plan`, `CONTENT→/bilgi`. Migration `0026`. *(APP-015.)*
- **Contextual motivational notifications** — 4 event-driven in-app notifications triggered by user
  actions (no cron, no AI, no premium gate, template content only). Domain events in
  `coaching/domain/coaching.events.ts`: `StreakMilestone` (emitted by `StreakService.getSummary()`
  when `currentStreak` crosses a milestone threshold in `[7, 14, 30, 100, 365]` without having crossed
  it before), `MoodLow` (emitted by `MoodService.upsertToday()` when mood ≤ 2), `FirstSessionOfDay`
  (emitted by `SessionService.finalize()` when the completed session is the user's first of the day —
  reads `daily_activity` pre-state before upsert), `DailyPlanCompleted` (emitted by
  `PlanService.update()` when status → DONE and `countDone === countTotal > 0` for today).
  All events emitted AFTER `withUserContext` returns (flag variable pattern) to ensure tx is committed.
  `CoachingEventsListener` handles all 4: each handler deduplicates via `notification_deliveries.tryRecord()`
  with `dedupeKey = "{template}:{YYYY-MM-DD}"` (max 1 per trigger per day); on dedup miss writes
  in-app notification via `createInApp()`. `linkUrl`s: streak/mood → `/panel`, `/koc`;
  first-session → `/seans`; plan → `/plan`. No new files, no migration, no module wiring changes. *(APP-015.)*
- **Forum @mention notifications** — `ForumEventsListener.onUserMentioned` handles a new
  `forum.user.mentioned` event (recipient + link on payload) → "Sizden bahsedildi" FORUM notification.
  Emitted by forum's `ForumMentionService` at post-create (parses `@handle`s, resolves via
  `UsersService.findIdsByUsernames`, best-effort). Excludes the actor + already-notified reply recipients.
  No new table/migration. Detail: [`forum.md`](./forum.md) timeline. *(APP-018.)*
- **Forum in-app notifications** — new `FORUM` notification category (`user_notifications.category` is
  text → no migration; added to `NotificationCategory` type + `notificationCategorySchema`).
  `ForumEventsListener` (`application/listeners/forum-events.listener.ts`) consumes 5 forum domain events
  → `createInApp(recipientId, "FORUM", title, body, linkUrl)`, best-effort, self-acts skipped
  (`actor === recipient`). Recipients are resolved in the forum domain and carried on the event payload,
  so this listener imports only the forum **event contracts** (no forum repo/module dependency — like
  `CoachingEventsListener`). No per-day dedup (each reply/answer notifies). Generic Turkish copy (no actor
  name → no extra query). Web: `notification-drawer-shell` icon/color/fallback maps gain `FORUM`
  (MessageCircle, `/topluluk`); no new tab (shows under "Tümü", like `CONTENT`). Trigger/link detail:
  [`forum.md`](./forum.md) timeline. *(APP-018.)*
- **Config registry + feature flags** — central config registry (`common/config`, `@Global`);
  code-defined catalog (Zod-validated, admins can't invent keys); `config_overrides` table
  (overrides only); `ConfigRegistryService` (typed `get<K>`, in-memory cache, invalidate-on-write);
  feature flags = registry entries (`ai.enabled`/`economy.enabled`/`signup.enabled`); admin editing
  (`/config` toggles, SUPER_ADMIN, audited). Migration `0009`. *(0020.)*
  - **Org-readiness decision (§4 #7):** `config_overrides` is global platform config by design (no
    `org_id`); per-org/B2B overrides will use the existing `organizations.settings` jsonb (already
    org-ready) — NOT this table.

## Gotchas / Known issues

- **`@mentor/ui` depends on `@mentor/types`** — added as a `dependencies` entry in `packages/ui/package.json`
  when notification-drawer components imported `UserNotificationDto`. This was intentional: UI types are
  shared; if you add more cross-package type imports to ui, check that the dep is still listed.
- **`NotificationDrawerShell` is in `(app)/layout.tsx`** — available on all app pages. Do not add it again in individual page shells (double-wrap breaks context). `panel-shell.tsx` had this bug; now fixed.
- **SSE token is one-time and 60s TTL** — `EventSource` can't send headers, so frontend POSTs for a stream token first, then appends `?token=` to the SSE URL. Tokens are in-memory (process-scoped, single instance); multi-instance would need Redis/pub-sub.
- **SSE heartbeat** — 25s `interval()` keeps proxy connections alive; Nginx default is 60s idle timeout.
- **Streak broken fires once per reset** — `StreakService` compares persisted `existing.currentStreak` vs newly derived. Event emits only when it drops to 0. Strict Mode double-invoke in dev may fire twice; harmless (two identical notifications).

- **Cron endpoints are `@Public()`** but require `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`.
- **`withServiceContext` runs inside job claim/complete** — unit tests must mock `db.transaction` with
  `tx.execute`.
- **Postmark is US-hosted** — disclose in KVKK/privacy copy when email is enabled.
- **Daily reminders dedupe** via `notification_deliveries` key `daily-reminder:{userId}:{YYYY-MM-DD}`.
- **AI contextual notifications are out of scope** (W3); copy is fixed Turkish templates only.
- **Cache is per-process** → a flag change is instant on the instance that served the PATCH; other
  instances pick it up on next cold read. MVP = 1 instance, so fine; Phase 2 = pub/sub or short TTL.
- **Catalog is the source of truth** — never insert `config_overrides` rows by hand for keys absent
  from the catalog; `get` would ignore them and `set` rejects them (404).
- **Migration ordering:** W5's `0007_w5_notifications.sql` existed without a `0007_snapshot.json`, so
  `drizzle-kit generate` re-emitted the notification tables into 0008. Fixed by hand-trimming 0008 to
  only `admin_audit_log`; the generated `0008_snapshot.json` heals the baseline. Lesson: always commit
  the snapshot with your migration.

## Backlog

- Re-validate overrides on read against the (possibly evolved) catalog schema · cache the in-flight
  load promise · optionally Turkish catalog descriptions · multi-instance cache invalidation (pub/sub).

## Related

- Seam: [identity.md](./identity.md) (auth emails), [payments.md](./payments.md) (dunning/welcome
  events), [coaching.md](./coaching.md) (daily reminder), [ai.md](./ai.md) (embed-article job),
  [admin.md](./admin.md) (config editor)
- Web: `sw.js`, `/profil` notification settings
- Status: [core/mvp-status.md](../core/mvp-status.md) (W5)
