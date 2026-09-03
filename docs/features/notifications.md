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
| `POST /v1/notifications/session-return-reminder` | Opt-in soft return (~24h in-app + push; body optional `subject`) |
| `GET /v1/admin/announcements?page=` | List team-authored broadcasts (SUPER_ADMIN) |
| `POST /v1/admin/announcements` | Create a DRAFT broadcast (SUPER_ADMIN, audited) |
| `POST /v1/admin/announcements/:id/send` | Queue the fan-out; `{ scheduledAt? }` (SUPER_ADMIN, audited) |
| `DELETE /v1/admin/announcements/:id` | Delete a DRAFT (SUPER_ADMIN, audited; 204) |
| `GET /v1/admin/config` | List config catalog + effective values (SUPER_ADMIN) |
| `PATCH /v1/admin/config/:key` | Update a config/flag value (SUPER_ADMIN, audited) |

## Geliştirmeler (timeline)

- **Koç risk özeti — `MentorshipRiskDigestService` (APP-067, 2026-09-03)** — Yeni bir cron
  tetikleyicisi (`dispatch-mentorship-risk-digest`, 07:00 UTC) ve W5'in ikinci cross-module okuma
  seam'i: `MENTORSHIP_QUERY_PORT`, `COACHING_QUERY_PORT`'un birebir kardeşi. Sahip modül **kimin**
  haberi olduğunu hesaplıyor, notifications yalnız **nasıl** söyleneceğine karar veriyor —
  `coach_students` bu modülden hiç okunmuyor ve bir risk flag'inin ne demek olduğu W5'e girmiyor.
  **Kullanım:** `MentorshipRiskDigestService.dispatchDaily(now)`; `mentorship.risk_digest.enabled`
  kapalıysa port'a hiç sorulmadan `{sent:0, skipped:0}` döner.
  **Gotchas:** (1) `DailyReminderService`'in deseni **kopyalanmadı**: orada `notification_deliveries`
  ve in-app iki ayrı yol ve in-app tarafı aslında dedupe'suz (cron iki kez koşarsa iki kutu satırı).
  Burada tek kapı var — `createFromTemplate`'in `dedupeKey`'i; `false` dönerse e-posta enqueue
  edilmiyor. (2) `findLatestByTemplateKey` `data->>'templateKey'` üzerinden okuyor; bu alanı
  `createFromTemplate` yazıyor, yani doğrudan `createInApp` çağıran bir gönderici baseline
  bırakmaz. (3) NotificationsModule artık MentorshipModule import ediyor; döngü yok çünkü
  mentorship identity + coaching'e bağlı ve bu modül zaten `@Global`.
  **İlgili:** `application/mentorship-risk-digest.service.ts`,
  `infrastructure/user-notification.repository.ts`, `presentation/cron.controller.ts`,
  `../../render.yaml`, [`mentorship.md`](./mentorship.md).

- **Geri kazanım bildirimi + kampanya kapatma anahtarı (2026-09-01)** — İlk ticari bildirim:
  `SUBSCRIPTION_EXPIRED` olayını dinleyen `PromotionEventsListener`, o kullanıcı için gerçekten bir
  indirim varsa (`SubscriptionsService.findWinBackOffer` — tek çağrı, tarama yok) in-app + push
  gönderiyor. Uygulamayı artık açmayan kullanıcıya ulaşan tek promosyon yüzeyi.
  `notification_preferences.campaigns_enabled` eklendi (migration `0091_campaign_preference`):
  ticari mesajın **her kanalını**, in-app kutusu dahil, kapatıyor.
  Kullanım: profil → Bildirim ayarları → "Kampanya bildirimleri".
  Gotcha: "in-app her zaman yazılır" kuralı işlemsel hatırlatmalar için geçerli, ticari mesaj için
  değil — yeni bir kampanya bildirimi eklerken `campaignsEnabled` kontrolünü atlama. Bir diğeri:
  **e-posta bilinçli olarak yok** — indirim e-postası 6563 kapsamında ticari elektronik ileti,
  İYS kaydı + açık onay + ret hakkı gerekiyor ve hiçbiri kodda yok (bkz. promotions.md).
  Not: `NotificationsModule` artık `PaymentsModule`'ü import ediyor; ters yön yok, döngü yok.
  İlgili: `promotion-events.listener.ts`, `notification-copy.ts`, `notification-settings.tsx`.

