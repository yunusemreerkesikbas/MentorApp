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

- **2026-11-09 — Phase 2.5..2.6 Mobile Notification Center, Deep-Link Router & Session Return Reminder (`apps/mobile` & `@mentor/core`):** Added `resolveNotificationMobileRoute(linkUrl)` in `@mentor/core` (`packages/core/src/notifications.ts`) to translate server/web notification links (`/tr/panel`, `/koc/sohbet`, `/topluluk/oda/...`, `/plan`, `/analiz`, `/kocum`, `/bilgi/...`) into mobile Expo Router paths while blocking external URLs. Shipped `apps/mobile/src/lib/notifications-api.ts`, `apps/mobile/src/app/(app)/notifications.tsx` (`FlatList` inbox with category filters, mark-read/mark-all-read/delete, and channel toggles), and 1-tap ~24h session return reminder (`scheduleSessionReturnReminder` in `session-done-card.tsx`).

- **2026-11-01..05 — Branded `Resend` HTML Email Templates & Waitlist Invitation Mail (`APP-134`, `APP-138`):** Built `email-render.ts` responsive table templates with Puhu PNG headers, fixed multi-argument i18n interpolation on coach subjects, and added `identity.signup-invitation` waitlist emails + 6-month waitlist retention cleanup in `dispatch-daily-reminders`.
- **2026-10-28..30 — `Resend` Migration, Interrupted-Job Quarantine & Closed-Social Suppression:** Replaced Postmark with `Resend` (`puhukoc.com` SPF/DKIM/DMARC + Cloudflare Email Routing for `destek@puhukoc.com`), added heartbeat/DEAD-quarantine fencing in `JobRunnerService`, and suppressed social/room notifications when social flags are off.
- **2026-10-13..25 — Invite Notifications & Pilot Daily-Reminder Email Switch:** Added `InviteEventsListener` (`register: puhu`) and `notifications.daily_reminder.email_enabled` pilot cost switch.
- **2026-07-16..09-14 — W5 Foundation, SSE Inbox, Web Push & Coach Digest (`0018–0020`, `APP-054`, `APP-094`):** Shipped `JobQueuePort`, `ConfigRegistryModule`, SSE notification drawer, VAPID web push with SSRF DNS guards, and coach risk digest cron.
