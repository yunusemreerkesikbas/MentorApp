# 0019 — W5 · Notifications + Queue

> Date: 2026-06-11 · Scope: api / web · Related: roadmap §10, workstreams W5, `docs/standards/api.md`

## What was done
- **Postgres job queue:** `JobQueuePort` adapter on `jobs` table (`FOR UPDATE SKIP LOCKED`), `JobRunnerService` with handler registry + retry/dead-letter.
- **Cron HTTP runner:** `POST /v1/internal/cron/process-jobs` and `POST /v1/internal/cron/dispatch-daily-reminders` guarded by `CRON_SECRET` (Render Cron, no polling).
- **Email pipeline:** `EMAIL_PORT` moved to `NotificationsModule` (Postmark when `POSTMARK_TOKEN` set, logger fallback in dev). Identity auth emails enqueue `notifications.send-email`.
- **Web Push:** `push_subscriptions`, `notification_preferences`, `notification_deliveries` (dedupe) + RLS; `notifications.send-push` handler; web `sw.js` + profil notification settings.
- **Domain triggers:** Payments `@OnEvent` → dunning/welcome email jobs; coaching `CoachingQueryPort` → rule-based daily reminder (no session + no mood today).

## How to use (usage)
```bash
# Local env (see .env.example)
CRON_SECRET=...min-32-chars...
POSTMARK_TOKEN=          # optional dev; required in production
POSTMARK_FROM=noreply@example.com
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # web profil push subscribe

# Process queued jobs (Render Cron equivalent)
curl -X POST http://localhost:3001/v1/internal/cron/process-jobs \
  -H "x-cron-secret: $CRON_SECRET"

# Dispatch daily reminders (e.g. 09:00 Europe/Istanbul cron)
curl -X POST http://localhost:3001/v1/internal/cron/dispatch-daily-reminders \
  -H "x-cron-secret: $CRON_SECRET"

pnpm --filter @mentor/api db:migrate   # applies 0007_w5_notifications.sql
pnpm --filter @mentor/api test
```

**Enqueue from any module:** inject `JOB_QUEUE_PORT` and call `enqueue(JobName.SEND_EMAIL, payload)`.

**W3 extension:** call `JobRunnerService.registerHandler('ai.embed-article', handler)` from your module's `onModuleInit` (or import a registrar in `NotificationsModule`).

## Gotchas
- Cron endpoints are `@Public()` but require `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`.
- `withServiceContext` runs inside job claim/complete — unit tests must mock `db.transaction` with `tx.execute`.
- Postmark is US-hosted — disclose in KVKK/privacy copy when email is enabled.
- Daily reminders dedupe via `notification_deliveries` key `daily-reminder:{userId}:{YYYY-MM-DD}`.
- AI contextual notifications are **out of scope** (W3); copy is fixed Turkish templates only.

## Related files & decisions
- `apps/api/src/modules/notifications/**`
- `apps/api/src/shared/notifications/constants.ts` — shared `JobName`, `EmailTemplate`, `JobStatus`
- `apps/api/drizzle/0007_w5_notifications.sql`
- `apps/api/src/modules/coaching/infrastructure/coaching-query.adapter.ts` — `CoachingQueryPort` impl
- `apps/web/public/sw.js`, `apps/web/src/app/(app)/profil/_components/notification-settings.tsx`
- Decision: Postgres queue + HTTP cron (not Redis polling) to keep Neon scale-to-zero viable.

## Review fixes (2026-06-12)
- Postmark HTML escape + http(s) URL validation (`email-html.util.ts`).
- Payments listener uses `UsersService.getNotificationContact` + delivery dedupe (no identity repo access).
- `CoachingQueryPort` moved to `coaching/domain`; shared `todayIso` from coaching.
- Drizzle `0007_snapshot.json` restored; `0008` prevId chain fixed.
- Unit tests: daily reminder matrix, payments listener; FE uses `@mentor/api-client` with toggle rollback.

## Review fixes (2026-06-13)
- `JobRunnerService`: missing-handler jobs now go straight to DEAD via `JobRepository.markDead`
  (previously `markFailed` rescheduled them, so the row was retried 5× while the result counted
  it as `dead` — count now matches row state).
- `CronSecretGuard`: secret comparison is constant-time (`crypto.timingSafeEqual`).
- `NotificationPreferencesRepository.getOrCreate`: insert uses `onConflictDoNothing` + re-select to
  survive a concurrent same-user create (two tabs) instead of throwing a PK violation.