- **Kampanya duyurusu = mevcut announcement akışı (2026-08-31)** — Promosyon modülü için ayrı bir
  bildirim fan-out'u **yazılmadı**. Gerekçe üç katmanlı: (1) promosyon uygunluğu canlı hesaplanıyor,
  grant tablosu yok → "kimler uygun?" her kural tipi için ayrı ters sorgu ister; (2)
  `AdminPromotionsController` FINANCE, `AdminAnnouncementsController` SUPER_ADMIN — promosyon
  formuna "duyur" kutusu rol sınırını delerdi; (3) "kampanya bitiyor" hatırlatması
  [`voice.md`](../copy/voice.md)'nin FOMO yasağına takılıyor. Kampanya duyurusu gerektiğinde
  SUPER_ADMIN `/announcements`'tan yazar, `linkUrl: "/abonelik"` verir; `SYSTEM` bildirimi zil +
  SSE + çekmece üzerinden sıfır ek kodla çalışır. Kullanıcı tarafında keşif yükünü panel
  promosyon şeridi taşıyor. Gotcha: **indirim e-postası İYS kapsamındadır** — bu modülde
  pazarlama/işlem ayrımı, onay kolonu ve unsubscribe yok; eklenmeden promosyon e-postası atılmamalı.
  İlgili: [promotions.md](./promotions.md), `announcement.service.ts`.

- **Yoldaşlık sesi Dalga 15 — uzun çizgi (2026-08-29)** — Bildirim ve e-posta konularında em dash kalktı (`Mentor: …`). `{name} kabul etti. Artık yol arkadaşın.` (siz yok). Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: `SERIOUS_DISTRESS` dokunulmadı. İlgili: `notifications.json`, `notifications-copy.service.spec.ts`.

- **Bildirim ve ritüel sesi Dalga 1 (APP-054, 2026-08-28)** — Öğrenciye giden bildirim, e-posta,
  push ve kutlama/toast metinleri tek bir ses kılavuzuna bağlandı: [`docs/copy/voice.md`](../copy/voice.md)
  (Puhu kutlama/davette, isimsiz yoldaş ciddi anda; her zaman **sen**). Hardcoded TR cümleler
  `apps/api/src/i18n/locales/{tr,en}/notifications.json` kataloğuna taşındı.
  `NotificationsCopyService` + `NotificationsService.createFromTemplate` yazma anında title/body
  doldurur ve `data.templateKey` + `data.args` saklar; `toDto` şablon varsa okuma anında yeniden
  çevirir (dil değişimi / ses güncellemesi). Eski inbox satırları (templateKey yok) olduğu gibi kalır.
  E-posta cümleleri aynı katalogdan (`notifications.email.*`); HTML iskeleti Postmark adapter'da.
  Web: drawer boş hali, panel toast/streak, seans “yarın hatırlat”, başarı kutlama chrome.
  Admin duyuru formu yoldaş-kaydı ipucu + 3 örnek şablon verir; serbest metin kalır.
  Kullanım: yeni şablon = katalog + `NotificationCopyKey` + `createFromTemplate`; listener'a cümle
  yazma. Gotcha: distress/`coaching.mood.SERIOUS_DISTRESS` dokunulmaz; resmi duyuru şaka yapmaz;
  cron/push locale yoksa `tr`. İlgili: `notifications-copy.service.ts`, `notification-copy.ts`,
  `postmark-email.adapter.ts`, `docs/copy/voice.md`.

