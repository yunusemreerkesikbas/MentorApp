# Coaching

> The daily ritual loop: Panel hub, plan tasks, Pomodoro session, mock-exam analysis, streak, mood,
> ghost (geçmiş-ben), vision board. Module: `modules/coaching`. Workstream: W2.
> Roadmap: MVP; Phase 2 adds ambient sound, coach-built study plans, calendar integrations.

## Overview

Coaching is the companionship core — the daily loop that keeps a student going. It produces the
`/panel` composite payload (greeting · calm countdown · streak · today's plan · session presets ·
mood), plan-task CRUD, Pomodoro-style study sessions, deneme (mock-exam) entry + personal trend
analysis (no ranking), a read-time-derived streak with monthly freeze tokens, mood check-ins, a
"geçmiş-ben" (past-self) comparison, and a single-goal vision board. The deeper AI layer (mood
reflection, ghost narration, vision note) is owned by the [AI module](./ai.md) — coaching owns the
domain logic + persistence and exposes setters the AI module calls.

## Architecture (key decisions)

- **Bounded context** `apps/api/src/modules/coaching/**` — domain/application/infrastructure/
  presentation layering (mirrors `identity`). Wired into `app.module.ts` (one alphabetical line).
- **Tables (append-only `/* W2 · coaching */` schema block):** `plan_tasks`, `study_sessions`,
  `daily_activity` (UNIQUE user+date), `streak_state` (UNIQUE user), `mood_checkins` (UNIQUE
  user+date), `mock_exams` + `mock_exam_subjects`, `mock_exam_photo_categorizations`, `vision_boards`
  (UNIQUE user). Migration `drizzle/0002_w2_coaching.sql` + later deltas. RLS ENABLE+FORCE per-user
  policies on every table (matching the 0001 pattern).
- **Streak = read-time derived** (no cron): pure `domain/streak.ts` walks `daily_activity` backward;
  a single missed day is bridged by one of 2 monthly freeze tokens; two consecutive misses
  soft-reset. Idempotent (always derives from active dates + monthly allowance → no token double-spend).
  `current_streak` is recomputed on read; `freeze_tokens` = monthly allowance − this month's bridges.
- **Day math is UTC** (`domain/date.util.ts`); `daily_activity.activity_date` for a session = UTC date
  of `started_at`. Per-user timezone can be threaded later without changing the pure helpers.
- **ContentPort seam:** `domain/content.port.ts` (interface + `CONTENT_PORT` token) bound to the W1
  `ContentServiceAdapter`. Countdown reads `users.examType` via **identity `UsersService.getMe`**,
  never a coaching query on `users`, never `users.examDate` (deprecated/ignored for countdown).
- **Net rule** (`domain/net.ts`): KPSS penalty rule from `exams.netRule` — net is **never** computed
  on the frontend; display `totalNet` / `net` from the API only.
- **Repositories take the RLS-scoped `tx`** (opened by the service via `withUserContext`) so
  multi-table writes (task/session ↔ `daily_activity`) are atomic. Don't open a second tx inside a repo.
- **AI seam (workstreams §2):** AI never writes coaching tables — it calls `MoodService.
  setTodayAiReflection`, `MockExamService.setLatestGhostNarration`, `VisionService.setAiNote`.

## Tutorials / Guides

```bash
# DB for tests/dev (pgvector image, host port 5433, also creates the test DB)
docker compose up -d
pnpm --filter @mentor/api db:migrate
pnpm --filter @mentor/api dev

# Composite panel payload (the one call the /panel screen makes):
GET /v1/coaching/today

# Plan tasks:
GET    /v1/plan-tasks?date=YYYY-MM-DD
GET    /v1/plan-tasks?from=YYYY-MM-DD&to=YYYY-MM-DD   # inclusive range (week view; max 62 days; mutually exclusive with date)
GET    /v1/plan-tasks/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD   # distinct dates with tasks (datepicker)
POST   /v1/plan-tasks
PATCH  /v1/plan-tasks/:id        # toggle status → recomputes daily_activity.tasks_done (same tx)
DELETE /v1/plan-tasks/:id

# Pomodoro / study session:
GET   /v1/study-sessions?page=1&pageSize=5&subject=Matematik&from=2026-07-01&to=2026-07-12  # finalized history (optional subject + UTC day range on started_at)
POST  /v1/study-sessions             # { preset: "25_5" } OR { preset: "custom", focusMinutes: 35 }
PATCH /v1/study-sessions/:id         # complete/abandon → recomputes daily_activity.has_session (same tx)
PATCH /v1/study-sessions/:id/feedback # post-session micro check-in { mood: 1-3, struggleNote? }

# Mock exam + personal trend (no ranking):
POST /v1/mock-exams             # { examId, subjects: [{ subjectRef, correct, wrong, blank }] }
GET  /v1/mock-exams/:id
GET  /v1/coaching/analysis      # personal trend + ghost (null until ≥2 attempts)

# Mood check-in:
POST /v1/coaching/mood-checkins # upsert today (mood 1-5 + optional struggleNote)
GET  /v1/coaching/mood-checkins # paginated trend

# Vision board (idempotent upsert, mirrors mood):
GET  /v1/coaching/vision        # VisionDto | null
POST /v1/coaching/vision        # { goalTitle, targetCity?, motivation? }

# Tests:
pnpm --filter @mentor/api test
```

### `GET /v1/coaching/today` shape

