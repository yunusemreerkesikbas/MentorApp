# Notifications & Config Registry (`modules/notifications` · W5b)

> Async Postgres job queue (`JobQueuePort`), transactional email pipeline (`Resend`), Web Push,
> real-time SSE in-app notification bell, team broadcasts, and the global runtime **Config Registry**.

---

## 1. Overview & Architecture

`NotificationsModule` is the asynchronous delivery and runtime configuration backbone:

- **Postgres Job Queue (`JobQueuePort`):**
  - Uses the `jobs` table with `FOR UPDATE SKIP LOCKED`, auto-polled every `notifications.jobs.poll_interval_seconds` (default `10s`) by active API instances and backed by `POST /v1/internal/cron/process-jobs`.
  - **Heartbeats & Quarantine (`2026-10-29`):** Active workers refresh job heartbeats; abandoned `RUNNING` jobs older than `running_timeout_seconds` (`900s`) are quarantined to `DEAD` for operator inspection rather than replaying non-idempotent side effects.
- **Email Pipeline (`Resend` behind `EMAIL_PORT`):**
  - `RoutingEmailAdapter` routes transactional emails to **Resend** (`ResendEmailAdapter`, 10s bounded timeout, scrubbed error logs) or `LoggerEmailAdapter` in local dev tooling.
  - **Unified Branded HTML Renderer (`email-render.ts`, `2026-11-01`):** Renders 7 responsive 600px table-based templates on `#F3F8FD` wash with hosted PNG art (`apps/web/public/img/email/`) and localized `tr`/`en` copy (`verify-email`, `reset-password`, `signup-invitation`, `welcome`, `payment-dunning`, `daily-reminder`, `coach-risk-digest`).
- **In-App Inbox & Real-Time SSE (`/v1/notifications/*`):**
  - Stores categorized notifications (`SYSTEM`, `COACHING`, `FORUM`, `ACHIEVEMENT`) with `linkUrl` deep links.
  - Issues 60s single-use stream tokens (`POST /v1/notifications/stream-token`) for real-time bell updates (`GET /v1/notifications/stream`).
- **Hardened Web Push:** VAPID push subscriptions allowlist known browser push providers over HTTPS/443 with pre-registration and pre-send DNS/private-IP validation.
- **Global Config Registry (`common/config`, `@Global()`):**
  - Code-defined `CONFIG_CATALOG` (Zod schema, default, sensitivity, Turkish operator hints in `config-hints.ts`) + `config_overrides` table. Secrets never live in the registry.

---

## 2. API Surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/notifications`, `PATCH .../{read-all,:id/read,:id/unread}`, `DELETE .../:id` | In-app notification inbox CRUD |
| `POST /v1/notifications/stream-token`, `GET /v1/notifications/stream?token=` | Real-time SSE notification stream |
| `GET\|PATCH /v1/notifications/preferences` | User email / push / reminder switches |
| `POST\|DELETE /v1/notifications/push-subscriptions` | Register or remove browser Web Push endpoint |
| `POST /v1/notifications/session-return-reminder` | Opt-in ~24h study return reminder |
| `POST /v1/internal/cron/{process-jobs,dispatch-daily-reminders,dispatch-notebook-reviews,dispatch-mentorship-risk-digest}` | `CRON_SECRET`-gated background dispatchers |
| `GET\|POST /v1/admin/announcements`, `POST .../:id/send`, `DELETE .../:id` | `SUPER_ADMIN` broadcast announcements (audited) |
| `GET /v1/admin/config`, `PATCH /v1/admin/config/:key` | `SUPER_ADMIN` runtime config & feature flag editor (audited) |

---

## 3. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-27 — Local dates in plan notifications.** Plan changes and reminders display a localized calendar date, such as “10 Eylül 2026”, and retain the scheduled local time. The inbox also refreshes existing entries that have stored template arguments. See `notifications-copy.service.ts`.

- **2026-11-21 — Native Expo Push backend pipeline & mobile integration (`0143`, `apps/api`, `apps/mobile`, `@mentor/*`):**
  - **What was done:** Added `MobilePushPlatform` / token DTOs in `@mentor/types` and strict `ExponentPushToken[...]` / `ExpoPushToken[...]` Zod validation in `@mentor/validation`. Added `mobile_push_tokens` table (`schema-mobile-push.ts`, migration `0143_mobile_push_tokens.sql` with `ENABLE` + `FORCE ROW LEVEL SECURITY`), optional `EXPO_ACCESS_TOKEN` env validation, `MOBILE_PUSH_PORT` + `ExpoPushAdapter` (pinned `https://exp.host/--/api/v2/push/send`, bounded timeout, `DeviceNotRegistered` -> `InvalidMobilePushTokenError`), `MobilePushTokenRepository` (advisory lock + `notifications.push.max_subscriptions`), `POST/DELETE /v1/notifications/mobile-push-tokens`, `NotificationsErasureService` KVKK hard deletion, and `SendPushHandler` Web Push + Expo Push fanout sharing `pushDeliveryClaims` (`sha256("expo:" + token)`). Installed `expo-notifications@~58.1.9` in `apps/mobile` (`app.config.ts` plugin + `EXPO_PUBLIC_EAS_PROJECT_ID` wiring), added `PushNotificationsProvider` for cold-start/warm tap deep-linking (`STUDENT_CORE_ONLY` guarded) and silent token sync, unregistered cached tokens on logout, and connected the Notification Center `"Push bildirimleri"` toggle to OS permissions + graceful Expo Go fallback (`pref_push_dev_build_required`).
  - **Verification & limits:** API unit tests (`16/16` across `expo-push.adapter.spec.ts`, `send-push.handler.spec.ts`, `notifications.service.spec.ts`), `nest build`, and live `/v1/notifications/mobile-push-tokens` POST (`201`), invalid token (`400`), and DELETE (`200`) checks passed locally. Mobile `push-routing.spec.ts` + Notification Center Android 13+ OS permission dialog (`Allow`) and crash-free Expo Go Android toggle passed on `Puhu_Pixel`. Remote FCM v1 / APNs push delivery on an installed dev/production build on a physical device remains unverified here (requires EAS project ID + Firebase `google-services.json` + Apple APNs credentials).
  - **Related files:** `packages/{types,validation}/src/notifications.ts`, `apps/api/drizzle/0143_mobile_push_tokens.sql`, `apps/api/src/database/{schema-mobile-push,schema-all}.ts`, `apps/api/src/shared/{ports/mobile-push.port,adapters/push/expo-push.adapter*}.ts`, `apps/api/src/modules/notifications/*`, `apps/mobile/{app.config,src/lib/push-*,src/providers/push-notifications-provider,src/providers/auth-provider,src/components/notifications/notification-channels-card}.ts*`.