- **Bildirim drawer redesign (APP-053, 2026-08-28)** — Satır anatomisi yeniden kuruldu. **Kategori
  ikonu artık çıplak** (18px, kategori renginde): 40px daire + border + `color-mix` dolgu kaldırıldı
  — her satırın en ağır işareti en az bilgi taşıyan konteynerdi ve aynı kategoriden ardışık
  satırlarda göz başlıkları değil daire kolonunu takip ediyordu. **Okunmadı sinyali üçten ikiye
  indi**: kalın başlık + sağda nokta (sol nokta ile satır bg tint'i kalktı; bg zaten panelle aynı
  `--color-surface` olduğu için ölü koddu). Satır dolgusu opak kalır — swipe aksiyonlarını örten
  şey odur, okunmadı ipucu değil. **Başlık `truncate` → `line-clamp-2`**, gövde `line-clamp-1`,
  zaman damgası kendi meta satırına indi; başlık artık kesilmiyor. **Sekmeler kategori değil okuma
  durumu filtresi**: `Tümü / Okunmamış` (`NotificationTab = "ALL" | "UNREAD"`). Altı kategori 380px
  panele sığmıyordu ve strip zaten COACH/PLAN'da donmuş, CONTENT/FORUM/ACHIEVEMENT/SYSTEM'i sessizce
  gizliyordu. **Zaman grupları** (`Bugün / Bu hafta / Daha eski`) sticky başlıklarla; `groupByRecency`
  render sırasında türetilir, state yok. Header'daki uzun "Tümünü okundu işaretle" linki `CheckCheck`
  ikon butonuna dönüştü. Yoğunluk: mobilde ~4.5 → ~8 satır. İlgili: `notification-drawer-item.tsx`,
  `notification-drawer-panel.tsx`, `types.ts`, `notification-drawer-shell.tsx`.
  - **İkon renk haritası düzeltildi:** `--color-accent` `--color-progress`'in birebir aliası
    (`#55acee`) olduğu için **ACHIEVEMENT ve FORUM aynı renkte** çiziliyordu; `PLAN` ise token değil
    hardcoded `#4A80D8` taşıyordu. ACHIEVEMENT → `--color-star` (amber), PLAN → `--color-progress`.
    Çıplak ikona geçince renk tek ayırt edici olmasın diye kategoriyi **glif taşır** (WCAG 1.4.1).

- **Admin duyuru sistemi (APP-053, 2026-08-28)** — Ekibin panelden yazdığı ilk bildirim yolu.
  `announcements` tablosu (migration `0086`, RLS SERVICE/ADMIN) + `AnnouncementService` notifications
  modülünde; `AdminAnnouncementsController` (SUPER_ADMIN, audited) servisi tüketir — admin tabloya
  dokunmaz (workstreams §3). Yeni `SYSTEM` kategorisi (`category` text olduğu için migration yok).
  Gönderim `notifications.dispatch-announcement` job'ına düşer: `UsersService.listAnnouncementRecipients`
  ile 500'lük keyset sayfası çeker, `user_notifications`'a toplu insert eder ve batch doluysa kendini
  cursor ile yeniden kuyruğa atar. `dedupeKey = "announcement:{id}"` mevcut `(user_id, dedupe_key)`
  partial unique index'ine yaslandığı için tekrar çalışan job ikinci bildirim üretmez. Zamanlama ayrı
  scheduler istemez — `scheduledAt` doğrudan job'ın `runAt`'i olur (`session-return-reminder` deseni).
  Kanal **yalnız in-app**: push/e-posta yok. Kullanım: admin `/announcements` → taslak oluştur → gönder;
  zil SSE ile anında güncellenir. Gotcha: `linkUrl` Zod sınırında `^/(?!/)` ile internal path'e
  kilitli — drawer `router.push(linkUrl)` çağrısını doğrulamadan yaptığı için mutlak URL saklı
  open-redirect olurdu. İlgili: `announcement.service.ts`, `announcement-dispatch.handler.ts`,
  `announcement.repository.ts`, `admin-announcements.controller.ts`.

- **Gece Yolculuğu canlı kutlama sinyali (2026-08-22)** — Community yeni bir kalıcı `LEVEL_UP`
  kaydı oluşturduğunda Notifications yalnız SSE üzerinden `journey_level_unlocked` sinyali
  yayınlar. Zil/bildirim merkezi satırı oluşturulmaz; istemci sinyali alınca kalıcı unseen
  kaynaklarını yeniden okur. Kullanım: mevcut notification stream bağlantısı yeterlidir. Gotcha:
  bu sinyal teslim garantili değildir ve kullanıcıya gösterilecek seviye bilgisini taşımaz; bağlantı
  kaçırılırsa sonraki görünürlük/açılış senkronu kutlamayı toparlar. İlgili:
  `journey-level-events.listener.ts`, `notification-drawer-shell.tsx`.