```jsonc
{
  "greetingName": "Elif",
  "motivationalLine": "…",           // rule-based, backend-localized (TR)
  "countdown": {                      // null if no examType / no calendar date (no silent fallback)
    "examType": "KPSS", "examName": "KPSS Lisans 2026",
    "daysRemaining": 184, "examDateLabel": "12 Temmuz 2026",
    "source": "ÖSYM", "sourceUrl": "https://www.osym.gov.tr"
  },
  "streak": { "currentStreak": 7, "longestStreak": 21, "freezeTokens": 2 },
  "tasks": [{ "id": "…", "title": "…", "subject": "Türkçe", "status": "DONE", "sortOrder": 0, "taskDate": "2026-06-10" }],
  "sessionPresets": [{ "id": "25_5", "label": "25 / 5 dk", "focusMinutes": 25, "breakMinutes": 5 }],
  "mood": null
}
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /v1/coaching/today` | Composite Panel payload (greeting · countdown · streak · tasks · presets · mood) |
| `GET/POST /v1/plan-tasks` · `PATCH/DELETE /:id` | Plan-task CRUD; list by `date` **or** inclusive `from`/`to` range (week view) |
| `GET /v1/study-sessions` | Paginated finalized-session history ("Son seanslar") |
| `POST /v1/study-sessions` · `PATCH /:id` | Pomodoro start / complete-abandon (recomputes `daily_activity`) |
| `PATCH /v1/study-sessions/:id/feedback` | Post-session micro check-in (mood 1-3 + optional note → AI signal) |
| `POST /v1/mock-exams` · `GET /:id` · `GET /v1/coaching/analysis` | Mock-exam entry + personal trend + ghost |
| `POST/GET /v1/coaching/mood-checkins` | Mood check-in (upsert today) + trend |
| `GET/POST /v1/coaching/vision` | Vision board (idempotent upsert, single row per user) |

## Geliştirmeler (timeline)

- **Panel (Anasayfa) UI** — `/panel` Server Component: greeting, calm countdown (blue, no alarm-red),
  streak badge (anti-shaming), today's plan list, start-session CTA, mood check-in. Six `@mentor/ui`
  primitives (`SectionHeading`, `DataCard`, `CountdownCard`, `StreakBadge`, `PlanListItem`,
  `MoodPicker`). `PanelShell` loads `GET /v1/coaching/today` client-side (token in memory). *(0013.)*
- **Panel mobile-first redesign** — `/panel` now uses an app-like header with Puhu + earned-rights
  economy capsule, a wellness-style "Bugünkü ritim" summary, a language-app-inspired weekly streak
  card, and a compact ritual task/CTA card. Data still comes from `GET /v1/coaching/today` and
  `/v1/economy/balance`; no leaderboard or alarm framing was introduced. Header greeting is time-aware
  and the notification trigger stays in the app shell to avoid duplicate bells. Mood check-in now opens
  through the shared `@mentor/ui` dialog as a dismissible Puhu mood modal when today's check-in is
  missing; "Daha sonra sor" only postpones for the current visit. Related file:
  `apps/web/src/app/[locale]/(app)/panel/_components/panel-shell.tsx`.
- **Mood check-in çarkıfelek picker (2026-07-04)** — Convex-arc coverflow (`MoodWheelPicker`): Puhu
  küreleri yukarı kavisli rail üzerinde kayar; ortadaki slot 96px + star glow, yanlar 68px fade.
  Kesikli arc connector, kavisli tick dial (SVG) + sabit pembe pointer. Sürükle → snap; ortadaki
  Puhu veya "Check-in yap" ile kaydet. Dosya: `mood-wheel-picker.tsx`.
- **Coaching daily-loop (backend)** — new `modules/coaching` bounded context; 5 tables + RLS;
  composite `/today` endpoint; plan/session/mood endpoints; streak = read-time derived; ContentPort
  seam bound to W1 adapter. Shared contracts in `@mentor/types`/`@mentor/validation`. *(0014.)*
- **Plan + Seans UI** — `/plan` full CRUD (list by date, create, toggle, delete); `/seans` Pomodoro
  (preset select, client timer, `POST/PATCH study-sessions` finalize). Manual URL for `?date=` until
  OpenAPI exposes the query param; `useSearchParams` wrapped in `<Suspense>`. *(0021.)*
- **Seans focus modu + mola + subject deep-link (2026-07-08)** — `/seans` faz makinesi artık
  `idle → focus → break → done`. Focus süresi dolunca seans otomatik `COMPLETED` yazılır (PATCH,
  `actualFocusSeconds = focusMinutes*60`) ve **atlanabilir** mola sayacı başlar; mola tamamen
  client-side (DB kavramı yok), süresi presetten gelir (25/5→5, 50/10→10, custom→sabit 5 dk).
  `focus`+`break` fazları **immersive** görünümde: `SeansShell` `fixed inset-0 z-30` katmanı render
  eder (nav `z-20` altta kalır), pastel blob backdrop + halka + minimal kontroller. Plan görevinden
  konu taşınır: `plan-task-row`/`plan-timeline-view` linkleri `task.subject` varsa
  `/seans?subject=…` verir; shell `subject`'i parse edip başlıkta chip olarak gösterir ve
  `POST /v1/study-sessions` gövdesine ekler (backend `subject` alanı zaten mevcuttu — BE değişmedi).
  `CircularTimerRing` countdown modunda halka içine yumuşak radyal pastel gradyan (Referans 1
  estetiği). Kullanım/gotcha: mola atlansa/beklense de seans focus bitişinde persist edilir; erken
  "Seansı bitir"/"Erken bırak" molayı atlar. Hata toast'ları `z-[100]` immersive üstünde kalır.
  Dosyalar: `apps/web/src/app/[locale]/(app)/seans/_components/*`,
  `apps/web/src/app/[locale]/(app)/plan/_components/plan-task-row.tsx`,
  `plan-timeline-view.tsx`, `packages/ui/src/components/circular-timer-ring.tsx`,
  `apps/web/messages/{tr,en}.json`.