- **2026-11-21 — Mobile Notification Center web parity & channel controls:**
  - **What was done:** Matched the web notification drawer hierarchy on mobile with `All` / `Unread` underline `SlidingTabs`, recency buckets (`Bugün` / `Bu hafta` / `Daha eski`), unread sky-tinted rows with blue indicator dot vs read rows, relative `< 7d` and Istanbul calendar `>= 7d` timestamps, bare Solar category icons, 44×44 row `ActionSheet` (`mark read` / `mark unread` / `delete`), `useInfiniteQuery` pagination, Puhu empty state, and inline `BİLDİRİM AYARLARI` Switch card with optimistic rollback.
  - **Usage & gotchas:** Reachable from the header bell icon and Settings -> `Bildirim Merkezi & Tercihler`. Under `STUDENT_CORE_ONLY`, `resolveMobileNotificationDestination` strips hidden community/human-coach paths while deep-linking `/bilgi/<slug>` directly into Exam Guide. Verified on Android (`Puhu_Pixel`) at 411 dp TR/light and 360 dp EN/dark (toggle switches, ActionSheet actions, empty unread state, deep links, and Android Back).
  - **Related files:** `apps/mobile/src/app/(app)/notifications.tsx`, `apps/mobile/src/components/notifications/*`, `apps/mobile/src/components/ui/sliding-tabs.tsx`, `apps/mobile/src/lib/{notifications-api,notifications-view,notifications-view.spec}.ts`.
- **2026-11-16 — Mobile student inbox filters and dates:** Open Notification Center to see inbox dates in the app language using the Istanbul calendar day. The first store release omits the Community and Human Coach filter chips. All still includes existing notifications from both categories, with the existing safe routing and channel controls. See `apps/mobile/src/app/(app)/notifications.tsx` and `apps/mobile/src/lib/display-date.spec.ts` for the midnight boundary check.
- **2026-11-16 — Mobile session reminder feedback:** Choose “Yarın bu saatte bana hatırlat” after finishing a session. The action displays its pending state and shows an inline retry message on failure. Already scheduled reminders still show confirmation. See `apps/mobile/src/components/session/session-done-card.tsx`.

- **2026-11-09 — Phase 2.5..2.6 Mobile Notification Center, Deep-Link Router & Session Return Reminder (`apps/mobile` & `@mentor/core`):** Added `resolveNotificationMobileRoute(linkUrl)` in `@mentor/core` (`packages/core/src/notifications.ts`) to translate server/web notification links (`/tr/panel`, `/koc/sohbet`, `/topluluk/oda/...`, `/plan`, `/analiz`, `/kocum`, `/bilgi/...`) into mobile Expo Router paths while blocking external URLs. Shipped `apps/mobile/src/lib/notifications-api.ts`, `apps/mobile/src/app/(app)/notifications.tsx` (`FlatList` inbox with category filters, mark-read/mark-all-read/delete, and channel toggles), and 1-tap ~24h session return reminder (`scheduleSessionReturnReminder` in `session-done-card.tsx`).

- **2026-11-01..05 — Branded `Resend` HTML Email Templates & Waitlist Invitation Mail (`APP-134`, `APP-138`):** Built `email-render.ts` responsive table templates with Puhu PNG headers, fixed multi-argument i18n interpolation on coach subjects, and added `identity.signup-invitation` waitlist emails + 6-month waitlist retention cleanup in `dispatch-daily-reminders`.
- **2026-10-28..30 — `Resend` Migration, Interrupted-Job Quarantine & Closed-Social Suppression:** Replaced Postmark with `Resend` (`puhukoc.com` SPF/DKIM/DMARC + Cloudflare Email Routing for `destek@puhukoc.com`), added heartbeat/DEAD-quarantine fencing in `JobRunnerService`, and suppressed social/room notifications when social flags are off.
- **2026-10-13..25 — Invite Notifications & Pilot Daily-Reminder Email Switch:** Added `InviteEventsListener` (`register: puhu`) and `notifications.daily_reminder.email_enabled` pilot cost switch.
- **2026-07-16..09-14 — W5 Foundation, SSE Inbox, Web Push & Coach Digest (`0018–0020`, `APP-054`, `APP-094`):** Shipped `JobQueuePort`, `ConfigRegistryModule`, SSE notification drawer, VAPID web push with SSRF DNS guards, and coach risk digest cron.