- **Achievement bildirimi (2026-08-18)** — `ACHIEVEMENT` kategorisi, JSON metadata ve kısmi unique
  dedupe anahtarı eklendi. Yalnız yeni LIVE award tek bildirim ve tek `achievement_awarded` SSE üretir;
  metinler istek dilinde TR/EN çözülür ve link profil Başarılar sekmesine gider. BACKFILL sonuçları
  bildirim yağmuru oluşturmaz; unseen API üzerinden tek geçmiş-emek kutlamasında gruplanır. İlgili:
  `achievement-events.listener.ts`, `notifications.service.ts`, `user-notification.repository.ts`.

- **Drawer + toast light/dark surfaces (2026-08-18)** — Notification panel, unread
  rows, and toast cards use `--color-surface` / `--color-border`. Bell/close
  hovers mix `--color-main`. Unread count on `--color-progress` stays white.
  Swipe-delete uses `--color-danger`. Usage: bell in AppNav; any success/error
  toast. Related: `notification-drawer-panel.tsx`, `notification-drawer-item.tsx`,
  `toast-item.tsx`, `docs/features/web-shell.md`.

- **KVKK silme: bildirim verisi (WP-K, 2026-07-22)** — `NotificationsErasureService` hesap silmede
  `push_subscriptions`, `notification_preferences`, `notification_deliveries` ve `user_notifications`
  satırlarını tek SERVICE-ctx tx'te hard delete eder; `AccountErasureService` zincirinin son adımı.
  Gotcha: modül `@Global` olduğundan `AccountModule` import etmeden resolve olur. Related:
  `notifications-erasure.service.ts`, `test/account-erasure.e2e-spec.ts`.
- **Rule-based continuity deep-links (2026-07-22)** — Notification listeners still generate no AI
  copy and depend on no LLM service. Low-mood and completed-plan notifications now open `/dashboard`
  so the current mood/plan action is resolved from live deterministic data. The first-session action
  remains `/study-session`; opt-in return reminders preserve the subject and add
  `source=reminder`. Related: `coaching-events.listener.ts`,
  `session-return-reminder.service.ts`, and their specs.

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
- **Seans “Yarın hatırlat” (2026-07-12)** — API-first soft return: `POST /v1/notifications/session-return-reminder`
  `{ subject? }` → `notification_deliveries` SCHEDULE dedupe `session-return:{UTC-day}` →
  `JobQueuePort.enqueue(SESSION_RETURN_REMINDER, { runAt: now+24h })`. Handler: in-app COACH +
  optional push (no email v1); link `/seans?subject=`. FE: seans done CTA. Mobile aynı endpoint.
  Dosyalar: `session-return-reminder.service.ts`, `session-return-reminder.handler.ts`,
  `notifications.controller.ts`, `notification-api.ts`, `session-done-state.tsx`. Seam: [coaching.md](./coaching.md).

## Gotchas / Known issues

- **`@mentor/ui` depends on `@mentor/types`** — added as a `dependencies` entry in `packages/ui/package.json`
  when notification-drawer components imported `UserNotificationDto`. This was intentional: UI types are
  shared; if you add more cross-package type imports to ui, check that the dep is still listed.
- **`NotificationDrawerShell` is in `(app)/layout.tsx`** — available on all app pages. Do not add it again in individual page shells (double-wrap breaks context). `panel-shell.tsx` had this bug; now fixed.
- **SSE token is one-time and 60s TTL** — `EventSource` can't send headers, so frontend POSTs for a stream token first, then appends `?token=` to the SSE URL. Tokens are in-memory (process-scoped, single instance); multi-instance would need Redis/pub-sub.
- **SSE heartbeat** — 25s `interval()` keeps proxy connections alive; Nginx default is 60s idle timeout.
- **Streak broken fires once per reset** — `StreakService` compares persisted `existing.currentStreak` vs newly derived. Event emits only when it drops to 0. Strict Mode double-invoke in dev may fire twice; harmless (two identical notifications).