- **Seans UI rafinasyonu (2026-07-08)** — immersive kontroller referanstaki gibi kompakt ikon
  satırı: merkezde mavi (`--color-progress`) büyük ⏸/▶, yanlarda ✕/✓ (focus) veya ⏭ (break);
  hepsi `--shadow-card` ile yüzeyden kalkar, ikon-only + `aria-label`. `CircularTimerRing`
  countdown'a hareket eklendi: iç pastel dolgu 4s sakin "nefes" (`mentor-timer-breathe`,
  reduced-motion kapalı), stroke geçişi 1s ease-linear (sürekli akış), yay ucunda glow'lu öncü
  nokta. Idle kurulum ekranına bilgi şeridi: **Odak / Mola / Tahmini bitiş** (mola-farkında;
  bitiş `now` 30s'de bir tazelenir, `Date.now()` render dışı). Dosyalar:
  `session-controls.tsx`, `circular-timer-ring.tsx`, `packages/ui/src/theme.css`, `seans-shell.tsx`.
- **Seans geçmişi / görünürlüğü (2026-07-09)** — roadmap §255 "hesap verebilirlik ritüeli":
  yakalanan seans verisi artık kullanıcıya geri gösteriliyor. `GET /v1/study-sessions` (paginated,
  `endedAt` not-null → finalize edilmiş geçmiş, `startedAt desc`) eklendi; mock-exam/mood list
  pattern'iyle birebir (`listStudySessionsQuerySchema = paginationQuerySchema` → repo `listPaged` →
  service `list` → controller `@Get()`). `/seans` idle ekranında `SessionHistory` bölümü son 5 seansı
  gösterir: efor emoji (`session_mood` 1/2/3 → 😩😐🙂), süre, konu chip'i, `struggle_note`, durum
  (Tamamlandı / **Yarım kaldı** — anti-shaming §0), tarih. `reset()` ile idle'a dönünce remount →
  yeni seans taze görünür. FE generated client list query paramı üretmediği için `study-sessions.ts`
  wrapper URL'e `page/pageSize` ekler (plan-tasks deseni). Sadece frontend + tek okuma endpoint'i;
  DB/migration yok. **Kapsam dışı:** AI tüketimi (W3), tam sayfa geçmiş/filtre/"load more" (backlog).
  Dosyalar: `session-history.tsx`, `seans-shell.tsx`, `study-sessions.ts` (web), coaching
  `study-session.controller`/`session.service`/`study-session.repository`/`coaching.dto`,
  `packages/validation`, `coaching.e2e-spec.ts`, `messages/{tr,en}.json`.
- **Seans özetinin AI koça açılması (2026-07-09)** — roadmap §258/§259 seam'inin coaching tarafı:
  yakalanan seans sinyali (konu + efor + `struggle_note`) artık AI context'ine PII-free bir agregat
  olarak akıyor. `SessionService.getRecentSummary(userId)` son `RECENT_SESSION_WINDOW_DAYS`(7) günün
  finalize seans sayısı + odak dakikası + son distinct konular (`RECENT_SUBJECTS_MAX`=4) + en yeni
  `struggle_note`'u döndürür (hiç aktivite yoksa `null`). Veri erişimi tek yer:
  `StudySessionRepository.recentSummary` (2 sınırlı sorgu: agregat + son 20 satır tarama). `SessionService`
  artık `coaching.module` `exports`'unda (AI `ContextBuilder` tüketir; `MoodService` gibi). Yeni tablo/
  kolon/endpoint yok. **Guardrail (§4 #6):** yalnız sayı + kullanıcının kendi konu adları + kendi notu;
  e-posta/isim/davranışsal ham veri yok. Dosyalar: `coaching.constants.ts` (`RecentSessionSummary`),
  `study-session.repository.ts`, `session.service.ts`, `coaching.module.ts`, `session.service.spec.ts`.
  Seam karşılığı: [ai.md](./ai.md).
- **Seans idle UI sadeleştirme (2026-07-09)** — gereksiz yardımcı metinler kaldırıldı (`duration_*`,
  `subject_optional_hint`, halkadaki "Sürükle veya ok tuşları"); chip'ler `aria-label`/`aria-pressed`
  ile kendi kendini anlatıyor. Özet satırı nested-card gölgesinden pastel tint'e indi; timer 280px;
  `+/−` yuvarlak. "Son seanslar" tek yüzeyli liste (avatar süre/mood + konu + durum + tarih). Dosyalar:
  `seans-shell.tsx`, `session-subject-picker.tsx`, `session-timer-ring.tsx`, `session-history.tsx`,
  `circular-timer-ring.tsx` (`@mentor/ui`), `messages/{tr,en}.json`.
- **Seans sonrası premium AI yansıması — coaching seam (2026-07-09)** — `study_sessions` +=
  `ai_reflection` / `ai_model` / `ai_reflected_at` (migration `0039_fair_jazinda`).
  `SessionService.setAiReflection` + `getById` (W3 yazar, AI tabloya dokunmaz); `recordFeedback`
  mood/note değişince cache temizler. `StudySessionDto.aiReflection`. Seam: [ai.md](./ai.md).
- **Seans → XP ödül döngüsü — coaching seam (2026-07-10)** — roadmap §262: `finalize(COMPLETED)` tx
  sonrası `coaching.session-completed` emit eder (her tamamlanan seans; ABANDONED'da yok). Economy
  dinler ve mevcut odak quest'lerini grant eder; coaching economy'yi doğrudan çağırmaz (modül sınırı).
  Seam: [economy.md](./economy.md). Dosyalar: `coaching.events.ts`, `session.service.ts`,
  `session.service.spec.ts`.
- **Seans done kapanış polish (2026-07-10)** — done ekranı panel quest v2.4 ile hizalandı: seans
  başında quest/streak baseline yakalanır; bitişte snapshot diff → quest ödül toast'ı (inline XP pill
  kaldırıldı) + sakin streak pill (`streak_started` / `streak_kept`). Paylaşılan yardımcılar:
  `economy-quest-utils.ts` (panel + seans). Dosyalar: `seans-shell.tsx`, `session-done-state.tsx`,
  `panel-shell.tsx`, `messages/{tr,en}.json`.
- **Minimum odak süresi — streak/XP eşiği (2026-07-10)** — roadmap §261: tamamlanan seanslar
  kaydedilir ama yalnızca `actual_focus_seconds ≥ coaching.session.min_focus_seconds` (varsayılan 300s /
  5 dk) olanlar streak, `SESSION_COMPLETED` (XP) ve quest sinyallerine sayılır. Config:
  `coaching.session.min_focus_seconds` (`ConfigCategory.COACHING`). API: `StudySessionDto.countsAsFocusSession`.
  Done ekranı: kısa seanslarda anti-shaming `session.too_short_hint` pill (seri/XP toast tetiklenmez).
  `recentSummary` / geçmiş listesi bilinçli olarak filtrelenmez (deneme sinyali korunur). Dosyalar:
  `config.catalog.ts`, `coaching.constants.ts`, `study-session.repository.ts`, `session.service.ts`,
  `daily-quest-signal.service.ts`, `coaching.mappers.ts`, `packages/types`, `session-done-state.tsx`,
  `seans-shell.tsx`, `coaching.e2e-spec.ts`, `messages/{tr,en}.json`.
- **Plan → Seans tek tık bağlamı (2026-07-10)** — roadmap §256/§259: plan görevinden seansa geçişte
  konu + görev başlığı + `taskId` URL query ile taşınır; `/seans` idle ve immersive ekranda sakin
  `session.from_plan_task` chip'i gösterilir. Paylaşılan helper: `plan-seans-link.ts`
  (`buildSeansHrefFromPlanTask`). Entry point'ler: `plan-task-row`, `plan-timeline-view`, panel
  `today-plan` (pending görevler). Backend değişmedi — `study_sessions.subject` yeterli; `planTaskId`
  kolonu §259 AI adaptasyonuna kadar ertelendi. Reset/yeni seans plan bağlamını temizler. Dosyalar:
  `plan-seans-link.ts`, `plan-seans-link.spec.ts` (api vitest), `seans-shell.tsx`, `today-plan.tsx`,
  `messages/{tr,en}.json`.
- **planTaskId persist — Plan → Seans köprüsü (2026-07-10)** — roadmap §259: plan görevinden
  başlatılan seanslar artık `study_sessions.plan_task_id` FK ile kalıcı bağlanır (nullable;
  manuel konu seçimi `null`). `POST /v1/study-sessions` gövdesi += opsiyonel `planTaskId` (UUID);
  RLS tx içinde `PlanTaskRepository.findById` — yoksa `COACHING_TASK_NOT_FOUND` (404). DTO:
  `StudySessionDto.planTaskId`. FE: `seans-shell` → `useSessionTimer({ planTaskId })` → start body.
  Migration: `0040_certain_iceman.sql`. **Kapsam dışı:** geçmiş satırında görev başlığı, AI plan
  revizyonu, finalize'da planTaskId değiştirme. Dosyalar: `schema.ts`, `session.service.ts`,
  `coaching.mappers.ts`, `packages/{types,validation}`, `use-session-timer.ts`, `seans-shell.tsx`,
  `session.service.spec.ts`, `coaching.e2e-spec.ts`.
- **Seans bitince plan görevi otomatik DONE (2026-07-10)** — §259 döngüsü: `finalize(COMPLETED)` +
  min odak eşiği + `planTaskId` → linked görev aynı tx'te `DONE`; `daily_activity.tasks_done`
  senkron; bugünün tüm görevleri biterse `PLAN_COMPLETED` event. DTO:
  `StudySessionDto.planTaskAutoCompleted` (finalize yanıtı). FE: `finalizeStudySession` DTO döner,
  timer session state günceller; done ekranı `plan_task_completed` pill. Geçmiş gün görevleri
  dokunulmaz (`taskDate >= today`). **Kapsam dışı:** undo, ABANDONED geri alma. Dosyalar:
  `session.service.ts`, `coaching.mappers.ts`, `packages/types`, `use-session-timer.ts`,
  `study-sessions.ts`, `session-done-state.tsx`, `messages/{tr,en}.json`.
- **Seans geçmişinde plan görev başlığı (2026-07-10)** — planTaskId persist'in UX devamı:
  `GET /v1/study-sessions` listesi `plan_tasks` ile LEFT JOIN → `StudySessionDto.planTaskTitle`
  (start/finalize yanıtlarında `null`). Idle "Son seanslar" satırında muted chip + truncate +
  `history_plan_task` aria-label. Migration yok. **Kapsam dışı:** `/seans/gecmis` tam sayfa,
  otomatik DONE. Dosyalar: `study-session.repository.ts`, `coaching.mappers.ts`,
  `session.service.ts`, `session-history.tsx`, `packages/types`, `coaching.e2e-spec.ts`,
  `messages/{tr,en}.json`.
- **Seans geçmişi load-more (2026-07-10)** — roadmap §255: `/seans` idle "Son seanslar" listesine
  `Paginated.total` tabanlı "Daha fazla göster" eklendi (ilk 5, her tıklamada +5). Mevcut
  `GET /v1/study-sessions?page&pageSize` — backend değişmedi. `SessionHistoryRow` extract (ileride
  tam sayfa reuse). Load-more hatası sakin inline mesaj; liste korunur. Idle remount ile yeni seans
  sonrası liste tazelenir. **Kapsam dışı:** `/seans/gecmis` tam sayfa + filtre. Dosyalar:
  `session-history.tsx`, `messages/{tr,en}.json`.
- **Seans geçmişi tam sayfa `/seans/gecmis` (2026-07-10)** — roadmap §255 hesap verebilirlik ritüeli:
  idle "Son seanslar" başlığında "Tümünü gör" → `/seans/gecmis` paginated tam liste (sayfa boyutu 15,
  load-more). Konu chip filtresi: ilk unfiltered fetch'ten distinct konular (page 1, size 30); seçim
  `GET /v1/study-sessions?subject=` ile exact match filtreler. `SessionHistoryRow` ayrı dosyaya
  extract edildi (idle + tam sayfa reuse). Geri link `/seans` (koc-chat-shell deseni). Migration yok.
  **Kapsam dışı:** tarih aralığı filtresi, seans detay sayfası, export. Dosyalar:
  `session-history-row.tsx`, `session-history-page.tsx`, `seans/gecmis/page.tsx`, `session-history.tsx`,
  `study-sessions.ts`, `study-session.repository.ts`, `packages/validation`, `coaching.e2e-spec.ts`,
  `messages/{tr,en}.json`.
- **Seans geçmişi tarih filtresi (2026-07-12)** — `/seans/gecmis`: Tümü · Bugün · Son 7 gün · Son 30 gün
  chip'leri. `GET /v1/study-sessions?from=&to=` (yyyy-mm-dd, inclusive UTC günler, `started_at`);
  `from > to` → 400. Konu filtresiyle birlikte. Custom date picker / detay / export yok. Dosyalar:
  `listStudySessionsQuerySchema`, `study-session.repository.ts`, `session.service.ts`,
  `history-date-range.ts`, `session-history-page.tsx`, `study-sessions.ts`, `messages/{tr,en}.json`,
  `coaching.e2e-spec.ts`.
- **SubjectPicker DRY (2026-07-11)** — plan (`PlanSubjectPicker`) ve seans (`SessionSubjectPicker`)
  konu seçicileri ortak `SubjectPicker` + `useExamSubjectTaxonomy` hook'una çıkarıldı; fetch mantığı
  tek yerde (`usersControllerMe` → calendar → subjects). Layout farkları korunur: plan `stacked`,
  seans `centered` + `role=group`. i18n namespace'leri (`plan` / `session`) değişmedi. Dosyalar:
  `components/subject-picker.tsx`, `lib/use-exam-subject-taxonomy.ts`, `plan-subject-picker.tsx`,
  `session-subject-picker.tsx`.
- **Plan Hafta range API — shipped (2026-07-11)** — `GET /v1/plan-tasks?from=&to=` (max 62 days,
  mutually exclusive with `date`) + `listByDateRangePaged`; FE `listPlanTasksForWeek` tek istek
  (`listPlanTasksForRange`). E2E: range list + `date`+`from` → 400. Dosyalar: `coaching.ts`
  (validation), `plan.service.ts`, `plan-task.repository.ts`, `plan-tasks.ts`, `coaching.e2e-spec.ts`.
- **Odak fon müziği v3 — preview (2026-07-11)** — idle kurulumda parça seçince ~5 sn
  önizleme; uygulama içi ses slider yok (cihaz sesi). `setVolume` kaldırıldı; sabit
  `PLAYBACK_VOLUME`. Dosyalar: `session-ambient-picker.tsx`, `use-session-ambient-sound.ts`.
- **Odak fon müziği v2 — pre-session picker (2026-07-11)** — idle kurulumda dropdown: Sessiz +
  3 ambient parça (`soft` / `rain` / `warm`); seçim Pomodoro başlamadan. Focus/break'te yalnızca
  mute/unmute (`trackId !== off`). `ambient-tracks.ts` katalog; v1 `{ enabled }` → `trackId` migration.
  Dosyalar: `session-ambient-picker.tsx`, `use-session-ambient-sound.ts`, `session-ambient-toggle.tsx`,
  `seans-shell.tsx`, `public/audio/focus-ambient-*.wav`, `scripts/generate-ambient-audio.mjs`.
- **Odak fon müziği — ambient sound v1 (2026-07-11)** — Phase 2 backlog'dan lean client slice:
  focus/break immersive görünümünde opsiyonel ambient loop (`/audio/focus-ambient.wav`, synthesized
  in-repo). `useSessionAmbientSound` + `SessionAmbientToggle`; tercih `localStorage`
  (`mentor.session.ambientSound`); seans duraklatılınca ses durur, varsayılan kapalı. Backend/coin yok.
  Regenerate: `node scripts/generate-ambient-audio.mjs`. Design: [`plans/2026-07-11-ambient-sound-design.md`](../plans/2026-07-11-ambient-sound-design.md).
- **Bugünkü plan özeti → AI koç context (2026-07-11)** — roadmap §259: `PlanService.getTodaySummary`
  bugünün görevlerinden PII-free özet döner (`total`, `done`, `pendingTitles` max 5); boş gün → `null`.
  `coaching.module` artık `PlanService`'i export eder (W2→W3 seam). Migration/endpoint yok.
  **Kapsam dışı:** otomatik plan revizyonu, FE. Dosyalar: `coaching.constants.ts`, `plan.service.ts`,
  `plan.service.spec.ts`, `coaching.module.ts`. Seam: [ai.md](./ai.md).
- **Plan auto-DONE sonrası `/plan` refetch (2026-07-11)** — §259 UX polish: seans bitince linked görev
  backend'de `DONE` olur; `/plan`'a dönünce liste güncel kalsın diye `PlanShell` görünür olunca
  sessiz refetch yapar (`visibilitychange` + bfcache `pageshow`). `loadDayTasks` / `loadWeekTasks`
  extract; loading flash yok. **Kapsam dışı:** `/panel` today-plan. Dosya: `plan-shell.tsx`.
- **Plan auto-DONE sonrası `/panel` refetch (2026-07-11)** — §259 UX polish devamı: seans bitince
  done ekranından `/panel`'e dönünce bugünkü görevler + ritim metrikleri güncel kalsın.
  `PanelShell` görünür olunca sessiz `refreshToday({ silent: true })` + `refreshQuests()` (toast yok);
  `visibilitychange` + bfcache `pageshow`. Loading flash yok. Dosya: `panel-shell.tsx`.
- **Seans yansıması → plan önerisi seam (2026-07-12)** — W3 session-reflection `ai_suggested_task`
  jsonb cache yazar (`SessionService.setAiReflection` 5. arg); feedback invalidate hem reflection
  hem task'ı temizler. Migration `0047_supreme_eternals`. FE done kartı W3'te. Seam: [ai.md](./ai.md).
- **Seans “Yarın hatırlat” CTA (2026-07-12)** — done ekranı W5 `POST /v1/notifications/session-return-reminder`
  opt-in; konu deep-link. Seam: [notifications.md](./notifications.md).
- **Seans öncesi konu seçimi (2026-07-09)** — roadmap §256 "veri kör kalmasın": `/seans` idle
  kurulum ekranına konu seçici (`SessionSubjectPicker`) eklendi; artık deep-link (`?subject=`)
  olmadan da konu seçilebiliyor, böylece mikro check-in sinyali bir konuya bağlanır. Plan'daki
  add-task picker deseni aynalandı (`usersControllerMe` → `contentControllerCalendarByFamily` →
  `contentControllerSubjectsBySlug`): examType'lı kullanıcıda ders chip'leri, examType yoksa Profil
  CTA + serbest metin, taksonomi boş/hata → serbest metin. `seans-shell` `subject`'i artık state
  (URL param'dan tohumlanır); idle'da picker, immersive'de salt-okunur chip. Sadece frontend —
  backend/DB/api-client değişmedi (konu zaten POST gövdesinde). Ortak `SubjectPicker` → 2026-07-11.
  Dosyalar: `session-subject-picker.tsx`, `seans-shell.tsx`, `messages/{tr,en}.json`.
- **Seans sonrası mikro check-in (2026-07-08)** — roadmap §258: Pomodoro "AI'ın gözü" oluyor. Seans
  `done` ekranına 3 emoji (😩😐🙂 → mood 1-3) + opsiyonel "seni en çok ne zorladı" notu eklendi;
  **atlanabilir** (mood seçmeden Yeni seans/Panele dön ile geçilebilir), seans konusu varsa not
  placeholder'ı kişiselleşir. Finalize akışına dokunulmadı: focus bitince seans zaten `COMPLETED`
  yazıldığı için check-in **ayrı** `PATCH /v1/study-sessions/:id/feedback` ile finalize *sonrası*
  eklenir (idempotent, yalnızca kullanıcının kendi seansı; status'e göre gate yok — nullable metadata).
  DB: `study_sessions` += `session_mood` (int 1-3) + `struggle_note` (text) — migration
  `0038_cloudy_night_thrasher.sql` (forward-only). Şema: `sessionFeedbackSchema` (@mentor/validation);
  `StudySessionDto` += `sessionMood`/`struggleNote` (append-only). **Kapsam dışı (Faz 2):** AI'ın bu
  sinyali yorumlaması (W3 seam) + seans→XP. Dosyalar: `session-done-state.tsx`, `use-session-timer.ts`,
  `seans-shell.tsx`, `study-sessions.ts` (web), coaching `session.service`/controller/dto/mappers,
  `schema.ts`, `packages/{types,validation}`, `coaching.e2e-spec.ts`, `messages/{tr,en}.json`.
- **Plan page refactor (3 views)** — `/plan` now has a segmented switcher: **Liste** (checklist +
  progress %), **Timeline** (Zendenta-style rail + Yapılacak/Tamamlanan cards), **Hafta** (7-day
  strip + selected-day tasks). View mode persists in `localStorage` (`mentor.plan.viewMode`). Add
  task moved to bottom sheet + sticky CTA (mobile above tab bar); date picker sheet via calendar
  icon. Week data = **one** `GET /v1/plan-tasks?from=&to=` via `listPlanTasksForWeek`. Date sheet uses `react-day-picker` v10 (TR/EN `date-fns` locale, Monday
  week start, DESIGN token overrides in `globals.css`). Selected day = full black circle +
  white label; days with tasks show a progress dot under the number. Calendar dots =
  **one** `GET /v1/plan-tasks/calendar?from=&to=` per visible month (not N day fetches). Files:
  `apps/web/src/app/[locale]/(app)/plan/_components/*`.
- **Plan Hafta wave UI** — **Hafta mobile:** dedicated `PlanWeekNavCard` (week strip) +
  `PlanWeekView` (selected-day tasks + progress). **Hafta desktop (`lg:`):** `PlanWeekDesktopLayout`
  — sticky mini calendar + week summary list + task panel (`max-w-6xl`). Add-task sheet:
  `PlanSubjectPicker` loads exam taxonomy via `GET /v1/content/exams/:slug/subjects` (fallback
  free-text when `examType` missing). Files: `plan-week-*.tsx`, `plan-subject-picker.tsx`.
- **Plan Hafta desktop dedup** — removed `PlanWeekStrip` from the right panel (was duplicating week
  range, 7-day picker, and week summary). Left sidebar = mini calendar + summary list with inline
  week arrows + merged week progress footer; right panel = selected-day tasks only. Task row ⋮ menu
  always visible on desktop; mini-calendar “Bugün” button uses shared picker tokens. Files:
  `plan-week-desktop-layout.tsx`, `plan-week-mini-calendar.tsx`, `plan-week-nav-button.tsx`,
  `globals.css` (`.mentor-plan-week-mini-calendar`).
- **Plan mini calendar polish** — fixed selected-day contrast (solid black fill beats week-range
  tint; `aria-selected` fallback), centered task dots, weekday column alignment, flat wrap inside
  Card (no double border). Today = soft progress pill; week band excludes selected/today. Files:
  `globals.css`, `plan-week-mini-calendar.tsx`.
- **Plan Timeline UX** — task column scrolls after 4 cards (`PLAN_TIMELINE_SCROLL_AFTER_TASKS`);
  sticky date badge on rail; bottom fade hint. `PlanProgress` uses `scaleX` fill animation
  (520ms ease-out; reduced-motion safe). Files: `plan-timeline-view.tsx`, `plan-progress.tsx`,
  `globals.css`.
- **Mock exam + analysis** — `subjects`/`exam_subjects` seed + KPSS taxonomy endpoint; `mock_exams`/
  `mock_exam_subjects`; `domain/net.ts` (KPSS penalty rule); `/analiz` UI (per-subject D/Y/Boş,
  ProgressBar trend — no chart lib). *(0022-w2.)*
- **Panel UI polish** — shared `stagger-motion.ts`; `PanelShell` header fade + grid stagger;
  `CountdownPlaceholder` (CTA → `/profil` when `examType` missing; editorial-gap message when type
  set but no calendar seed); `StartSessionCta` extracted (Link-as-button, valid HTML). *(0033.)*
- **Plan + Seans UI polish** — `PlanShell`/`SeansShell` motion + `AnimatePresence` phase transitions
  (idle → focus/break → done); `SectionHeading` preset picker; eslint-safe fetch (`active` flag). *(0037.)*
- **Analiz UI polish** — `AnalizShell` `LoadState` union (separates `needs_exam_type` from API
  errors); always-visible trend card with chip empty state; tabular nums; calm subtitle (no ranking). *(0038.)*
- **Seans circular timer + custom duration** — `CircularTimerRing` in `@mentor/ui` (SVG progress
  ring, drag/touch dial 5–120 dk, keyboard +/-); zorunlu mola fazı kaldırıldı (mola = kullanıcı
  duraklatması); `preset: "custom"` + `study_sessions.planned_focus_minutes` column (migration 0016). *(0044.)*
- **Ghost (geçmiş-ben) + premium AI narration** — `domain/ghost.ts` pure comparison of latest vs OWN
  past (signed net deltas, personal record flag, i18n headline keys — no cross-user ranking §0);
  `GET /analysis` gains `ghost` (null until ≥2 attempts); `mock_exams` += AI cache columns. Premium
  AI narration owned by [AI](./ai.md). *(0049.)*
- **Hayal/Hedef Panosu (vision board)** — roadmap MVP feature: text-based single-goal anchor per
  user (goal + optional city + "neden"). `vision_boards` table (unique user); `VisionService`
  (`getMine`/`upsert`/`setAiNote`); idempotent upsert (mirrors mood). Premium AI note owned by
  [AI](./ai.md). `/hedef` edit page; card on `/panel` (no nav tab). *(0051.)*
- **Analiz redesign (3 mod)** — `/analiz` insight-first layout: özet band + `?tab=gir|gelisim|yanlislar`
  segmented control; Gir (tablo form, validation, toast, geçmiş listesi/drawer, kopyala); Gelişim
  (SVG sparkline, kişisel rekor gauge, ghost teaser/card, ders grid, koç seed link); Yanlışlarım
  (foto drag-drop/preview, sinyal barları). Skeleton: `analiz-content-skeleton.tsx`. CSS blob hero
  fallback. Phase 2: `mock_exams.publisher_name` + form alanları; `GET /analysis.personalRecordNet`.
  Plan: `docs/plans/2026-07-04-analiz-redesign-design.md`; P3 backlog:
  `docs/plans/2026-07-04-analiz-phase3-backlog.md`. *(2026-07-04.)*
- **Analiz sıradaki odak + Plan ön-doldurma (2026-07-10)** — `GET /v1/coaching/analysis`
  artık `nextFocus` döndürür: önce en sık fotoğraf ders sinyali, yoksa en düşük deneme ortalaması
  seçilir; karar backend'de, mesaj ve önerilen görev başlığı backend-i18n'den gelir. `/analiz`
  Gelişim sekmesi bu odağı tek CTA kartı olarak gösterir ve `/plan?add=1&subject=&title=` ile
  mevcut görev ekleme sheet'ini ön-doldurur; görev doğrudan kaydedilmez, kullanıcı onaylar. Fotoğraf
  hâlâ sadece ders kategorisi sinyalidir, çözüm/OCR/AI koç çağrısı yok. Dosyalar:
  `analysis-focus.ts`, `mock-exam.service.ts`, `analiz-next-focus-card.tsx`,
  `analysis-plan-prefill.ts`, `plan-shell.tsx`, `messages/{tr,en}.json`.

- **Eyleme dönüştüren sınav-kapsamlı analiz (2026-07-10)** — Analiz/geçmiş/ghost/rekor/foto
  sinyalleri opsiyonel `examId` ile aynı aktif sınava sınırlandı. Ders odağı artık ham net yerine
  `averageNet / questionCount` normalize yüzdesini kullanıyor ve `EARLY` / `REPEATED`
  kanıt seviyesini backend-localized mesajla döndürüyor. Web, masaüstünde trend+geçmiş-ben ve
  odak+rekor kolonlarını kullanıyor; geçmiş yayın adını ve ders bazlı normalize yüzdeleri gösteriyor.
  Yerel demo: `pnpm --filter @mentor/api seed:analysis-demo -- --email=<adres>` sekiz idempotent
  KPSS denemesi ve üç Türkçe foto sinyali ekler; production ortamında çalışmaz. Konu-seviyesi vision,
  OCR kapsam dışı. İlgili dosyalar: `mock-exam.service.ts`,
  `analysis-focus.ts`, `analiz-tab-gelisim.tsx`, `seed-analysis-demo.ts`.

- **Deneme düzenleme ve kalıcı silme (2026-07-11)** — Geçmiş deneme detay paneli yayın adı,
  tarih ve D/Y/B alanlarını düzenler; sınav kimliği sabittir ve bütün netler backend'de yeniden
  hesaplanır. `PUT /v1/mock-exams/:id` atomik olarak sonucu/dersleri yeniler, `DELETE` kayıtla
  birlikte ders ve fotoğraf sinyallerini kaldırır; iki işlem de sınav-kapsamlı ghost cache'ini
  temizler. Silme ortak onay dialog'undan sonra kalıcıdır; storage nesneleri mevcut
  `StoragePort` ile best-effort temizlenir. İlgili dosyalar: `mock-exam.service.ts`,
  `mock-exam.repository.ts`, `analiz-history-detail.tsx`.

## Gotchas / Known issues

- **Session history date filter is UTC** — `from`/`to` bound `started_at` to UTC calendar days
  (same day math as streak/`daily_activity`). Near midnight local time, "Bugün" may differ from the
  user's wall clock until per-user timezone is threaded.
- **Task-done toast streak** — panel `TodayPlan` PATCH does not return streak; after a DONE toggle,
  `PanelShell.refreshAfterTaskChange({ celebrateDone: true })` re-fetches `GET /coaching/today` and
  shows the success toast with the refreshed `streak.currentStreak` (never client-derived).
- **Plan delete chain** — bottom sheet `delete` action must not call API directly; always
  `confirm()` dialog first (same trust line as subscription cancel).
- **Past plan days are read-only** — `taskDate < today` blocks create/update/delete on the API
  (`COACHING_TASK_DATE_READONLY`); web hides add FAB, disables toggle/menu, shows a calm notice.
  Viewing past days (nav, datepicker, calendar dots) stays allowed.
- **Countdown date is authoritative content** — must come from `ContentService.getExamCalendar`,
  never `users.examDate`. `daysRemaining`/streak/completion are server-computed — never recompute on
  the client.
- **Study session status** enum is COMPLETED|ABANDONED (final outcome). A just-started session has
  `ended_at = null` and is NOT counted as activity until completed (the `has_session` query requires
  `ended_at` set).
- **Timer at 0 does not auto-finalize** — user must tap **Seansı bitir** (streak = conscious complete).
  `focusElapsed` pauses with the timer; does not increment after countdown hits 0.
- **Dial locked during active session** — only pause/complete/abandon; prevents accidental duration change.
- **`mock_exams.exam_id` is a SOFT ref** (no FK to content) — validated via ContentPort at write time.
  RLS on `mock_exams` + child policy on `mock_exam_subjects` (via EXISTS on parent).
- **Net never computed on FE** — display `totalNet` / trend values from API only. Trend UI = ProgressBar
  bars, not a chart library (DESIGN.md has no chart primitive).
- **AI cache invalidation** — mood/ghost/vision AI cache is invalidated only when the underlying
  value actually changes (`CASE … IS DISTINCT FROM` guard). Re-submitting the same mood or reloading
  never triggers a fresh LLM call.
- **Streak persistence is a snapshot/cache**; `current_streak` is always recomputed on read. Path to
  W5 = move `StreakService.getSummary` recompute behind `JobQueuePort` (nightly) — no hard dependency
  on the (unbound) queue adapter today.
- **DB-integration/e2e for coaching repositories was deferred** (pure unit tests cover the logic).
  Pre-existing e2e suites (`payments` on a dirty volume, `auth`/`health-down`) can show failures
  depending on local DB state; coaching specs are pure and DB-independent.
- **KVKK (conscious decision):** the existing `admin anonymize` only scrubs the `users` row; behavioral
  free-text like `mood_checkins.struggle_note` and `vision_boards.motivation` is **not** scrubbed. A
  holistic erasure step for all behavioral free-text is a W6/identity follow-up (tables are
  `onDelete: cascade`, so a real user delete cascades). See `modules/admin/infrastructure/admin-users.repository.ts`.
- **W2↔W3 seam:** mood reflection and ghost narration cross W2 (coaching domain logic) and W3 (AI LLM
  call). See [ai.md](./ai.md) for the AI side.

## Related

- Seam: [ai.md](./ai.md) (mood/ghost/vision AI), [content.md](./content.md) (countdown source, net rule),
  [identity.md](./identity.md) (`UsersService.getMe` for examType), [economy.md](./economy.md)
- Web: `/panel`, `/plan`, `/seans`, `/analiz`, `/hedef`
- Status: [core/mvp-status.md](../core/mvp-status.md) (W2)


- **Haftalık değerlendirme + tek odak (2026-07-11)** — `GET /v1/coaching/weekly-review?examId=`
  tamamlanan son Pazartesi–Pazar dönemini Europe/Istanbul sınırlarıyla özetler. Eşik: aynı sınavda
  1 deneme veya 2 tamamlanmış seans. Free çıktı yalnız kural tabanlıdır; denemeler normalize ders
  performansıyla önceki haftaya kıyaslanır, mood yalnız aggregate enerji sinyalidir (ham not yok).
  `/analiz?tab=gelisim` kartı ritim, deneme sinyali ve tek odağı gösterir. İlgili dosyalar:
  `weekly-review.service.ts`, `weekly-review.ts`, `analiz-weekly-review-card.tsx`.