- **Duyuru `linkUrl` yalnız internal path** — `notification-drawer-shell` link'i doğrulamadan
  `router.push` eder; admin metni bir trust boundary olduğundan kısıt Zod şemasında zorunlu.
- **Duyuru fan-out'u zincirlenmiş job'lardır** — 500 alıcı/tur. Tavan iş süresi (bellek değil);
  kullanıcı tablosu birkaç dakikalık zinciri aşarsa aynı identity seam'i arkasında set-based
  `INSERT … SELECT`'e geç.
- **Drawer sekmeleri kategori filtresi değil** — `Tümü / Okunmamış`. Yeni bir kategori eklemek
  sekme/i18n bakımı gerektirmez; kategoriyi satırdaki ikon taşır.
- **`--color-accent` = `--color-progress`** (ikisi de `#55acee`). İkon/rozet renklerinde ikisini
  farklı sanıp yan yana kullanma — aynı çıkarlar.
- **`SYSTEM` kategorisinin ayrı drawer sekmesi yok** — `CONTENT`/`FORUM`/`ACHIEVEMENT` gibi "Tümü"
  altında görünür — sekmeler okuma durumuna göre filtrelediği için bu kalıcı bir tasarım kararı.
- **Cron endpoints are `@Public()`** but require `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`.
- **`withServiceContext` runs inside job claim/complete** — unit tests must mock `db.transaction` with
  `tx.execute`.
- **Postmark is US-hosted** — disclose in KVKK/privacy copy when email is enabled.
- **Daily reminders dedupe** via `notification_deliveries` key `daily-reminder:{userId}:{YYYY-MM-DD}`.
- **Session return reminder** uses `+24h` UTC (not user TZ); may land near the daily reminder window —
  different copy/opt-in; user TZ = backlog. SCHEDULE channel dedupe is per target UTC day.
- **AI contextual notifications are out of scope** (W3); copy is fixed templates in
  `notifications.json` (TR/EN), not LLM-generated. Voice rules: [`docs/copy/voice.md`](../copy/voice.md).
- **Inbox rows without `data.templateKey` keep stored title/body** — legacy copy is not migrated;
  90-day purge (backlog) is the eventual cleanup.
- **Cache is per-process** → a flag change is instant on the instance that served the PATCH; other
  instances pick it up on next cold read. MVP = 1 instance, so fine; Phase 2 = pub/sub or short TTL.
- **Catalog is the source of truth** — never insert `config_overrides` rows by hand for keys absent
  from the catalog; `get` would ignore them and `set` rejects them (404).
- **Migration ordering:** W5's `0007_w5_notifications.sql` existed without a `0007_snapshot.json`, so
  `drizzle-kit generate` re-emitted the notification tables into 0008. Fixed by hand-trimming 0008 to
  only `admin_audit_log`; the generated `0008_snapshot.json` heals the baseline. Lesson: always commit
  the snapshot with your migration.

## Backlog

- **Duyuru sonrası sıradaki tetikleyiciler** (öncelik sırası): sınav takvimi geri sayımı
  (`exam_events.EXAM_DATE`'e 30/7/1 gün kala, `examType` bazlı) · ödeme/trial in-app bildirimi
  (`payments-events.listener` şu an yalnız e-posta atıyor) · yeni içerik yayını (`CONTENT` kategorisi
  tanımlı ama hiçbir yerde üretilmiyor) · 90 günlük inbox purge (`deleteOlderThan` yazılmış, hiç
  çağrılmıyor).
- Duyuru için push/e-posta kanalları · premium/free ve tekil kullanıcı hedefleme · kategori bazlı
  bildirim tercihi (`notification_preferences` migration'ı) · duyuru okunma oranı metriği.
- Re-validate overrides on read against the (possibly evolved) catalog schema · cache the in-flight
  load promise · optionally Turkish catalog descriptions · multi-instance cache invalidation (pub/sub).

## Related

- Seam: [identity.md](./identity.md) (auth emails), [payments.md](./payments.md) (dunning/welcome
  events), [coaching.md](./coaching.md) (daily reminder), [ai.md](./ai.md) (embed-article job),
  [admin.md](./admin.md) (config editor)
- Web: `sw.js`, `/profil` notification settings
- Status: [core/mvp-status.md](../core/mvp-status.md) (W5)
