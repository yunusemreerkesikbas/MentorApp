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
setTodayAiReflection`, `MockExamService.setLatestGhostNarration`, `VisionService.setAiNote` and the
explicitly approved `PlanService.createFromAiCoach` / `SessionService.startFromAiCoach` public seams.
`CoachEvidenceService` is the only Mentor V2 read boundary and returns aggregates without raw task,
mood/session note, identity or forum text.

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
  "motivationalLine": "…", // rule-based, backend-localized (TR)
  "countdown": {
    // null if no examType / no calendar date (no silent fallback)
    "examType": "KPSS",
    "examName": "KPSS Lisans 2026",
    "daysRemaining": 184,
    "examDateLabel": "12 Temmuz 2026",
    "source": "ÖSYM",
    "sourceUrl": "https://www.osym.gov.tr",
  },
  "streak": { "currentStreak": 7, "longestStreak": 21, "freezeTokens": 2 },
  "tasks": [
    {
      "id": "…",
      "title": "…",
      "subject": "Türkçe",
      "status": "DONE",
      "sortOrder": 0,
      "taskDate": "2026-06-10",
    },
  ],
  "nextAction": {
    "kind": "START_TASK",
    "title": "Bugünün tek küçük adımı",
    "message": "Türkçe göreviyle sakin bir başlangıç yapabilirsin.",
    "taskId": "…",
  },
  "sessionPresets": [
    {
      "id": "25_5",
      "label": "25 / 5 dk",
      "focusMinutes": 25,
      "breakMinutes": 5,
    },
  ],
  "mood": null,
}
```

## API

| Endpoint                                                         | Purpose                                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /v1/coaching/today`                                         | Composite daily payload with localized `nextAction` and existing panel fields |
| `GET/POST /v1/plan-tasks` · `PATCH/DELETE /:id`                  | Plan-task CRUD; list by `date` **or** inclusive `from`/`to` range (week view) |
| `POST /v1/plan-tasks/bulk`                                       | User-confirmed batch add, max 21, all-or-nothing (accepted coach draft)       |
| `POST /v1/plan-tasks/adapt`                                      | Revision-guarded atomic MOVE + ADD for a user-confirmed coach preview         |
| `GET /v1/study-sessions`                                         | Paginated finalized-session history ("Son seanslar")                          |
| `POST /v1/study-sessions` · `PATCH /:id`                         | Pomodoro start / complete-abandon (recomputes `daily_activity`)               |
| `PATCH /v1/study-sessions/:id/feedback`                          | Post-session micro check-in (mood 1-3 + optional note → AI signal)            |
| `POST /v1/mock-exams` · `GET /:id` · `GET /v1/coaching/analysis` | Mock-exam entry + personal trend + ghost                                      |
| `POST/GET /v1/coaching/mood-checkins`                            | Mood check-in (upsert today) + trend                                          |
| `GET/POST /v1/coaching/vision`                                   | Vision board (idempotent upsert, single row per user)                         |

## Geliştirmeler (timeline)

- **Streak rescue success Puhu video sheet (2026-08-10)** — Daily streak celebration keeps the
  flame hero. After a successful coin streak rescue, `/panel` opens a one-shot sheet:
  full-bleed square looping video, bottom 40px clipped (draft watermark), celebration-style
  days badge (top-left), title + reassurance overlaid on a soft scrim, streak-soft rim/glow,
  top-right ×; dismiss via × / backdrop / Escape (no primary CTA). Asset:
  `public/video/character/puhu-streak-kept.mp4` (muted, autoplay, loop; reduced-motion /
  error → `PuhuImage` happy). Opens after successful coin rescue (toast removed for that
  path). QA: `/panel?mockStreakRescueSuccess=1` (or a day count). Related:
  `streak-rescue-success.tsx`, `panel-shell.tsx`.

- **Hedef panosu Canva-style editör chrome (2026-08-06)** — `/hedef/pano` far-left kategori
  rail (Görsel / Metin / Çıkartma / Şablon / Pano) + collapsible detay paneli + seçim üst
  contextual toolbar (+ renk paneli). App nav bu rotada gizlenir (community workspace ile aynı
  full-bleed pattern). Yalnız mevcut Mentor özellikleri yeniden yerleştirildi; çizim/Araçlar
  drill-down yok. Escape önce renk panelini, sonra detayı kapatır. **Motion (framer-motion):**
  kategori aktif pill `layoutId`, detay paneli slide+fade, panel içeriği `mode="wait"` crossfade,
  contextual toolbar enter/exit (y + opacity); hepsi DESIGN.md chrome 150–250ms +
  `useReducedMotion` (opacity-only). Kullanım: kategoriye tıkla → detay açılır; öğe seç → üst
  quick actions; renk swatch → sol renk paneli. Gotcha: `/vision-board` (harita) app nav’ı
  göstermeye devam eder — yalnız `/vision-board/board`. İlgili: `layout.tsx`,
  `board-editor-shell.tsx`, `board-side-panel.tsx`, `board-context-toolbar.tsx`,
  `board-color-panel.tsx`, `board-chrome-motion.ts`, `board-palettes.ts`, `messages/{tr,en}.json`.

- **Desktop coach FAB drag (2026-08-05)** — Fixed bottom-right Puhu entry can be press-dragged
  anywhere in the viewport (clamped to a 24px edge pad). Short click still opens `/coach`;
  position persists for the browser session via `sessionStorage`. Bounce pauses while dragging.
  Related: `desktop-coach-fab.tsx`.

- **Kişiselleştirilmiş Mentor V2 — coaching kanıtı ve aksiyon döngüsü (2026-08-02)** — Public
  `CoachEvidenceService`; bugünkü plan/odak, 7–28 günlük ritim, streak, kaba mood yönü, deneme odağı,
  normalize hedef ve AI görev sonuçlarını taksonomi-doğrulanmış, PII-minimal özetlere çevirir. Ham
  görev başlığı ve serbest notlar sınırı geçmez. Kullanıcının onayladığı görev `AI_COACH` origin'i ve
  koç mesajı referansıyla idempotent oluşturulur; bekleyen AI görevi için seans yine W2 üzerinden
  başlar. Nitelikli seans görevi tamamlayınca `PlanTaskCompleted` event'i AI aksiyonunu `COMPLETED`
  yapar. Süreli zorluk/öncelik hafızası kullanıcı tarafından düzenlense de yeni TTL alır; dolmuş
  öğeler bakım işini beklerken bile prompt ve yönetim listesinden çıkar. Kanıt metinleri enum ve
  boş durumları backend'de lokalize eder; eksik hedefi `0` gibi göstermemelidir. Migration:
  `0068`–`0070`. Kullanım: koçtaki aksiyonu onayla; görev normal plan/seans
  yaşam döngüsüne girer. Gotcha: onaysız hiçbir plan/seans yazımı yoktur. İlgili:
  `coach-evidence.service.ts`, `plan.service.ts`, `session.service.ts`, `coaching.events.ts`.

- **Vision board map polish + motion (2026-08-01)** — Harita paleti chip-morundan gri
  tonlara alındı; seçili il accent mavi, hover bir ton koyu gri (seçili hover biraz
  koyulaşır). Pin'ler klasik kırmızı location marker (`--map-pin`) ve daha büyük
  (`PIN_SCALE` 0.95). Şehir seçiminde Framer Motion ile `viewBox` zoom-in (~480ms,
  ease-out); wheel/pan anlık kalır. Sidebar/form stagger enter; back yalnızca mobilde
  ikon (`ArrowLeft`). Aynı ile tekrar tıklayınca unselect + zoom-out; zoom'dayken
  komşu ile tıklanabilir (pan yalnız 6px eşiği sonrası — erken `setPointerCapture`
  click'i yutuyordu). **Gotcha:** `.mentor-tr-map path` ili stillerini pin
  `<path>`'lerine de uyguluyordu — gri fill kırmızıyı eziyordu; seçici
  `.mentor-tr-map > path` olmalı. Hover kartı pin→card geçişinde 140ms grace +
  kart üzerinde `pointer-events` ile kapanıyor. Sol panel viewport yüksekliğine
  kilitli (`h-[100dvh-header]` + `overflow-y-auto`); uzun program listesi
  haritayı uzatmıyor.   Program satırları chip-mor arka plansız; dropdown gibi
  `hover:bg-black/4`, ad + sakin meta (puan türü · kontenjan · taban). Tek arama
  alanı: üniversite açıkken yerel bölüm filtresi (ikinci bar yok); geri yalnız
  `ArrowLeft` ikon.   Hover kart tıklanınca pin ile aynı sidebar detayı açılır;
  üniversite adının altında şehir (harita üzeri il etiketi değil). Sidebar
  arama satırı hover → haritada `data-preview` il highlight; tıklayınca şehir
  active + pin spotlight hover card + kampüs paneli.   Üniversite arama hit'inde
  `cityCode`/`cityName` API'den gelir (`UniversitySearchHitDto`) — FE geo grafiğini
  tersine aramaz (mobil hazırlığı). Geo arama aktifken harita pin'leri sonuçlara
  göre filtrelenir: şehir hit → o ildeki tüm kampüsler; üniversite/bölüm hit →
  yalnızca ilgili kampüsler; arama bitince tüm pin'ler geri gelir.   YKS haritasında
  sağ altta ÖSYM kaynak notu + YKS kılavuz linki (OSM attribution solda kalır).
  Pin tıklanınca hover card spotlight/`active` kalır (arama focus ile aynı).
  Mobil pin ölçeği `1.35` (desktop `0.95`); zoom’da `unit^0.35` ile büyür
  (eskiden `unit^1` → ekranda sabit / yakınlaşınca cılız kalıyordu).
  Pin konumu her zaman gerçek koordinat — spiderfy/offset yok (kaymış pin yanlış şehir
  gibi okunuyordu).
  **Mobil layout:** harita birincil; hedef formu + `MapBrowser` sol
  `HistorySideDrawer` içinde (kapalı başlar, PanelLeft / pin / şehir seçince açılır).
  Form `headerActions`'ta (scroll dışında) — `MenuSelect` overflow ile kırpılmasın diye.
  Desktop `lg+` rail + üst form aynı. Related:
  `globals.css` (`.mentor-tr-map`), `use-map-viewport.ts`, `map-canvas.tsx`,
  `university-hover-card.tsx`, `map-browser.tsx`, `search-pin-filter.ts`,
  `vision-board-shell.tsx`, [content.md](./content.md) (geo search).

- **Vision board form + shared PopoverMenu (2026-08-01)** — Hedef formunda native
  `<select>` yerine Plan görev menüsüyle aynı floating panel (`PopoverMenu` /
  `MenuSelect`): yumuşak kart gölgesi, radius token, selected state. Hedef input
  max ~18rem (artık flex ile tüm satırı kaplamıyor); Kaydet alanı input yüksekliğine
  hizalı (`min-h-11`) ve `busy` spinner kullanıyor. `PlanTaskMenu` ve `ThreadMenu`
  aynı shared panele geçti. Related: `popover-menu.tsx`, `menu-select.tsx`,
  `vision-board-shell.tsx`, `plan-task-menu.tsx`, `thread-menu.tsx`.

- **Topluluk → Koç → Plan → Topluluk dönüş döngüsü (2026-08-01)** — `plan_tasks`, forward-only
  `0065` ile nullable `origin_type/ref_id/meta` alanlarını aldı. `COMMUNITY_COACH` görevleri
  conversation, thread, intent ve CHAT/QA türünü yapısal olarak saklar; modüller arası FK yoktur.
  Normal/legacy görevler `origin=null` döner; düzenleme, tarih taşıma ve durum değişimi origin'i
  korur. Web'de görev oluşturulduğu andan itibaren topluluk kaynak işareti görünür; yalnız başarılı
  `PENDING→DONE` API yanıtı reload'da tekrarlanmayan, kapatılabilir paylaşım şeridini açar. Kaynak
  açılmadan önce bridge uygunluğu yeniden kontrol edilir. İlgili: `plan.service.ts`,
  `coaching.mappers.ts`, `plan-shell.tsx`, `plan-task-row.tsx`,
  `0065_clumsy_white_tiger.sql`, `packages/types/src/coaching.ts`.
- **Desktop coach FAB (2026-07-30)** — Desktop (`lg+`) removes Koç from the sidebar and
  shows a fixed bottom-right Puhu bubble (`DesktopCoachFab`) linking to `/coach`. Optional
  dismissible nudge uses `sessionStorage` for the session. Hidden on `/coach*` routes.
  Mobile keeps the elevated center tab FAB; no floating bubble. Related:
  `desktop-coach-fab.tsx`, `app-nav.tsx`, `globals.css` (`.mentor-coach-bubble--end`),
  `messages/{tr,en}.json`, `DESIGN.md` §6.

- **Mood check-in modal cleanup (2026-07-29)** — Dropped subtitle; shortened wheel hint to one
  sentence; removed tick-dial arc + pink needle (faces + label carry selection); primary + “Daha sonra”
  stacked inside the picker (dialog `actions` empty). Related: `mood-wheel-picker.tsx`,
  `mood-checkin.tsx`, `messages/{tr,en}.json`.

- **Mood wheel touch scale (2026-07-29)** — Center face 128px / stage 220px; dialog mobile
  `max-w` 335→360. Needle kept under center in `color-main`. Related: `mood-wheel-picker.tsx`,
  `dialog-panel.tsx`, `dialog-viewport.tsx`.

- **Mood wheel generic 3D emoji assets (2026-07-29)** — Check-in wheel uses `/img/{draining,low,balanced,good}.jpg`
  instead of Puhu. Labels: Yorucu / Durgun / Dengeli / İyi / Harika (EN: Draining / Low / Balanced / Good / Great).
  Mood 5 temporarily reuses `good.jpg` until `great` arrives. Related: `mood-assets.ts`,
  `mood-wheel-picker.tsx`, `mood-checkin.tsx`, `messages/{tr,en}.json`.

- **Plan Timeline tab enter (2026-07-25)** — Liste→Timeline no longer flashes week-start then
  jumps to today: spacer + `scrollTop` pin run in one `useLayoutEffect` before paint; content
  stays hidden under an embedded skeleton until ready; shell motion for timeline is opacity-only
  (no `y` slide). Related: `plan-timeline-view.tsx`, `plan-shell.tsx`, `plan-content-skeleton.tsx`.

- **Plan add-task sheet skeletons (2026-07-25)** — While exam subject taxonomy loads, the
  “Yeni görev” sheet shows a title-field skeleton + pill chip skeletons (reserved height) so the
  modal does not jump when chips arrive. `useExamSubjectTaxonomy` caches one in-flight/result for
  plan + session pickers. Related: `plan-add-task-form.tsx`, `subject-picker.tsx`,
  `use-exam-subject-taxonomy.ts`.

- **Plan Timeline weekly chronology (2026-07-25)** — Timeline shows the selected week’s 7 days
  (Mon→Sun) as a vertical rail + day sections (`PlanTaskRow`, pending then done). Opens aligned to
  **today** (scroll up → past days, down → future). Sticky rail badge = day + short month
  (`formatMonthDayShort`); rail fill grows/shrinks with scroll. Week strip stays in sync via
  scroll + taps. Empty days: `plan.timeline_day_empty`. Shell: `weekTasks` / `weekLoading`,
  `contentKey` = `timeline-{weekAnchor}`. Past days read-only per `taskDate`. Related:
  `plan-timeline-view.tsx`, `plan-shell.tsx`, `plan-content-skeleton.tsx`, messages,
  `docs/plans/2026-07-25-plan-page-ui-redesign.md`.

- **Analiz history edit in bottom sheet (2026-07-26)** — Accordion stays read-only; **Düzenle** opens
  `AnalysisHistoryEditSheet` via Mentor bottom sheet (full D/Y/B form). Save refreshes detail + list.
  Related: `analysis-history-edit-sheet.tsx`, `analysis-history-detail.tsx`.

- **Analiz history detail redesign (2026-07-26)** — Accordion panel: white well, compact subject
  table (Ders / D / Y / B / Net), neutral **Koçla konuş**, pill **Düzenle** / **Sil**. Related:
  `analysis-history-detail.tsx`.

- **Analiz history accordion polish (2026-07-26)** — Row chevron + height/opacity expand animation
  (`prefers-reduced-motion` respected). **Son denemeyi kopyala** moved from the history rail to the
  Gir form header (`SectionHeading` action) — fetches latest mock exam on click. Related:
  `analysis-history-list.tsx`, `analysis-tab-entry.tsx`, `analysis-history-detail.tsx`.

- **Analiz history accordion (2026-07-26)** — Geçmiş denemeler rail/drawer opens detail **inline**
  under the clicked row (`aria-expanded` / single-open). Overlay “Deneme detayı” stack removed for
  this surface; edit/delete/coach stay in the accordion panel. Related:
  `analysis-history-list.tsx`, `analysis-history-detail.tsx` (`variant="accordion"`).

- **Analiz metric banner polish (2026-07-26)** — **Son net** KPI card: uppercase label, large net,
  minimal inline delta (`↗ +6.00`), `ghost.headline` caption, filled sparkline from last ≤6
  attempts. Banner CTA removed (entry via **Gir**). Duplicate “Son denemeler” table removed — same
  data lives in the history rail. Related: `analysis-summary-band.tsx`, `analysis-sparkline.tsx`,
  e2e + `messages/{tr,en}.json`.

- **Analiz UI chrome redesign (2026-07-25)** — `/analiz` drops the page title/subtitle; **Son net**
  becomes a metric banner (large value, delta chip, sparkline, CTA). **Geçmiş denemeler** moves to a
  page-level left history rail on all tabs (Koç-style: collapsible desktop rail + mobile drawer).
  Gir/Gelişim/Yanlışlarım uses the shared Plan-style pill segment (`SegmentPillControl`). Shared
  chrome: `apps/web/src/components/segment-pill-control.tsx`,
  `apps/web/src/components/history-side-panel/*`. Usage: open `/analiz` — history stays visible while
  switching tabs; mobile opens history via the top-left control. Gotcha: history list mounts in the
  rail (and again in the drawer when opened on mobile). Related: `analysis-shell.tsx`,
  `analysis-summary-band.tsx`, `analysis-history-list.tsx`, `analysis-segment-control.tsx`,
  `plan-calendar-header.tsx`, `messages/{tr,en}.json`.

- **Plan task overflow dropdown + edit (2026-07-25)** — Task ⋯ opens an anchored dropdown (not
  action-sheet): **Görevi düzenle** + **Sil**. Toggle complete stays on the checkbox only. Edit
  reuses the add form sheet + existing `PATCH /v1/plan-tasks/:id` (`title`/`subject`) — no new
  backend. Related: `plan-task-menu.tsx`, `plan-task-row.tsx`, `plan-shell.tsx`, messages.

- **Plan page chrome redesign (2026-07-25)** — `/plan` tabs become a capsule segmented control with
  Framer `layoutId` pill motion; Liste/Timeline date nav uses the shared week strip (today bold,
  selected-day soft `progress` circle via `layoutId`, dots only on planned days). CTA hierarchy:
  **Görev ekle** → `Button` `accent`, **Koçla planla** → compact `soft`. Week tasks load for all
  views so strip dots stay accurate. Reduced-motion skips layout/slide animations. Usage: open
  `/plan`. Related: `plan-view-switcher.tsx`, `plan-week-strip.tsx`, `plan-date-nav.tsx`,
  `plan-shell.tsx`, `plan-coach-adaptation-action.tsx`, `packages/ui` `Button` variants,
  `docs/plans/2026-07-25-plan-page-ui-redesign.md`.

- **Streak celebration week row (2026-07-25)** — Celebration sheet week starts on the first lit
  streak day (left) through today, then future ghosts; lights leading `min(streak, 7)` slots
  (2-day → yesterday + today on the left). Title still shows the full count (e.g. “15 günlük seri”).
  Helpers: `celebrationWeekIsos` / `isCelebrationDayLit` in `streak-celebration.ts`
  (+ `streak-celebration-week.spec.ts`).

- **Streak celebration popup (2026-07-24)** — Once per local calendar day, when the first counting
  effort credits the streak (plan task → DONE **or** a valid finalized focus session), `/panel` and
  session-done open a bottom-sheet celebration: Habitify-style **curved-triangle peak** (`clipPath`),
  animated `public/img/fire-anime.svg` hero (static `flame.png` under reduced motion) with sparkles /
  spring entrance, “N günlük seri”, today-forward week row (staggered), CTA **Devam edeceğim!**.
  Gate: `localStorage` key `mentor_streak_celebrated:YYYY-MM-DD` via `claimStreakCelebrationToday`.
  QA: `?mockStreakCelebration=7`. Calm session streak pills stay. Usage: mark a task DONE on
  `/panel` or `/plan` (today), or finish a counting session when streak was not yet credited today.
  Related: `streak-celebration.ts`, `streak-celebration.tsx`, `panel-shell.tsx`, `plan-shell.tsx`,
  `session-done-state.tsx`.

- **Streak week flames on DailyRhythmCard (2026-07-23)** — 7-day flame row moved from the quest
  banner into **Bugünkü ritim** (`DailyRhythmCard`); standalone quest promo removed — daily quests
  sit as a compact **RitualQuestStrip** inside **Bugünkü ritüel** (`TodayFocusCard`, opens quests
  sheet). Standalone
  **Günlük seri** card (freeze/rescue) removed from `/panel` — streak lives only in the rhythm
  row. Free monthly freezes still apply automatically with no panel chrome. When the free pool
  is exhausted and a single gap is buyable, `/panel` opens a one-shot Puhu promo dialog
  (per break-day via `sessionStorage`): afford → confirm coin rescue; insufficient →
  “Coin’in yetmiyor” + **Görevlere bak** (quests sheet) / Tamam. Flame row is **today + next
  6 days** (today leftmost, forward); future cells are ghost flames; today lit from
  `currentStreak`. Labels via `formatWeekdayShort`. Flames use wells/rings from
  `public/img/flame.png`. Usage: open `/panel`. Related: `panel-shell.tsx`, `theme.css`,
  `DESIGN.md`.

- **Daily continuity loop and weekly action (2026-07-22)** — Dashboard and coach hub now render the
  same data-only `CoachNextActionCard` from the existing `GET /v1/coaching/today` response. Dashboard
  reuses its loaded payload; coach keeps its single fetch. `START_TASK` preserves a typed
  `dashboard|coach` source, `ADD_TASK` opens the existing plan form, and `DAY_COMPLETE` adds no work.
  Content-free impression/click/session-start events include only surface/action/source. The public
  `SessionService` also exposes the seven-UTC-day session repeat aggregate from
  `daily_activity.has_session`: active users studied on at least one distinct day, repeat users on
  at least two, and a zero denominator returns `0`. Weekly READY reviews now include a localized
  `suggestedTask`; weekly and deep-analysis cards prefill `/plan?add=1` without persisting until the
  user confirms. Related: `coach-next-action-card.tsx`, dashboard/coach/study-session shells,
  `daily-activity.repository.ts`, `session.service.ts`, `weekly-review.service.ts`, analysis cards.

- **Koçla planla: atomik ve kullanıcı onaylı uyarlama (2026-07-21)** — Plan ekranındaki tek
  “Koçla planla” aksiyonu, boş planda `ADD`, dolu planda güvenli `MOVE` + `ADD` önerilerini
  aynı sheet'te tarihe göre gruplar; her değişiklik ayrı seçilir ve taşımalarda eski/yeni tarih
  gösterilir. Free kullanıcı tıklamada AI isteği yapılmadan aboneliğe gider. Mood 1–2 ve kaydedilmiş
  seans mood 1 girişleri yalnız `/plan?coach=adapt&source=...` bağlantısı üretir; query StrictMode
  altında bir kez tüketilip temizlenir. `POST /v1/plan-tasks/adapt`, bugün + 6 günlük snapshot'ın
  görev kimliği/tarih/durum/içerik/sıra/`updatedAt` alanlarından üretilen opaque
  `planRevision` değerini transaction içinde yeniden hesaplar. Plan CRUD/bulk, adaptation apply,
  seans auto-complete ve KVKK scrub aynı kullanıcı bazlı transaction advisory lock'ını paylaşır;
  revision kontrolü
  ile mutation arasına eşzamanlı plan değişikliği giremez. Tamamlanmış görev, sahiplik,
  kaynak/hedef tarih, tekrar ve günlük kapasite yeniden doğrulanır; tüm MOVE + ADD seçimi ya birlikte
  uygulanır ya tamamen rollback olur. Taşınan/eklenen görevler hedef günün son sırasına eklenir.
  `COACHING_PLAN_CHANGED` (`409`) sonrası plan yenilenir fakat yeni LLM çağrısı otomatik
  yapılmaz; kullanıcı “Yeniden hazırla”yı seçer. Diğer apply hataları önizleme ve checkbox seçimini
  korur. Analytics yalnız `source`, `move_count`, `add_count` taşır ve consent yoksa dataLayer'a
  yazmaz. Eski bulk + plan-draft akışı geriye uyumluluk için korunur. İlgili dosyalar:
  `plan-adaptation.ts`, `plan.service.ts`, `plan-task.controller.ts`,
  `plan-coach-adaptation-action.tsx`, `plan-shell.tsx`, `panel-shell.tsx`,
  `study-session-shell.tsx`.

- **Bugünün tek küçük adımı (2026-07-20)** — `GET /v1/coaching/today` artık zorunlu, backend-
  localized `nextAction` döner: sıralı ilk `PENDING` görev `START_TASK`, görev yoksa `ADD_TASK`, tüm
  görevler bittiyse baskısız `DAY_COMPLETE`. Mood 1–2 seçim yapılan görevi değiştirmez; yalnız mesajı
  yumuşatır. Streak, analiz ve focus goal bu ilk sürümde önceliğe katılmaz. `/coach` kartı görevi
  mevcut `/study-session` deep-link'ine (`source=coach`) taşır, boş planda `/plan?add=1&source=coach`
  açar; görev oluşturma/değiştirme otomatik değildir. Seans backend'de başarıyla başladıktan sonra
  consent-gated `coach_session_start` ölçülür. Usage: free veya chat limiti dolmuş kullanıcı da koç
  merkezinde günlük adımı görür; yalnız `/coach/chat` access gate altında kalır. Related:
  `today.service.ts`, `coach-hub-brief.tsx`, `plan-study-session-link.ts`, `study-session-shell.tsx`.

- **English coaching source naming and localized routes (2026-07-19)** — Internal folders, files, and
  symbols now use `analysis`, `study-session`, and `vision-board`; Turkish public paths remain
  `/analiz`, `/seans`, and `/hedef`. Analysis query tabs are locale-independent
  `entry|progress|mistakes`. Related: `mock-exams.ts`, `analysis-*`,
  `plan-study-session-link.ts`, `study-session-shell.tsx`, `vision-board-shell.tsx`.
- **Coin ile streak kurtarma — satın alınmış freeze (2026-07-18)** — Yeni `streak_freezes` tablosu
  (unique `user_id+date`, RLS self-or-service, migration `0054`): coin ile satın alınan dondurma
  günleri kalıcı kayıt. `deriveStreak` 4. parametre `purchasedFrozenDates` aldı — satın alınmış gün
  koşulsuz köprülenir, aylık ücretsiz hakkı TÜKETMEZ, ay sınırından etkilenmez; `getSummary`'deki
  `usedThisMonth` sayacı satın alınmış köprüleri hariç tutar. `deriveStreak` ayrıca `stoppedAt`
  (walk'ın koptuğu gün) döndürür — walk en yeni boşlukları önce köprülediğinden havuz tükenmesi
  en eski bu-ay boşluğunda kopar; rescue hedefi bu gündür. Yeni public boundary:
  `getFreezeRescueState` (kopma günü tek boşluksa uygun; 2+ gün boşluk asla) +
  `applyPurchasedFreeze` (doğrula → insert → snapshot tazele). Satın alma orkestrasyonu economy'de
  (`StreakRescueService`) — coaching economy'yi ÇAĞIRMAZ (yön korunur). Rescue sonrası snapshot
  tazelenirken milestone yeniden emit olabilir: quest `once`-idempotent, bildirim günlük dedupe —
  kabul edilen edge.
- **Analiz yayın sertleştirme (2026-07-16)** — `/analiz` kritik UI sözleşmeleri mobil
  (375×812) ve masaüstü (1280×800) Chromium projelerinde deterministik Playwright smoke testleriyle
  korunur. Testler auth ve Analiz API cevaplarını `@mentor/types` tabanlı fixture ile mock'lar;
  backend doğruluğu gerçek Postgres kullanan mevcut coaching e2e testlerinde kalır. Kullanım:
  `pnpm --filter @mentor/web test:e2e`. Gotcha: Playwright yalnız UI sınırını doğrular ve beklenmeyen
  coaching/mock-exam/coach/plan isteğini başarısız sayar. İlgili dosyalar:
  `apps/web/e2e/analiz.{fixture,spec}.ts`, `apps/web/playwright.config.ts`, `.github/workflows/ci.yml`.
- **Yayın kapısı backend test stabilizasyonu (2026-07-16)** — Vitest API/e2e koşuları yerel `.env`
  sağlayıcılarından ayrıştırıldı (`fake` LLM/vision), takvime bağlı KPSS content e2e saati sabitlendi,
  RAG testi kendi makale/job artıklarını temizler ve DB-down health testi yalnız gerçek health+database
  modüllerini başlatır. Kullanım: `pnpm --filter @mentor/api test`; production API davranışı değişmez.

- **Panel (Anasayfa) UI** — `/panel` Server Component: greeting, calm countdown (blue, no alarm-red),
  streak badge (anti-shaming), today's plan list, start-session CTA, mood check-in. Six `@mentor/ui`
  primitives (`SectionHeading`, `DataCard`, `CountdownCard`, `StreakBadge`, `PlanListItem`,
  `MoodPicker`). `PanelShell` loads `GET /v1/coaching/today` client-side (token in memory). _(0013.)_
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
  seam bound to W1 adapter. Shared contracts in `@mentor/types`/`@mentor/validation`. _(0014.)_
- **Plan + Seans UI** — `/plan` full CRUD (list by date, create, toggle, delete); `/seans` Pomodoro
  (preset select, client timer, `POST/PATCH study-sessions` finalize). Manual URL for `?date=` until
  OpenAPI exposes the query param; `useSearchParams` wrapped in `<Suspense>`. _(0021.)_
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
  yazıldığı için check-in **ayrı** `PATCH /v1/study-sessions/:id/feedback` ile finalize _sonrası_
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
- **Plan Timeline UX** — (superseded 2026-07-25 by weekly chronology above). Earlier: single-day
  rail + scroll-after-4-cards. `PlanProgress` still uses `scaleX` fill animation (reduced-motion
  safe).
- **Mock exam + analysis** — `subjects`/`exam_subjects` seed + KPSS taxonomy endpoint; `mock_exams`/
  `mock_exam_subjects`; `domain/net.ts` (KPSS penalty rule); `/analiz` UI (per-subject D/Y/Boş,
  ProgressBar trend — no chart lib). _(0022-w2.)_
- **Panel UI polish** — shared `stagger-motion.ts`; `PanelShell` header fade + grid stagger;
  `CountdownPlaceholder` (CTA → `/profil` when `examType` missing; editorial-gap message when type
  set but no calendar seed); `StartSessionCta` extracted (Link-as-button, valid HTML). _(0033.)_
- **Plan + Seans UI polish** — `PlanShell`/`SeansShell` motion + `AnimatePresence` phase transitions
  (idle → focus/break → done); `SectionHeading` preset picker; eslint-safe fetch (`active` flag). _(0037.)_
- **Analiz UI polish** — `AnalizShell` `LoadState` union (separates `needs_exam_type` from API
  errors); always-visible trend card with chip empty state; tabular nums; calm subtitle (no ranking). _(0038.)_
- **Seans circular timer + custom duration** — `CircularTimerRing` in `@mentor/ui` (SVG progress
  ring, drag/touch dial 5–120 dk, keyboard +/-); zorunlu mola fazı kaldırıldı (mola = kullanıcı
  duraklatması); `preset: "custom"` + `study_sessions.planned_focus_minutes` column (migration 0016). _(0044.)_
- **Ghost (geçmiş-ben) + premium AI narration** — `domain/ghost.ts` pure comparison of latest vs OWN
  past (signed net deltas, personal record flag, i18n headline keys — no cross-user ranking §0);
  `GET /analysis` gains `ghost` (null until ≥2 attempts); `mock_exams` += AI cache columns. Premium
  AI narration owned by [AI](./ai.md). _(0049.)_
- **Hayal/Hedef Panosu (vision board)** — roadmap MVP feature: text-based single-goal anchor per
  user (goal + optional city + "neden"). `vision_boards` table (unique user); `VisionService`
  (`getMine`/`upsert`/`setAiNote`); idempotent upsert (mirrors mood). Premium AI note owned by
  [AI](./ai.md). `/hedef` edit page; card on `/panel` (no nav tab). _(0051.)_
- **Analiz redesign (3 mod)** — `/analiz` insight-first layout: özet band + `?tab=gir|gelisim|yanlislar`
  segmented control; Gir (tablo form, validation, toast, geçmiş listesi/drawer, kopyala); Gelişim
  (SVG sparkline, kişisel rekor gauge, ghost teaser/card, ders grid, koç seed link); Yanlışlarım
  (foto drag-drop/preview, sinyal barları). Skeleton: `analiz-content-skeleton.tsx`. CSS blob hero
  fallback. Phase 2: `mock_exams.publisher_name` + form alanları; `GET /analysis.personalRecordNet`.
  Plan: `docs/plans/2026-07-04-analiz-redesign-design.md`; P3 backlog:
  `docs/plans/2026-07-04-analiz-phase3-backlog.md`. _(2026-07-04.)_
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
  KPSS denemesi ve son dört denemeye bağlı altı foto sinyali (3 Türkçe, 2 Matematik, 1 Tarih) ekler; production ortamında çalışmaz. Konu-seviyesi vision,
  OCR kapsam dışı. İlgili dosyalar: `mock-exam.service.ts`,
  `analysis-focus.ts`, `analiz-tab-gelisim.tsx`, `seed-analysis-demo.ts`.

- **Eyleme dönük üç sekme + son dört deneme odağı (2026-07-13)** — /analiz akışı Gir →
  Gelişim → Yanlışlarım olarak sadeleştirildi. GET /v1/coaching/analysis?examId= odağı yalnız aktif
  sınavın son dört denemesinden seçer; aynı dört kimliğe bağlı foto sinyalleri önceliklidir, yoksa en
  düşük normalize ders ortalaması kullanılır. nextFocus artık en yeni→eski en fazla dört ders neti,
  son fark, yön ve backend-localized sakin mesaj döndürür. Gir formunun fieldset/legend grid kayması
  giderildi, satır içi soru aşımı ve yükleme durumu olan taranabilir geçmiş listesi eklendi. Gelişim
  odağı birincil karttır; Plan CTA yalnız formu ön-doldurur. Yanlışlarım güven metni ile deneme/erişim/
  limit/yükleme/hata/sinyal-yok durumlarını aksiyona bağlar. Demo seed 8 deneme + 6 son-dört foto
  sinyali doğrular; yeni tablo, migration, endpoint veya chart bağımlılığı yoktur. Kullanım:
  pnpm --filter @mentor/api seed:analysis-demo -- --email=<adres>. Gotcha: genel trend/rekor/ghost ve
  tüm-geçmiş ders ortalamaları eski kapsamlarını korur; yalnız odak ve foto sinyalleri son dört
  denemeliktir. Dosyalar: analysis-focus.ts, mock-exam.service.ts, seed-analysis-demo.ts,
  analiz form/card/list bileşenleri ve messages/{tr,en}.json.
- **Deneme düzenleme ve kalıcı silme (2026-07-11)** — Geçmiş deneme detay paneli yayın adı,
  tarih ve D/Y/B alanlarını düzenler; sınav kimliği sabittir ve bütün netler backend'de yeniden
  hesaplanır. `PUT /v1/mock-exams/:id` atomik olarak sonucu/dersleri yeniler, `DELETE` kayıtla
  birlikte ders ve fotoğraf sinyallerini kaldırır; iki işlem de sınav-kapsamlı ghost cache'ini
  temizler. Silme ortak onay dialog'undan sonra kalıcıdır; storage nesneleri mevcut
  `StoragePort` ile best-effort temizlenir. İlgili dosyalar: `mock-exam.service.ts`,
  `mock-exam.repository.ts`, `analiz-history-detail.tsx`.

- **KVKK bütünsel silme — coaching tarafı (2026-07-14)** — `admin anonymize` artık coaching'in tüm
  davranışsal serbest metnini de siliyor. Yeni `CoachingErasureService` + `CoachingErasureRepository`
  (tek SERVICE-ctx tx → atomik): `vision_boards` satırı silinir; `mood_checkins`/`study_sessions`
  `struggle_note`+`ai_reflection` → null; `mock_exams.ai_ghost_narration` → null; `plan_tasks.title`
  → `"Silinmiş görev"` (NOT NULL); foto kategorizasyon satırları **ve storage objeleri** silinir
  (best-effort `Promise.allSettled`, `mock-exam.service` deseni). **Sayısal veriler korunur** (netler,
  seans süreleri, streak, quest). `CoachingModule` servisi export eder; `AdminModule` onu import edip
  çağırır (admin W2 tablolarına yazmaz). Seam: [ai.md](./ai.md). Dosyalar:
  `coaching-erasure.service.ts`(+spec), `coaching-erasure.repository.ts`, `coaching.module.ts`.

- **Plan görevlerinde toplu ekleme — koç taslağının W2 ayağı (2026-07-16)** —
  `POST /v1/plan-tasks/bulk` (`{ tasks: [...] }`, mevcut `createPlanTaskSchema` reuse, min 1 /
  max 21): `PlanService.createMany` önce TÜM tarihleri `assertTaskDateMutable` ile doğrular
  (geçmiş gün → 403 `COACHING_TASK_DATE_READONLY`, hiçbiri yazılmaz), sonra tek RLS tx'te ekler.
  Premium gate yok — elle tek tek eklemenin toplu eşdeğeri; W3 koç plan taslağının (bkz. ai.md)
  kullanıcı-onaylı kayıt ayağı. **AI bu endpoint'i çağırmaz** — FE, kullanıcı önizlemede
  onayladıktan sonra kullanıcı token'ıyla çağırır (workstreams §2). Migration yok. Dosyalar:
  `plan.service.ts`(+spec), `plan-task.controller.ts`, `coaching.dto.ts`,
  `packages/validation/coaching.ts`, `coaching.e2e-spec.ts`.

- **Koç taslağı → kullanıcı-onaylı plan (2026-07-16)** — `/plan` önizlemesi koç taslağını günlere
  ayırır, tüm görevleri varsayılan seçer ve kullanıcının çıkardıkları dışında kalanları tek
  `POST /v1/plan-tasks/bulk` çağrısıyla ekler. Dönen görevler mevcut Plan state'ine append edilir;
  refetch ve otomatik görünüm/tarih değişimi yoktur. Free kullanıcı taslak çağrısı yapılmadan
  `/abonelik` sayfasına gider. Gotcha: tekrar oluşturulan taslaklar bilinçli olarak dedupe edilmez.
  Dosyalar: `plan-coach-draft-action.tsx`, `plan-shell.tsx`, `plan-tasks.ts`.

- **Deneme Analizi UI cilası: takvim, boş durumlar, chart altyapısı (2026-08-11)** — beş parçalı
  redesign. **Gir sekmesi:** yerel tarayıcı `type="date"` inputu kaldırıldı; Plan'daki
  `react-day-picker` + "Bugün" kalıbı (`.mentor-plan-day-picker-wrap` global CSS'i) analiz özelinde
  `analysis-date-picker-sheet.tsx` olarak kopyalandı (planlı-gün işaretleri gerekmediği için
  `PlanDatePickerSheet`'in kendisi değil, sadeleştirilmiş bir kopyası — plan-tasks'a bağımlılık
  yok) ve `useMentorBottomSheet().filterSheet` ile açılıyor; varsayılan hâlâ bugünün tarihi.
  "Son denemeyi kopyala" `SectionHeading action` linkinden çıkıp gerçek `Button` olarak forma taşındı
  (`AnalysisMockExamForm`'a yeni `headerAction` slotu); tekli "Kaydet" artık `fullWidth` değil, sağa
  yaslı — düzenleme sheet'indeki (Vazgeç + Kaydet) iki-buton grid'i değişmedi. **Boş durumlar:**
  sayfadaki altı adet elle yazılmış "chip + paragraf" kartı (`ExamTypeGate`, `NoExamSeed`,
  `AnalysisGhostTeaser`, trend-boş kartı, foto-sekmesi iki kartı) `@/components/empty-state`
  `EmptyState`'e (görsel yoksa otomatik pastel placeholder) devredildi — trend-boş kartına artık
  Gir sekmesine götüren bir CTA var. **Chart altyapısı:** `@nivo/core` + `@nivo/line` eklendi,
  DESIGN token'larına bağlı tema ile `src/components/stat-line-chart.tsx` (`StatLineChart`) yazıldı;
  hover tooltip özel render (`x:`/`y:` etiketleri yerine nokta rengi + tarih + kalın değer,
  `shadow-card` kart), point'ler dolgu rengiyle + beyaz kenarlık (uçtaki nokta dahil hepsi net
  görünür), `compact` prop'u eksen/grid'siz salt sparkline modu açıyor. Önce yalnız geçmiş listesinde
  (`AnalysisHistoryList`, ≥2 kayıt) kanıt amaçlı denendi; onay sonrası üst KPI bandındaki
  (`AnalysisSummaryBand`) custom SVG sparkline da (tone rengiyle, `compact`) buna geçirildi — diğer
  istatistik kartları (odak kartı, gelişim sekmesi trend grafiği) bilinçli olarak dokunulmadı.
  Metin: `trend_subtitle`'daki tekrar eden "— sıralama yok" ibaresi (aynı uyarı zaten üst KPI
  bandında ve ders ortalamaları alt başlığında var) sadeleştirildi. `tsc --noEmit` ve `eslint`
  temiz; canlı tarayıcı doğrulaması kullanıcı tarafından yapıldı.
  Dosyalar: `analysis-mock-exam-form.tsx`, `analysis-date-picker-sheet.tsx` (yeni),
  `analysis-tab-entry.tsx`, `analysis-shell.tsx`, `analysis-ghost-teaser.tsx`,
  `analysis-tab-progress.tsx`, `analysis-tab-mistakes.tsx`, `analysis-history-list.tsx`,
  `analysis-summary-band.tsx`, `stat-line-chart.tsx` (yeni), `messages/{tr,en}.json`,
  `apps/web/package.json`.

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
- **KVKK — RESOLVED (2026-07-14):** `admin anonymize` is now a **holistic erasure**.
  `CoachingErasureService` (exported by `CoachingModule`; admin orchestrates, never writes W2 tables)
  scrubs every piece of behavioral free-text in ONE SERVICE-ctx tx: `vision_boards` row deleted;
  `mood_checkins`/`study_sessions` `struggle_note` + `ai_reflection` → null; `mock_exams.ai_ghost_narration`
  → null; `plan_tasks.title` → `"Silinmiş görev"` (NOT NULL, so placeholder not null); uploaded question
  photos deleted (rows **and** storage objects, best-effort `Promise.allSettled`).
  **KEPT:** the numbers (mock-exam nets, session durations, streak, activity) — no free text, still
  useful as aggregate signal. Files: `coaching-erasure.service.ts`, `coaching-erasure.repository.ts`.
  AI-side erasure → [ai.md](./ai.md).
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
- **Balanced `/analiz` simplification and lazy loading (2026-07-14)** — Kept the three-tab contract and existing APIs while moving weekly review/coach access to the first `Gelişim` visit and photo access to the first `Yanlışlarım` visit, cached per active exam. `Gelişim` now prioritizes focus → weekly review → trend/past-self, removes the duplicate record gauge, and collapses all-attempt subject averages. Mock-exam history keeps the first five rows and appends pages via “Daha fazla göster”; drawer focus is trapped/restored and scroll lock is reused. Retry/skeleton states keep core analysis visible. Gotcha: mock-exam and photo mutations invalidate lazy extras, so the active tab refetches them on demand. Backend/API contracts are unchanged. Related files: `apps/web/src/app/[locale]/(app)/analiz/_components/*`, `apps/web/messages/{tr,en}.json`.
- **`/analiz` entry CTA navigation fix (2026-07-14)** — “Yeni deneme gir” and “Son denemeyi kopyala” now reuse one entry action. If `Gir` is already active, the action skips the redundant RSC route replacement and scrolls directly to `#analiz-form`; from another tab it waits for the query-driven tab render, then scrolls. Tab navigation also preserves scroll. Regression check: `apps/api/src/analiz-navigation.spec.ts`. Related files: `analiz-shell.tsx`, `analiz-types.ts`.
- **`/analiz` client-only tab navigation (2026-07-14)** — Replaced query-only router transitions with local tab state and native `history.replaceState`. Direct `?tab=` URLs still select the initial view, while tab/entry actions no longer issue RSC requests; any `_rsc` transport parameter is removed when synchronizing the URL. This also makes “Yeni deneme gir” reveal and scroll to the form immediately. Regression check: `apps/api/src/analiz-navigation.spec.ts`. Related files: `analiz-shell.tsx`, `analiz-types.ts`.
- **First mock-exam activation flow (2026-07-14)** — The shared “Yeni deneme gir”/copy-last action now scrolls to the entry card and focuses its first numeric score input without changing the shared `TextField`. After a successful first attempt only, analysis refreshes and the client switches to `Gelişim`, synchronizes `?tab=gelisim` without an RSC navigation, and focuses the active tab; later saves remain on `Gir`. Related files: `analiz-shell.tsx`, `analiz-types.ts`, `apps/api/src/analiz-navigation.spec.ts`.

- **Latest attempt → AI coach handoff (2026-07-14)** — The `Gelişim` “Koça sor” CTA now carries
  `analysis.trend[0].id` as `contextMockExamId` alongside the existing editable seed. Opening chat
  never sends automatically; the verified result is attached only when the user submits the first
  successful message. Gotcha: deleted or non-owned attempts fail with 404 instead of silently
  degrading to context-free coaching. Related files: `analiz-tab-gelisim.tsx`,
  `koc-chat-shell.tsx`, `apps/web/src/lib/coach.ts`.

- **Historical attempt to AI coach handoff (2026-07-14)** - The loaded history drawer now offers a primary Ask the coach link that pre-fills chat with the selected attempt date and exam name, and carries its ID as contextMockExamId. Usage: open any past attempt and choose the CTA; the message remains editable and is never sent automatically. Gotcha: the publisher is intentionally excluded, and edit/delete states cannot navigate. Related files: analiz-history-detail.tsx, apps/web/src/lib/coach.ts, apps/web/messages/{tr,en}.json.

- **Topic-level wrong-answer map (2026-07-15)** — Photo categorizations now persist nullable `topic_ref`; legacy subject-only rows remain valid. Analysis groups topic counts by subject over the active exam’s latest 12 attempts. When the same topic appears in at least two photos, `Çalışma odağın` and the backend-localized Plan title become topic-specific; newest evidence wins equal counts. Usage: add a photo under `/analiz?tab=yanlislar`, then review the topic map and development focus. Gotcha: net trends remain subject-level; no topic net is invented. Related: `mock-exam-photo.repository.ts`, `analysis-focus.ts`, analysis components, migration `0050`.
- **Repeated topic → coach handoff (2026-07-15)** — A topic-backed `Çalışma odağın` now keeps the existing Plan prefill and adds a secondary, editable “Ask the coach” seed with the localized subject and topic names. The aggregate topic signal is not attached as mock-exam or photo context, and opening chat never sends automatically. Subject-only focuses and the page-level latest-attempt coach CTA are unchanged. Related: `analiz-next-focus-card.tsx`, `apps/web/messages/{tr,en}.json`.

- **Analiz odak → eylem sadeleştirmesi (2026-07-16)** — `Gelişim` sırası artık çalışma odağı →
  kompakt kural-tabanlı haftalık değerlendirme → native `Kanıtlar ve geçmiş` detay alanıdır. Odak
  varsa detay kapalı, odak yoksa açık başlar. Tek birincil eylem mevcut `/plan?add=1&subject=&title=`
  ön-doldurmasıdır; görev kullanıcı onayı olmadan kaydedilmez. Ders ve konu odaklarının ikisi de
  düzenlenebilir seed ile ikincil `Koçla konuş` geçişi sunar ve otomatik mesaj göndermez. Özet
  bandındaki tekrar eden odak, sayfa sonu Koç CTA'sı, haftalık AI anlatısı, ghost AI anlatısı ve
  `/v1/coach/access` isteği analiz yüzeyinden kaldırıldı; backend endpointleri geriye uyumluluk için
  korunur. Yeni endpoint/migration yoktur. İlgili dosyalar: `analiz-shell.tsx`,
  `analiz-tab-gelisim.tsx`, odak/weekly/ghost bileşenleri ve `messages/{tr,en}.json`.

- **Seans sağlamlık turu (2026-07-17)** — `/seans` timer'ı artık reload/uygulama-içi gezinmeye
  dayanıklı: aktif seans `mentor.session.active` localStorage kaydıyla sürer; dönüşte süren
  focus/break kaldığı yerden devam eder, süre sekme kapalıyken dolduysa seans ölçülen krediyle
  (`resolveResume` — pause hariç, planlanan süreyle sınırlı) COMPLETED finalize edilir.
  `actualFocusSeconds` artık her yolda wall-clock türetilir (doğal bitişte planlanan sürenin tamamı
  yazılma bug'ı giderildi; arka plan throttling undercount'u da kapandı). Focus/break sırasında tab
  başlığı geri sayım gösterir; odak bitiminde WebAudio çan çalar (`session-chime.ts`, Başla
  tıklamasında unlock). Sunucu tarafı: `SessionService.start` aynı tx içinde kullanıcının bayat
  IN_PROGRESS satırlarını (planlanan süre + 60 dk grace sonrası) kredisiz ABANDONED kapatır —
  dürüst kredi yolu client resume'udur. Gotcha: resume finalize'ı 409/404'te sessizce idle'a düşer
  (başka cihaz/stale-cleanup yarışı). İlgili: `use-session-timer.ts`,
  `apps/web/src/lib/session-persistence.ts` (+ `apps/api/src/session-persistence.spec.ts`),
  `seans-shell.tsx`, `study-session.repository.ts`, `session.service.ts`, `coaching.constants.ts`.

- **Günlük odak hedefi + XP quest (2026-07-17)** — Kullanıcı `/seans` idle ekranındaki karttan
  15–600 dk arası (15'lik adım) günlük odak hedefi belirler (`users.daily_focus_goal_minutes`,
  migration `0052`; `PATCH /v1/users/me` üzerinden). `GET /coaching/today` yanıtına
  `focusGoal { goalMinutes, focusMinutesToday }` eklendi — bugünkü COMPLETED seansların toplam
  odak dakikası, min-focus filtresi olmadan (hedef birikimi ölçer). Kart ilerleme barı +
  "45 / 120 dk" gösterir; hedef dolunca günde bir kez kutlama (UTC gün,
  `mentor.session.goalCelebrated:<date>`). `daily.focus-goal-met` daily-ritual quest'i XP verir
  (mevcut `economy.quest.daily_ritual_reward_xp`; seans bölgesinde coin yok guardrail'i korunur) ve
  hedef belirlenmemişse listede görünmez/verilmez. Gotcha: gün sınırı UTC (mevcut `daily_activity`
  matematiğiyle tutarlı; per-user timezone backlog'da). İlgili: `session-focus-goal-card.tsx`,
  `seans-shell.tsx`, `today.service.ts`, `daily-quest-signal.service.ts`, `quest.catalog.ts`,
  `quest.service.ts`, `packages/validation/src/auth.ts`, `packages/types/src/{auth,coaching}.ts`.

- **"Şu an N kişi odaklanıyor" + seans paylaşımı (2026-07-17)** — `GET /coaching/today` yanıtına
  `focusingNow` eklendi: son 120 dk içinde başlamış IN_PROGRESS seansların distinct kullanıcı sayısı
  (SERVICE-context aggregate — RLS sınırını yalnız sayı olarak geçer; 60 sn in-memory cache;
  **sunucu < 3'te null döner**, soğuk-başlangıç görünmez). /seans idle başlığının altında sakin tek
  satır olarak gösterilir; immersive focus ekranına konmadı. Seans bitiş ekranına "Bugünü paylaş"
  eklendi: Web Share (clipboard fallback) ile "{X} dakika odaklandım 🎯 {Y} gün seri!" metni +
  uygulama linki (`resolveSessionShare` pure helper — 0 dk'da buton gizli, streak 0'da seri cümlesi
  düşer; görsel kart üretimi yok). Gotcha: sayaç bayat IN_PROGRESS satırlarıyla şişebilir — 120 dk
  pencere + lazy stale-cleanup sınırlar. İlgili: `study-session.repository.ts` (`countFocusingNow`),
  `session.service.ts` (`getFocusingNowCount`), `today.service.ts`, `seans-shell.tsx`,
  `session-done-state.tsx`, `apps/web/src/lib/session-share.ts`.

- **Plan → Takvim: saatli etkinlikler (2026-07-25)** — Plan sayfasındaki **Hafta** sekmesi
  **Takvim** oldu (`PlanViewMode.week` → `calendar`; `readStoredViewMode` eski localStorage
  değerini sessizce migrate eder). Takvim içinde **Gün · Hafta · Ay** ölçeği
  (`mentor.plan.calendarScale`), ay/hafta/gün başlığı + ‹ › adımlama ve "Bugün".
  **Ayrı etkinlik tablosu yok:** `plan_tasks`'a üç nullable kolon eklendi — `start_time`,
  `end_time`, `description` (migration `0059` + `plan_tasks_time_range_chk`). **Kural:
  `start_time IS NULL` = tüm gün** — takvim öncesi her satır otomatik olarak tüm-gün, davranış
  değişmedi. `end_time` tek başına olamaz ve `> start_time` olmalı; aynı kural zod
  (`refinePlanTaskTimes`, hem create hem update) ve DB CHECK'te ikizlenir. Update'te saatler
  **çift olarak** patch'lenir (temizleme = ikisi de null) — böylece kayıt okumadan doğrulanır.
  Gün içi sıralama `start_time asc nulls first` (Postgres ASC varsayılanı NULLS LAST, açıkça
  yazıldı) → tüm-gün üstte, saatliler kronolojik. Etkinlik **rengi `subject`'ten deterministik
  türetilir** (`planEventColor`) — renk kolonu/picker yok, aynı ders her yerde aynı renk; ders adı
  hep yazılı olduğu için renk tek sinyal değil. Palet yeni hex tanımlamaz, mevcut `@mentor/ui`
  accent token'larıdır (DESIGN.md §2.3; `thumb-*` token'ları theme.css'te yok, o yüzden 5 swatch).
  **Gotcha: hash FNV-1a olmak zorunda** — klasik `hash * 31 + c` foldu `31 ≡ 1 (mod 5)` olduğu için
  `sum(charCodes) % 5`'e çöküyor ve Matematik/Türkçe/Tarih/Genel Yetenek'i tek renge yığıyordu;
  spec bu beşliyi ayrı swatch'ta tutuyor. Popup için yeni modal
  altyapısı yok: `filterSheet` zaten `lg`'de ortalanmış dialog, mobilde bottom sheet. Saat girişi
  native `<input type="time">`. Hover/focus önizlemesi salt-okunur (tıklama zaten düzenlemeyi
  açıyor) — yüzey başına tek popover. Gotcha: **ay ızgarası 42 gün** → `listPlanTasksForRange`
  artık `total > 100` olduğunda kalan sayfaları paralel çeker (API `pageSize` üst sınırı 100,
  sessizce kesiliyordu). Mobilde 7 kolonlu saat ızgarası kullanılamaz olduğu için `week` ölçeği
  seçili günün ajandası olarak render edilir ve sekme "Ajanda" yazar. Saf geometri
  `apps/web/src/lib/plan-calendar-layout.ts`'de (çakışma kolonlama O(n²), bir günün görev sayısı
  için yeterli) + `web-plan-calendar-layout.spec.ts`. İlgili: `plan-calendar-view.tsx`,
  `plan-calendar-header.tsx`, `plan-time-grid.tsx`, `plan-month-grid.tsx`, `plan-event-chip.tsx`,
  `plan-event-preview.tsx`, `plan-add-task-form.tsx`, `plan-shell.tsx`, `plan-utils.ts`,
  `lib/plan-event-colors.ts`, `lib/plan-tasks.ts`, `coaching.mappers.ts` (`time` → "HH:MM").

- **Haftanın Hikâyesi kanıt modeli (2026-07-26)** — Tamamlanan son Europe/Istanbul
  Pazartesi–Pazar dönemi, mevcut `GET /v1/coaching/weekly-review` üzerinden additif
  `EMPTY | PARTIAL | READY` recap sözleşmesiyle sunulur. `READY`, merkezi config'teki deneme,
  nitelikli seans (`coaching.session.min_focus_seconds`) veya tamamlanmış plan görevi
  eşiklerinden herhangi biriyle oluşur; mood tek başına hikâyeyi açmaz. `activeDays`, deneme +
  nitelikli seans + `DONE` görev günlerinin İstanbul takvimindeki birleşimidir. Plan dağılımı
  yalnız content taksonomisinde slug/ad olarak doğrulanan derslerin aggregate sayaçlarını taşır;
  görev başlığı API recap kanıtına girmez. Kullanım: `/analiz` Gelişim teaser'ından veya haftada
  bir `/panel` teaser'ından hikâyeyi aç. Gotcha: `WeeklyReviewStatus` geriye uyumlu kaldı fakat
  `READY` semantiği görev eşiğini de kapsıyor; yeni tablo, snapshot veya migration yok.
  İlgili dosyalar: `weekly-review.{ts,service.ts,repository.ts}`, `today.service.ts`,
  `packages/types/src/coaching.ts`, `config.catalog.ts`.

- **Panelde EMPTY recap teaser'ını gizleme (2026-07-26)** — `GET /v1/coaching/today`
  içindeki `weeklyRecapPeriod` artık backend'in hesapladığı `status` alanını da taşır. Panel,
  yeni bir istemci isteği oluşturmadan yalnız `PARTIAL | READY` dönemleri haftalık teaser olarak
  gösterir; `EMPTY` dönemler Analiz sayfasındaki sakin boş durum üzerinden erişilebilir kalır.
  Böylece “hikâye hazır” teaser'ından kanıtsız ekrana geçiş engellenir. Yerel demo kullanım:
  `pnpm --filter @mentor/api seed:analysis-demo -- --email=<adres>`. İlgili dosyalar:
  `today.service.ts`, `content.port.ts`, `weekly-recap.ts`, `panel-shell.tsx`,
  `packages/types/src/coaching.ts`.

- **Mentor Wrapped haftalık metrikleri ve unvanı (2026-07-27)** — Mevcut
  `GET /v1/coaching/weekly-review` sözleşmesi; yedi günlük aktivite dizisi, hafta içindeki en uzun
  aktif seri, en uzun nitelikli seans, taksonomi-doğrulanmış odak dersleri, en fazla iki
  backend-seçimli highlight ve haftalık macera unvanıyla additif genişletildi. Önceki haftadan
  yalnız olumlu kişisel gelişim sinyali gösterilir; düşüş, sıralama ve diğer kullanıcılarla
  karşılaştırma yapılmaz. Unvanlar kalıcı badge değildir ve her okumada kaynak veriden yeniden
  hesaplanır. Demo kullanım: `pnpm --filter @mentor/api seed:analysis-demo --
--email=<adres>` tamamlanan iki haftaya stabil/idempotent seans ve görev kayıtları ekler;
  unrelated kullanıcı kayıtlarını silmez. Gotcha: seans ve görevler ayrı aggregate edilir,
  yalnız nitelikli seanslar odak metriklerine girer. İlgili dosyalar:
  `weekly-review.{ts,service.ts,repository.ts}`, `weekly-recap-demo.schedule.ts`,
  `seed-analysis-demo.ts`, `packages/types/src/coaching.ts`, `config.catalog.ts`.

- **Panel recap dönemini countdown'dan ayırma (2026-07-27)** — `GET /v1/coaching/today`,
  sınav tarihi geçip sakin countdown `null` olduktan sonra da tamamlanan haftanın başlangıç
  tarihine göre ilgili sınavı çözüp `weeklyRecapPeriod` üretir. Böylece READY/PARTIAL teaser,
  sınavın ertesi günü panelden kaybolmaz. Dönem nesnesi backend'in çözdüğü `examId` değerini de
  taşır; panel recap bağlantısı bunu doğrudan kullanır ve güncel takvimi yeniden çözmeye çalışmaz.
  İstemcide yeni istek veya waterfall oluşmaz. Gotcha: countdown hâlâ geçmiş resmi tarihi
  göstermez, yalnız recap sınav çözümlemesi tarihsel `asOf` kullanır. İlgili dosyalar:
  `today.service.ts`, `content.port.ts`, `panel-shell.tsx`,
  `content-service.adapter.ts`, `content.service.ts`.

- **Mentor Wrapped poster görsel dili (2026-07-27)** — Haftanın Hikâyesi'nin READY ve PARTIAL
  desteleri, Spotify Wrapped 2025 Community referansındaki tek-fikirli poster kompozisyonuna
  uyarlandı: yüksek kontrastlı büyük tipografi, sıralı beyaz etiketler, optik halka/dama/nokta
  desenleri, dairesel performans sahnesi ve haftalık unvan için Puhu rozet posteri. Mevcut
  veri seçimi, 6–8 ekran kompozisyonu, swipe/klavye navigasyonu ve reduced-motion davranışı
  değişmedi. Soyut halka, dama, nokta, çizgi ve yay katmanları Figma node'larından PNG olarak
  export edilip `public/visuals/weekly-recap-*` adıyla kalıcılaştırıldı; React/CSS ile yeniden
  çizilen desenler kaldırıldı. Spotify logosu ve sanatçı/albüm görselleri ürüne taşınmadı; Mentor
  DESIGN token'ları ve mevcut Puhu varlıkları kullanıldı. Yükleme skeleton'ı aynı poster iskeletini
  korur. İlgili dosyalar: `weekly-recap-shell.tsx`, `weekly-recap-content-skeleton.tsx`,
  `lib/weekly-recap.ts`, `lib/weekly-recap.spec.ts`, `public/visuals/weekly-recap-*`.

- **Haftanın Hikâyesi Instagram story deneyimi (2026-07-28)** — READY recap, 2023 Wrapped
  Community'nin sekiz adet 1080×1920 frame kompozisyonuna uyan sabit bir hikâyeye dönüştürüldü:
  karşılama, hafta haritası, odak dakikası, haftalık seri, haftanın eni, deneme sinyali,
  haftalık karakter ve kapanış. Mobil kullanım tam viewport'tur; süre bazlı progress, otomatik
  oynatma, basılı-tutunca duraklatma, sağ/sol tap alanları, swipe ve üst play/sound/close
  kontrolleri vardır. Desktop aynı 9:16 sahneyi ortalar, dış oklar ve klavyeyi korur. Deneme veya
  odak verisi yoksa sıfır metriği yerine özelliği sakin biçimde açıklayan merak köprüsü gösterilir.
  Finalde paylaşım, plan ön-doldurma ve mevcut premium/coin kapısını koruyan Puhu notu dock/sheet'i
  bulunur. Ses manifesti Mixkit'ten seçilen beş yerel parçayı hikâye ritmine göre dağıtır:
  `Pop Track 03` karşılama, `Gimme that Groove!` aktif gün/seri, `Digital Clouds` odak/deneme,
  `Funkee Monkeee` haftanın eni/karakter ve `Discover` kapanış sahnelerinde kullanılır. Aynı
  parçanın tekrarlandığı sahnelerde farklı cue noktaları seçilir; hikâye her açılışta muted
  başlar, ses tercihi slaytlar arasında korunur ve audio hatası hikâyeyi durdurmaz. Kaynaklar
  `public/audio/mixkit-*.mp3` altında tutulur. Gotcha: reduced-motion hikâyeyi paused açar; EMPTY autoplay
  kullanmaz, PARTIAL dört ekran kalır. Dekorlar React/CSS çizimi değil, kalıcı Figma exportlarıdır.
  Metin anlatımı slayt süresine bağlı iki vuruşa ayrılır: önce başlık/ana metrik, ardından destek
  cümlesi görünür; final aksiyon dock'u ikinci vuruşla açılır. Figma dekorları kendi export
  katmanları korunarak yalnız transform/opacity ile düşük yoğunluklu, sürekli hareket eder;
  reduced-motion bu hareketi crossfade'e indirger.
  Hafta haritası slaytı `public/video/puhu-fire.mp4` videosunu story zaman çizelgesine bağlar:
  başlık ateşin zirvesi olan 2,2. saniyede çıkar, aktif gün sayısı görünür. Video; play/pause,
  uzun basma ve sekme görünürlüğüyle birlikte durur/devam eder, yüklenemezse mevcut Puhu görseline
  düşer.
  Final slayt, tek bir 9:16 paylaşım posteri önizlemesine dönüşür. Paylaş aksiyonu yeni export
  bağımlılığı olmadan Canvas ile 1080×1920 PNG üretir; mobilde dosyalı Web Share, desteklenmeyen
  ortamlarda indirme + metin panosu fallback'i kullanılır. Poster yalnız efor aggregate'larını,
  haftalık unvanı ve backend'in doğruladığı en çok çalışılan ders adı/süresini içerir; net, mood,
  görev başlığı, subject ref ve AI notu dışarı çıkmaz.
  Poster önizlemesi story güvenli alanında büyütüldü; yeşil ders şeridi kaldırılarak ana metrik,
  yardımcı istatistikler ve haftanın dersi tek bir editoryal tipografi akışına alındı. Aynı
  hiyerarşi indirilen/paylaşılan Canvas görselinde de korunur.
  Final story dock'u mobil alt navigasyon diliyle hizalanarak tam kapsül forma geçirildi; dış
  border yumuşatıldı, üç aksiyon eşit genişlikte yuvarlak dokunma alanları olarak korundu ve
  hover davranışı ölçek yerine düşük yoğunluklu arka plan değişimiyle sınırlandı.
  PNG export dekorları başlık, metrik, ders ve imza için tanımlı güvenli bölgelerin dışına
  sabitlendi; alt Figma grafiğinin ders/imza üstüne taşması engellendi ve geometri testi eklendi.
  Panel ve Analiz'deki recap teaser'ı, referans Wrapped kütüphane banner'ı gibi tek parça
  tıklanabilir mercan postere dönüştürüldü. Gerçek Figma exportları üst sahnede dekor olarak
  kullanılır; görünür CTA, rozet ve tarih yerine “Senin Haftalık Özetin / Geçen haftanın öne
  çıkanlarını keşfet.” kopyası gösterilir. Durum ve dönem ekran okuyucu açıklamasında korunur;
  tıklama mevcut `/analysis/recap` akışını ve dashboard haftada-bir davranışını değiştirmez.
  Teaser, feature-scoped `.weekly-recap-theme` sınıfını doğrudan taşır; böylece mercan token
  story dışındaki panel/analiz yüzeylerinde de çözülür. Dekor assetlerinin hover transformları
  kaldırılmıştır; banner etkileşim sırasında görsel olarak sabit kalır.
  PARTIAL hikâye artık kanıta göre 5–7 ekran arasında adaptiftir: karşılama ve hafta haritasından
  sonra varsa odak ve iki gün veya daha uzun ritim ekranları eklenir; haftanın kıvılcımı, “Hikâyende sırada
  ne var?” ve ayrı kapanış her zaman korunur. Eksik odak seansı, tamamlanmış görev ve deneme
  kanallarının tamamı backend'in sıralayıp yerelleştirdiği `recap.nextStorySignals[]` kartlarıyla tek
  ekranda gösterilir. Kartlar bu iterasyonda bilgilendiricidir; story oynatımı sırasında görev veya
  kayıt oluşturmaz. Eski istemciler için nullable `nextStorySignal` dizinin ilk öğesini taşımaya
  devam eder. READY sekiz ekran, EMPTY ise aksiyon odaklı decksiz durum olarak kalır; eski/eksik
  yanıtlarda tekil sinyal veya recap kapanış metni güvenli fallback'tir.
  Açılabilir sahneler ekranındaki genel siyah kart listesi, Wrapped poster diliyle yeniden
  tasarlandı: büyük başlık ve sahne sayısı, mercan zemin üzerinde lavanta/mint/siyah tam renk
  bantları, dev sıra numaraları, keskin çerçeveler ve reduced-motion uyumlu dönüşümlü giriş
  hareketleri kullanılır. Yuvarlatılmış kart ve gölge bu veri posterinden; Puhu maskotu ise
  PARTIAL veri posteri ile kapanış slaydından kaldırıldı.
  İlgili: `weekly-recap-{shell,story}.tsx`, `use-weekly-recap-{playback,audio}.ts`,
  `lib/weekly-recap{,-share-card}.ts`, `weekly-review.{ts,service.ts}`,
  `packages/types/src/coaching.ts`, `messages/{tr,en}.json`,
  `public/visuals/weekly-recap-2023/`.

- **Mentor Wrapped V1.3 veri hikâyeleri ve editoryal dil (2026-07-29)** — Nitelikli seanslar
  Europe/Istanbul başlangıç saatine göre sabah/öğleden sonra/akşam/gece bantlarında toplanır;
  en çok odak süresi taşıyan bant backend-localized `rhythm.focusTimeBand` olarak döner.
  Nitelikli odağın en yüksek olduğu erken tarih eşitlik kazancıyla seçilir ve iki-highlight
  kotasından bağımsız `rhythm.peakFocusDay` olur. Hafta haritası güç gününü, odak slaytı baskın
  çalışma zamanını kanıt vuruşunda gösterir; kanıt yoksa mevcut görünüm korunur. Story TR/EN
  kopyası genel “büyüdü/ritim” tekrarlarından reveal–proof–punchline diline geçirildi; sekiz
  READY ve adaptif PARTIAL kompozisyonu değişmedi. Migration veya yeni endpoint yoktur.
  İlgili: `weekly-review.ts`, `weekly-review.{repository,service}.ts`,
  `packages/types/src/coaching.ts`, `weekly-recap-{story,lib}.ts`, `messages/{tr,en}.json`.

- **Haftalık karakter evreni refactor'u (2026-07-29)** — READY recap'in yedi deterministik
  karakteri kısa, iki kelimelik fantastik/futuristik bir sete geçirildi: Kozmik Maestro,
  Zaman Bükücü, Nebula Dalgıcı, Rota Mimarı, Boyut Kaşifi, Anka Pilotu ve güvenli fallback
  Nova Yolcusu. Seçim eşikleri, baskın oran kuralı ve stabil `WeeklyRecapTitleId` değerleri
  değişmedi; yalnız backend-localized TR/EN etiketler ile kanıt cümleleri yenilendi. Web,
  paylaşım kartı ve eksik eski yanıtlardaki fallback yeni isimleri gösterir. Gotcha: bu
  karakterler kalıcı badge değildir ve her tamamlanan hafta için yeniden hesaplanır.
  İlgili: `i18n/locales/{tr,en}/coaching.json`, `messages/{tr,en}.json`,
  `weekly-review-prompt.ts`, `weekly-recap.spec.ts`.

- **Anka Pilotu tam ekran karakter reveal'i (2026-07-29)** — READY hikâyede backend'in stabil
  `MOCK_BRAVE` karakteri seçildiğinde 7. slayt `public/video/anka-pilotu.mp4` videosunu 9:16
  story yüzeyine tam taşır. Video mevcut play/pause, basılı tutma ve sekme görünürlüğüyle
  senkron ilerler; kendi sesi kapalıdır ve slaydın müzik kanalı korunur. İlk 4 saniye yalnız
  dönüşüm, 4–6 saniye karakter adı, 6. saniyeden sonra kanıt cümlesi gösterilir. Medya
  yüklenemezse mevcut dekorlu metin görünümüne düşer. Karakter-video eşleşmesi slide
  descriptor'ında tutulduğu için yeni karakter videoları aynı manifest üzerinden eklenebilir.
  Yedi haftalık karakterin tamamı ortak reveal kimliği olarak
  `mixkit-shot-light-energy-flowing-2589.wav` efektini slaydın başından kullanır; karaktere
  özel videolar bu ortak ses kararını değiştirmez.
  İlgili: `weekly-recap.ts`, `weekly-recap-story.tsx`, `weekly-recap.spec.ts`,
  `public/video/anka-pilotu.mp4`, `public/audio/mixkit-shot-light-energy-flowing-2589.wav`.

- **Yedi karakter için video reveal ve poster fallback (2026-07-29)** — Haftalık kod adı
  slaydının video manifesti yedi stabil `WeeklyRecapTitleId` değerinin tamamını kapsayacak
  şekilde genişletildi. Her kod adı `public/video/character/` altındaki kendi 9:16 videosunu
  oynatır; eşleşen `public/img/character/` görseli video yüklenirken tarayıcı posteri olarak
  kullanılır. Aynı görsel final ön izlemesi ve indirilen 1080×1920 paylaşım kartının üst
  karakter alanında kullanılır; alt mercan bölüm güvenli haftalık metrikleri taşır. Karakter
  görseli bulunamazsa Puhu fallback'i gösterilir. Story yalnız seçilen karakterin videosunu
  yükler; başka karakter medyaları için başlangıç waterfall'u oluşturmaz. Video hatasında
  mevcut dekorlu fallback korunur. Paylaşım kartındaki kod adı etiketi story ile
  aynılaştırıldı; karakter adı görsel birleşiminden uzaklaştırıldı ve alt metrik alanında
  kırpılma artefaktı oluşturan dekorlar kaldırıldı. İlgili: `weekly-recap.ts`,
  `weekly-recap-story.tsx`, `weekly-recap-share-card.ts`, `weekly-recap.spec.ts`,
  `public/{video,img}/character/`.

- **Panel recap banner'ında hafta boyu tekrar izleme (2026-07-30)** — Paneldeki haftalık
  hikâye banner'ı ilk açılıştan sonra kaldırılmak yerine backend'in verdiği tamamlanmış dönem
  değişene kadar görünür kalır. Cihazdaki dönem anahtarı açılmamış banner'ı `new`, açılmış
  banner'ı `replay` durumuna taşır; replay durumunda “Haftanın Hikâyesini Tekrar İzle”
  metni gösterilir. Sonraki tamamlanmış haftanın `startDate` değeri yeni anahtar ürettiği için
  banner otomatik olarak yeniden yeni durumuna geçer. `EMPTY` dönemler panelde gösterilmez;
  client hafta sınırı hesaplamaz ve yeni API isteği oluşturmaz.
  İlgili: `panel-shell.tsx`, `weekly-recap-teaser.tsx`, `weekly-recap.ts`,
  `weekly-recap.spec.ts`, `messages/{tr,en}.json`.

- **Hafta haritasında full-screen video sahnesi (2026-07-30)** — İkinci recap slaydındaki
  Puhu ateş videosu küçük beyaz kart ve mor ara sahneden çıkarılarak doğal açık fonuyla 9:16
  story yüzeyinin tamamına yayıldı. Koyu üst/alt scrim yalnız progress, aktif gün ve güç günü
  metinlerinin okunabilirliğini destekler. Beş parçalı Wrapped dekor seti sadeleştirilerek
  yalnız küçültülmüş iki alt köşe vurgusu bırakıldı; progress, kontroller, ateş ve güç günü
  metniyle yarışan üst/orta assetler kaldırıldı. Aktif gün başlığı üst boşlukta, güç günü kanıtı
  altta gösterilir. Video zamanlaması, autoplay/pause senkronu ve `2.2s` aktif-gün reveal
  noktası değişmedi. Video hatasında yeni feature-scoped `--recap-sky` zemini üzerinde Puhu
  fallback'i gösterilir.
  İlgili: `weekly-recap-story.tsx`, `weekly-recap.ts`, `weekly-recap.spec.ts`.

- **Karşılama slaytında Sunucu Puhu (2026-07-30)** — İlk recap slaydındaki kupalı başarı
  maskotu, haftalık unvanı önceden çağrıştırmayan şeffaf `puhu-host.png` ile değiştirildi.
  Yeni `host` varyantı `PuhuImage` kataloğuna eklendi; karşılama ekranında hafif süzülme ve
  dönüş hareketi kullanır. Mevcut dört saniyelik metin değişimi korunur; reduced-motion
  kullanıcılarında maskot hareket etmez. `proud` varyantı kilometre taşı ve fallback
  yüzeylerinde kullanılmaya devam eder.
  İlgili: `puhu-image.tsx`, `weekly-recap-story.tsx`,
  `public/mascot/puhu/{puhu-host.png,README.md}`.

- **Hedef haritası: il/üniversite seçimi + kariyer maskotu (2026-07-31)** — `/hedef` ekranındaki
  serbest metin şehir alanı yerini normalize seçime bıraktı. `vision_boards`'a üç kolon:
  `target_city_code` (FK → `cities`), `target_university_id` (FK → `universities`), `career_group`.
  **`target_city` (text) silinmedi** — eski kayıtlar ve il listesinin ifade edemediği hedefler
  (yurt dışı, "listede yok") için duruyor; okuma kuralı: kod varsa kod, yoksa metin. İki FK de
  `ON DELETE SET NULL` — referans satırı düşerse kullanıcının hedefi silinmemeli.
  **Kritik:** `vision-board.repository.ts` içindeki `unchanged` predicate'i premium AI motivasyon
  notunun ne zaman geçersizleşeceğini belirler; **üç yeni alan da oraya eklendi**. Eklenmeseydi
  kullanıcı Konya→Ankara yaptığında eski şehre ait not ekranda kalırdı. `vision.service.spec.ts`
  bunu üç ayrı testle kilitler.
  Üniversite↔il tutarlılığı **serviste** doğrulanır (`GeoService.universityExistsInCity`): zod
  çifti zorunlu kılar ama üniversitenin gerçekten o ilde olduğunu bilemez, client'a güvenilmez.
  **Harita:** `TurkeyMap` build-time üretilmiş statik SVG path'leri kullanır
  (`scripts/build-turkey-map.mjs` → `paths.generated.ts`); runtime'da d3 / harita kütüphanesi /
  WebGL **yok**. Erişilebilirlik sözleşmesi native `<select>` üzerindedir, SVG `aria-hidden` —
  81 path'i tab sırasına sokmak ekranı iyileştirmez. Bu karar bedava bir yan fayda getirdi:
  `PROVINCES` boşken sayfa tam çalışır, sadece çizim görünmez. Üniversite rozetleri ve kartın
  üniversite listesi yalnız `examType === "YKS"` iken görünür.
  **Gotcha 1:** Rozet `<g>`'sinde `pointerEvents="none"` **şart** — yoksa rozet tıklamayı yutar
  ve altındaki il seçilmez (sessiz bug).
  **Gotcha 2:** `apps/web/data/tr-provinces.geo.json` repoda **yok**; OSM türevi (ODbL) dosya
  eklenip `pnpm --filter @mentor/web build:map` çalıştırılmalı. Script 81 il, bozuk path ve
  viewBox dışına düşen centroid için assert eder — içbükey iller (Muğla, Antalya, Hatay) için
  `CENTROID_OVERRIDES` gerekebilir. ODbL atıfı `TurkeyMap` içinde, yalnız harita çizildiğinde.
  **Gotcha 3 (superseded 2026-08-02):** Kariyer görselleri artık
  `public/mascot/career/{CareerGroup.toLowerCase()}.png` altında; `CAREER_ART_AVAILABLE` kaldırıldı.
  Kariyer grubu on sabit değerdir, DB tablosu yok; "Henüz karar vermedim" açık bir seçenektir
  (radio semantiğinde seçim temizlenemez, gizli jest de keşfedilebilir değil).
  Onboarding **değişmedi** — harita panelde yaşıyor; `complete-step.tsx`'e keşif CTA'sı eklendi.
  İlgili: `turkey-map.tsx`, `paths.generated.ts`, `build-turkey-map.mjs`, `vision-board-shell.tsx`,
  `puhu-image.tsx`, `vision.service.ts`, `vision-board.repository.ts`, `coaching.mappers.ts`,
  `packages/validation/src/coaching.ts`, `e2e/vision-board.spec.ts`.

- **Harita iki seviyeli: ülke → il → üniversite (2026-08-01)** — Ülke görünümünde il başına rozet
  (üniversite sayısı); ile tıklanınca viewBox o ilin `bbox`'ına iner ve **üniversite başına pin**
  çizilir, pine tıklanınca üniversite kartı açılır. Tek seviyede pin çizilmiyor çünkü ülke
  ölçeğinde bir il ~60px: pinler üst üste biner ve dokunulamaz.
  **Projeksiyon runtime'da d3 olmadan yapılır:** build script Mercator'un üç parametresini
  (`MAP_PROJECTION`) yayar, `projection.ts` dört satırlık ileri dönüşümü uygular. Güvenli olmasının
  sebebi build script'indeki assert: aynı noktaları hem d3 ile hem elle projeksiyonlayıp
  karşılaştırır, sapma olursa build düşer — sessizce yanlış yere pin koymaz.
  **Gotcha 1:** Zoom'da `vector-effect: non-scaling-stroke` şart, yoksa il sınırları büyütme
  oranında kalınlaşır. Pin/rozet boyutları `unit = viewBoxWidth / 1000` ile ölçeklenir.
  **Gotcha 2:** Pinler `aria-hidden` SVG içinde, yani klavye yolu değil — üniversiteye erişimin
  erişilebilir yolu şehir kartındaki liste butonlarıdır. İkisi de aynı `UniversityCard`'ı açar.
  İlgili: `turkey-map.tsx`, `projection.ts`, `build-turkey-map.mjs`, `globals.css`.

- **Harita keşif ekranı: kümeleme, zoom, hover kartı (2026-08-01)** — Form kompakt kaldı; şehir
  alanı düz alfabetik `<select>` (bölge `optgroup`'ları kaldırıldı — kullanıcıyı önce ilin hangi
  bölgede olduğunu bilmeye zorluyordu) + "Haritadan seç" düğmesi. Düğme `MapExplorer`'ı tam ekran
  açar: sol sidebar (arama / şehir üniversiteleri / üniversite + bölüm detayı) ve full-width harita.
  **Kümeleme (`clustering.ts`):** İstanbul'da 58 üniversite var; ülke ölçeğinde ayrı pin olarak
  çizmek okunamaz bir leke ve dokunulamaz hedef üretir. Grid tabanlı — O(n), deterministik,
  yakınsama iterasyonu yok; birkaç yüz noktada mesafe tabanlı kümelemeden ayırt edilemez ama
  yeniden render'da farklı sonuç üretemez. Hücre boyu viewport genişliğinin oranı olduğu için
  zoom'da kümeler kendiliğinden dağılır.
  **Zoom/pan (`use-map-viewport.ts`):** yalnız `viewBox` değişir — CSS transform yok, canvas yok,
  harita kütüphanesi yok. Path'ler statik string kalır ve hit-testing native kalır: tıklama her
  zoom seviyesinde tarayıcının söylediği `<path>`'e düşer.
  **Hover kartı** takvimdeki `PlanEventPreview` kalıbının aynısı: anchor rect'ten `fixed`
  konumlama, viewport kenarında yön değiştirme, `pointer-events-none` (yoksa kendini doğuran
  hover'ı çalar).
  **Gotcha 1:** Arama sonuçları ait oldukları sorguyla birlikte saklanır ve yalnız ikisi eşleşince
  gösterilir. Yalnız payload saklanınca "konya" → "ka" silmesinde debounce süresince eski sonuçlar
  yeni sorgunun cevabıymış gibi duruyordu.
  **Gotcha 2:** Pan yalnız zoom'luyken açık; ülke görünümünde jesti yutmak ile tıklamayı bozardı.
  **Gotcha 3:** SVG hâlâ `aria-hidden`; klavye yolu `<select>` ve sidebar listesidir.
  İlgili: `city-picker.tsx`, `map-explorer.tsx`, `map-canvas.tsx`, `clustering.ts`,
  `use-map-viewport.ts`, `university-hover-card.tsx`, `e2e/vision-board.spec.ts`.

- **Kariyer Puhu swap (2026-08-02)** — "Puhu'nun alanı" select değişince haritadaki proud Puhu
  anında kariyer illüstrasyonuna geçer (Kaydet gerekmez). Asset path:
  `public/mascot/career/{enum.toLowerCase()}.png` (örn. `YAZILIM` → `yazilim.png`); `null` /
  "Henüz karar vermedim" → `puhu-proud.png`. `PuhuImage` `CAREER_ART_AVAILABLE` bayrağını kaldırdı;
  `AnimatePresence` ile crossfade + hafif scale pop (~280ms); `prefers-reduced-motion` yalnız
  opacity. Vision shell değişmedi — zaten `career={careerGroup}` geçiyordu.
  **Gotcha:** Dosya adları enum slug'ı olmalı; semantik İngilizce adlar (`doctor.png` vb.) kırık
  görsel üretir. İlgili: `puhu-image.tsx`, `apps/web/public/mascot/career/`.

- **Hedef mascot boyutu + şehir kayması (2026-08-02)** — Vision board Puhu 96px. Tek overlay
  `MapCanvas` içinde. Sıra: **önce zoom**, bitince maskot park → şehir (~450ms). Zoom sırasında
  maskot sol üstte bekler (`%` kovalamaz → titreme yok). Şehirler arası: yeniden zoom, sonra kayma.
  İlgili: `map-canvas.tsx`, `use-map-viewport.ts`, `vision-board-shell.tsx`.

- **KPSS hedef arayüzü (2026-08-03)** — `vision_boards` artık üç ayrı hedef kolonu taşıyor:
  `target_university_id` (YKS), `target_title_id` + `target_institution_id` (KPSS). Polimorfik tek
  kolon yerine üç açık kolon — tip güvenli, sorgusu okunur, hangisinin dolduğu sınav türünden belli.
  **Çapa unvan, kurum ikincil.** Kadro tek bir yerleştirme dönemine ait geçici bir ilandır; "hedefim
  şu kadro" altı ay sonra anlamsız bir satıra dönerdi. Unvan kalıcıdır.
  `KpssBrowser` `MapBrowser`'ın *varyantı değil, muadili*: YKS hedefi şehir → üniversite → program
  zinciriyle daralır, KPSS hedefi ise şehirden bağımsız bir unvandır. İkisini tek bileşene sokmak
  her dal için bir prop demekti. `vision-board-shell` içindeki bağlantı tek bir üçlü koşul.
  **Servis tarafı:** üniversitede olduğu gibi client'a güvenilmez — `VisionService.upsert`
  `KpssService.assertTargetsExist` ile id'lerin varlığını doğrular, yoksa `unknown_kpss_target`.
  **Şehir çapraz kontrolü yok** (üniversitenin aksine): kurum ulusaldır, bir dönemin ilanları o
  kurumun nerede çalıştığının beyanı değildir — Konya + SGK geçerli bir çifttir.
  **Gotcha 1:** `unchanged` yordamı iki yeni kolonu da listelemeli; eksik kalsaydı unvan değişince
  eski AI motivasyon notu ayakta kalırdı. `vision.service.spec` bunu iki testle kilitliyor (14/14).
  **Gotcha 2:** Kaydederken diğer sınav ailesinin çapaları `null` gönderilir; yoksa YKS'ye geçen
  kullanıcının panosunda eski KPSS unvanı AI notunu beslemeye devam ederdi.
  **Gotcha 3:** Kurum listesi dönem etiketiyle sunulur (`round_note`) — yalnız o kılavuzda ilan
  veren kurumları kapsar. Bu dönem alım yapmayan bir kurumu hedefleyen kullanıcı da hedef koyabilmeli.
  **Kapsam dışı:** il bazlı ilan sayısı rozeti — sayılar zaten şehir seçilince sidebar'da
  (`city_summary` + ilan listesi) görünüyor; 81 ilde ikinci bir gösterim aynı veriyi tekrar eder.
  İlgili: `kpss-browser.tsx`, `use-kpss-targets.ts`, `vision-board-shell.tsx`, `vision.service.ts`,
  `vision-board.repository.ts`, `ai.constants.ts`.

- **KPSS harita + sidebar YKS paritesi (2026-08-03)** — Üç düzeltme, hepsi "YKS'de nasılsa öyle":
  **1. İlan satırları** mor dolgudan `ProgramRow` kalıbına geçti (şeffaf zemin, `hover:bg-black/[0.04]`,
  unvan başta `--color-main`, kurum·kişi·ilçe altta `--color-secondary`). İlan listesi kendi
  `max-h-[22rem]` scroll alanında: bir il 200+ ilan taşıyabiliyor ve rail'i uzatınca arama kutusu
  erişilemez oluyor, harita da kayıyordu. `Group` başlığı da scroll alanının **dışına** alındı —
  içerideyken "UNVANLAR" listeyle birlikte kayıp gidiyordu.
  **2. Harita pinleri.** Üniversitenin koordinatı var, kurumun **yok** — KPSS kılavuzu ilanı en fazla
  il düzeyinde konumlandırıyor (`district` en iyi ihtimalle "MERKEZ"), ilçe geometrisi de repoda yok.
  Guardrail §4 #1 gereği uydurma koordinat konmadı: pin **il centroid'ine** oturuyor — "burada bir
  kurum var" değil, "bu ilde şu kadar ilan var" diyor. İlanı olmayan il pin almaz; boş bir işaret
  "henüz yüklenmedi" gibi okunurdu.
  `CityPostingHoverCard` `UniversityHoverCard` ile aynı konumlama kurallarını paylaşır ama ayrı bir
  bileşendir: ikisi düzende anlaşır, anlamda anlaşmaz — biri gidilebilecek bir yeri, diğeri bir
  kılavuzun ilan ettiği kontenjanı anlatır, bu yüzden dönem kartın üstünde her zaman yazar.
  Tıklama → ili seç + sidebar'da ilanları aç (YKS'de pin → üniversite detayı ile aynı ritim).
  **3. Hedef unvan/kurum** sidebar'dan üst forma **chip** olarak taşındı (`TargetChip`, şehir
  chip'iyle aynı bileşen). Seçilen şey, seçildiği listenin altında değil, ait olduğu alanların
  yanında durmalı. Sidebar'da seçili satır artık yalnız kalın/`--color-main` ile işaretleniyor.
  İlgili: `map-canvas.tsx` (`CityPin`/`CityPinAnchor`), `city-posting-hover-card.tsx`,
  `kpss-browser.tsx`, `vision-board-shell.tsx`, `globals.css` (`.mentor-tr-map-pin`).

- **KPSS pin = YKS silüeti + köşe rozeti (2026-08-04)** — KPSS il pinleri artık YKS kampüs piniyle
  aynı damla + beyaz göz; ilan sayısı pin kafasının içinde değil, sağ üst köşede pill rozet
  (`.mentor-tr-map-pin-badge`). Üç haneli sayılar (Ankara ~199) pin konturunu taşmıyor. Usage: KPSS
  hesabıyla `/hedef` aç, ülke zoom'unda kırmızı pin + sayı rozetini gör. Gotcha: rozet pin
  grubuyla ölçeklenir (`PIN_ZOOM_FOLLOW`); ayrı bir HTML overlay değil. İlgili: `map-canvas.tsx`,
  `globals.css`.

- **KPSS sidebar: tek scroll, tam genişlik (2026-08-04)** — Unvan listesi ve il ilanları kendi
  `max-h` + `mentor-scrollarea` kutularını bıraktı; yalnızca rail scroll ediyor (YKS `MapBrowser`
  gibi). İç içe `scrollbar-gutter: stable` listeyi dar gösterip üç scrollbar üretiyordu. Şehir
  seçilmeden "Haritadan bir şehir seç." metni de kalktı — harita zaten yönlendiriyor. Usage: KPSS
  `/hedef`, unvanı aç/kapa + şehir seç; tek scrollbar görmelisin. İlgili: `kpss-browser.tsx`,
  `messages/{tr,en}.json`.

- **Unvan listesi katlandı + seçili unvan haritayı süzüyor (2026-08-03)** — Ekran görüntüsünde
  MÜHENDİS hedef olarak seçiliyken Ankara pininde **199** yazıyordu: o, Ankara'nın *tüm* ilanları.
  Filtre yalnız **yazarken** çalışıyordu, unvanı **seçince** çalışmıyordu — yani ekran "hedefin
  mühendislik" derken haritada mühendislikle ilgisi olmayan bir sayı gösteriyordu.
  `city-counts` artık `titleId` de alıyor ve **id ile tam eşleşme** yapıyor; ada göre eşleşseydi
  MÜHENDİS seçimi İNŞAAT MÜHENDİSİ'ni de içine çeker, kullanıcının kendi hedefinin nerede alındığını
  olduğundan fazla gösterirdi. `titleId` `q`'yu yener: hedef kalıcı soru, arama kutusu geçici.
  **Unvan listesi `<details>` ile katlandı** (varsayılan kapalı). Açıkken 52 satır tüm rail'i yiyor
  ve haritaya tıklandığında okunacak asıl şeyi — ilin ilanlarını — ekranın altına itiyordu. Ayrıca
  YKS'deki üniversite listesinin muadili değil: o liste **seçili ile** kapsamlı, bu ise bağlamsız
  düz bir katalog ve üstündeki arama kutusu 52 satırı kaydırmaktan hızlı buluyor. "Adını
  bilmiyorum, seçenekleri göster" için duruyor, gerisinde yoldan çekiliyor.
  Native `<details>` — state yok, JS yok, klavye ve ekran okuyucu bedava. Özet satırı seçili unvanı
  taşıyor, yani katlamak seçimi gizlemiyor.
  **Pin taşması:** 3 haneli sayı pin başlığından taşıyordu (Ankara'nın 199'u konturun üstüne
  biniyordu); `>= 100` için font 7.5 → 5.5. Bir ilde 1000+ kontenjan bir dönemde oluşmuyor,
  dolayısıyla üçüncü kademe gereksiz.
  Spec: `kpss.service.spec` 5 test (filtresiz / katlama / id ile daraltma / id'nin q'yu yenmesi /
  eşik altı). İlgili: `kpss.repository.ts`, `kpss.service.ts`, `geo.controller.ts`,
  `kpss-browser.tsx` (`TitlePicker`), `use-kpss-targets.ts`, `map-canvas.tsx`.

- **KPSS öğrenim düzeyi — `users.examVariant` (2026-08-04)** — İki hata birden kapandı.
  **1. Yanlış geri sayım.** `exams` tablosunda KPSS üç satır (lisans/önlisans/ortaöğretim, sınav
  tarihleri 12/19/26 Temmuz) ama `users.examType` yalnız `"KPSS"` idi.
  [`selectExamForCountdown`](apps/api/src/modules/content/domain/calendar.util.ts) `isCurrent`
  taşıyan satırı tercih ediyor ve o yalnız lisansta — yani **ortaöğretim adayı 12 Temmuz'a geri
  sayıyordu**. `ExamCandidate` `variant` alanını zaten taşıyordu, sadece süzmüyordu; düzeltme saf
  fonksiyonda. Bilinmeyen/eski bir variant tüm aileye düşer: profildeki bayat bir değer geri sayımı
  komple boşaltmamalı.
  **2. Yanlış ilanlar.** `kpss_postings.education_level` dolu ama hiçbir sorgu süzmüyordu. Artık
  `/kpss-targets`, `city-counts` ve `cities/:cityCode` opsiyonel `level` alıyor.
  **Yalnız sayılar daralıyor, unvan listesi bütün kalıyor** — hedef bir kariyerdir; bu dönem o
  düzeyde ilan çıkmamış bir unvanı hedeflemek meşrudur.
  **Servis kuralı:** `examVariant` yalnız KPSS ile anlamlı;
  [`resolveExamVariantPatch`](apps/api/src/modules/identity/application/users.service.ts) başka
  ailede `null`'a indirir — client göndermese bile. Yoksa KPSS→YKS→KPSS geçişi arkada bir
  ORTAOGRETIM işareti bırakır ve arayüzde hiçbir iz olmadan geri sayımı ve haritayı daraltırdı.
  Tek variant değişikliği (`examType` gelmeden) mevcut aileyi okumak için ek bir sorgu yapar;
  diğer tüm yollar tek yazma olarak kalır.
  **Gotcha 1:** Uçlar `@Public()` ve cache'li, bu yüzden `level` oturumdan değil query'den gelir;
  tanınmayan değer **reddedilmez, düşürülür** — en kötü ihtimalle bu parametreden önceki süzgeçsiz
  görünüm çıkar, 400 ise bir yazım hatası yüzünden haritayı komple kırardı.
  **Gotcha 2:** `AuthUser.examVariant` zorunlu alan olarak eklenince TypeScript **8 e2e fixture'ını**
  yakaladı; hepsine `null` verildi (süzgeçsiz = eski davranış, mevcut assert'ler geçerli kalır).
  **Gotcha 3:** `CoachContext.examVariant` bilinçli olarak `CoachPersonalizationDto`'ya
  kopyalanmadı — o kalıcı bir denetim anlık görüntüsü; buradaki alan yalnız resmî EXAM_DATE
  cevabının doğru kılavuzu çözmesi için var.
  Spec: `calendar.util` (variant seçimi + bayat variant fallback), `users.service`
  (`resolveExamVariantPatch` dört senaryo).
  İlgili: `calendar.util.ts`, `content.service.ts`, `content.port.ts`, `users.service.ts`,
  `kpss.repository.ts`, `geo.controller.ts`, `exam-step.tsx`, `account-links-card.tsx`,
  `use-kpss-targets.ts`.

- **Hedef panosu → kolaj panosu: veri + kontrat (2026-08-05, PR 1/3)** — Hedef bugüne kadar
  *veriydi* (başlık + kariyer enum'ı + 4 referans id'si). Artık kullanıcının kendi görsellerini ve
  metinlerini yerleştirdiği bir **kolaj** taşıyabiliyor. Bu PR yalnız backend + sözleşme; editör
  (PR 2) ve stil/export/panel kartı (PR 3) ayrı.
  **Tek `vision_boards.board jsonb` kolonu** (`0075_vision_board_document.sql`) —
  `{ version, status, frame, background, items[] }`. Ayrı `vision_board_items` tablosu değil:
  item'lar her zaman bütün doküman olarak okunup yazılıyor, satırlar yalnız join getirirdi.
  `status` da doküman içinde; bugün hiçbir sorgu ona göre süzmüyor.
  **🔴 Neden ayrı endpoint (bu PR'ın asıl mimari kararı):** `PUT /v1/coaching/vision/board`
  yalnız `board` kolonunu yazar. `POST /vision` (hedef upsert'ü) içindeki `unchanged` predicate'i
  hedef değiştiğinde premium AI notunu null'lıyor — bir çıkartmayı sürüklemek hedef değişikliği
  **değildir**. İkisi tek uçtan geçseydi her sürükleme yeni bir LLM çağrısı faturalardı (§7).
  `board` bu yüzden `unchanged`'e **girmiyor**; `vision.service.spec` bunu ayrı bir testle kilitliyor.
  **Okuma yolu ayrı uç değil:** doküman `VisionDto.board` üzerinde geliyor. Panel kartı ve editör
  zaten `GET /coaching/vision` çağırıyor; ikinci bir GET yalnız waterfall üretirdi (planda 3 uç
  vardı, 2'ye indi).
  **Güvenlik:** görsel key'i `vision-board/{userId}/{uuid}.{ext}` şeklinde; zod **biçimi**,
  `putBoard` **sahipliği** doğruluyor (`foreign_storage_key`). Zod userId'yi bilemez, servis
  biçimi tekrar kontrol etmez — ikisi birlikte kapıyı kapatıyor. `sticker.asset` kapalı bir enum,
  serbest URL değil: doküman olduğu gibi render edildiği için `src` alanı görsel enjeksiyonu olurdu.
  Limitler: 60 item / 20 görsel / 30 metin (jsonb her `/vision` okumasında dönüyor, panel kartı
  görsellerin hepsini birden yüklüyor).
  **KVKK — iki delik birden:** (1) board'dan çıkarılan fotoğrafın R2 objesi siliniyor
  (`putBoard` eski/yeni key setlerini diff'liyor, tx dışında best-effort). Bu olmasa silinen
  fotoğraf public URL'iyle sonsuza kadar kalırdı. (2) `coaching-erasure.repository` satırı silmeden
  **önce** `board->items` key'lerini okuyor; jsonb dışında bu objelere işaret eden hiçbir şey yok,
  satır gidince bir daha bulunamazlardı.
  **Gotcha 1 (mimari):** orphan diff'i başta `updateBoard`'dan *sonra* `before.board` okuyordu ve
  test fake'i aynı objeyi döndürdüğü için hiçbir şey silinmedi. Gerçek Drizzle detached satır
  döndürdüğü için üretimde çalışırdı — yani sessizce repository'nin obje kimliğine bağlıydı.
  Eski key seti artık yazmadan **önce** snapshot'lanıyor.
  **Gotcha 2 (migration):** `drizzle-kit generate` **kullanılamıyor**. `0074` bilinçli olarak elle
  yazılmış (backfill) ama `meta/0074_snapshot.json` hiç üretilmemiş; generator hâlâ `0073`'e karşı
  diff alıp `kpss_postings.dataset_id`'yi soruyor ve zaten uygulanmış DDL'i yeniden üretiyor. `0075`
  bu yüzden elle yazıldı. Snapshot zinciri onarılana kadar her şema değişikliği elle yazılacak.
  **Gotcha 3 (test):** `vision.service.spec`'teki `USER` sabiti `"u1"` idi; board key şeması
  userId'nin uuid olmasını şart koştuğu için gerçek bir uuid'ye çevrildi.
  **Not:** `apps/web` build'i `popover-menu.tsx`'te framer-motion↔React 19 tip uyuşmazlığıyla
  kırık — bu PR'dan önce de kırıktı (temiz ağaçta doğrulandı), burayla ilgisi yok.
  Spec: `vision.service.spec` +11 test (AI notu korunuyor · yabancı key · hedefsiz board ·
  orphan silme/koruma · goal upsert board'u ezmiyor · şema limitleri).
  İlgili: `schema.ts`, `0075_vision_board_document.sql`, `vision-board.repository.ts`
  (`updateBoard`), `vision.service.ts` (`putBoard`), `vision-board-image.service.ts`,
  `coaching.controller.ts`, `coaching-erasure.repository.ts`, `r2-storage.adapter.ts`
  (`vision-board/` prefix'i), `packages/validation/src/coaching.ts`, `packages/types/src/coaching.ts`.

- **Hedef panosu → kolaj editörü çekirdeği (2026-08-06, PR 2/3)** — `/hedef/pano`
  (`vision-board/board`) açıldı: görsel yükleme, metin bloğu, taşı/boyutlandır/döndür, undo/redo,
  taslak kaydetme. Stil katmanı (arka planlar, fontlar, çıkartmalar, şablonlar), canvas export ve
  panel kartı PR 3'te.
  **Ölçüm yok — `cqw` var.** Sahne `container-type: inline-size` taşıyor ve her uzunluk
  `cqw` cinsinden (`cq(px)` yardımcısı, 1620 birimlik tasarım uzayına göre). Böylece aynı doküman
  tam ekran editörde de panel kartındaki küçük önizlemede de ResizeObserver olmadan doğru render
  ediliyor. `cqw` konteynerin **genişliğinin** payı olduğu ve sahnenin oranı sabit olduğu için her
  iki eksen de canvas genişliğine bölünüyor.
  **`BoardStage` tek render kaynağı.** Editör seçim çerçevesini ve tutamakları sahnenin *etrafına*
  sarıyor, içine değil — iki ayrı renderer yazılsaydı sapma yalnızca "panom panelde bozuk görünüyor"
  olarak ortaya çıkardı.
  **Tek pointer sistemi** (`use-item-gesture` + saf `board-gesture-math`). framer-motion `drag`
  yalnız taşımayı çözerdi; resize/rotate matematiği zaten elle yazılacaktı ve tek elemanı paylaşan
  iki sistem, sürüklemeden ölçeklemeye geçerken fotoğrafı zıplatır. Döndürülmüş bir öğe kendi
  eksenlerinde büyüsün diye ekran deltası `toLocalDelta` ile öğenin eksenlerine çevriliyor.
  **Görsel URL'i sunucudan geliyor.** `VisionBoardImageItem.url` her okumada türetiliyor, yazma
  şeması tarafından atılıyor — client bunu üretemez: R2 mutlak CDN URL'i, dev'deki fake store ise
  API-göreli bir yol döndürüyor, yani `NEXT_PUBLIC_` bir base'in taşıyabileceği ortak bir kök yok.
  **Gotcha 1 (undo):** ilk sürümde gesture pointer-UP'ta commit ediyordu. Transient patch'ler
  `doc`'u zaten ilerlettiği için undo yığınına sürüklemenin **bittiği** yer yazılıyordu ve undo
  hiçbir şey yapmıyordu. Snapshot artık ilk harekette (`checkpoint`) alınıyor — dokümanın
  sürükleme öncesi hali yalnız o an hâlâ mevcut. `use-board-reducer.spec` bunu kilitliyor.
  **Gotcha 2 (`next build` tsconfig'i yeniden yazıyor):** `apps/web/tsconfig.json`'a konan JSONC
  yorumları build sırasında dosyanın tümüyle yeniden üretilmesine ve `paths` girdilerinin
  **silinmesine** yol açtı. Oraya asla açıklama yazma; gerekçe `apps/web/AGENTS.md`'de. Yorumsuz
  girdiler build'e dayanıyor.
  **Gotcha 3 (React tipleri):** `apps/admin` React 18 olduğu için pnpm `@types/react@18`'i hoist
  ediyor; kendi `@types/react`'ini deklare etmeyen paketler (framer-motion) 18'in tiplerini
  çözüyor, bizim kod ise 19'da. İki `ReactNode` birleşimi karşılıklı atanamıyor →
  `motion.div`'e `ReactNode` değişkeni `children` olarak geçince derleme hatası. `apps/web`
  `tsconfig` `paths`'inde React tipleri sabitlendi; `pnpm.overrides` çözemez (framer-motion'ın
  override edilecek bir `@types/react` kenarı yok).
  **Yan iş — `apps/web` testleri artık gerçekten çalışıyor.** `src/**/*.spec.ts` altında 9 dosya
  birikmişti ama pakette `test` script'i yoktu, yani `turbo run test` paketi komple atlıyordu ve CI
  onları hiç çalıştırmıyordu (dosyaların başındaki "apps/api'nin runner'ı kullanılıyor" notu
  gerçekte işlemiyordu: api'nin vitest `include`'u apps/web'e ulaşmıyor). Vitest + `test` script'i
  eklendi; bu, `vitest` çözülemediği için konmuş 9 bayat `@ts-expect-error` direktifini ve
  `weekly-recap.spec.ts`'te gizli kalmış bir tip hatasını açığa çıkardı — hepsi temizlendi.
  Toplam 122 test yeşil.
  **Yan iş — React Compiler lint hataları.** `turbo` cache'i yeşil sonuç replay ettiği için 13
  `react-hooks/refs` hatası gizli kalmıştı (`--force` ile ortaya çıktı). `use-map-viewport.ts`'teki
  render-time ref yazımı **gereksizdi** (her `setView` zaten ref'i güncelliyor) → silindi;
  `map-canvas`'taki latest-callback ref'i ve `desktop-coach-fab`'daki offset mirror'ı effect'e
  taşındı; mascot docking bayrağı ref yerine state'e çevrildi (ref okuması türev zinciri boyunca
  yayılıyor ve JSX kullanım noktasını da kirletiyordu). Hepsi 0 hataya indi.
  Spec: `use-board-reducer.spec` 15 test (undo/redo, 30 adım sınırı, transient patch, z sıralaması),
  `board-gesture-math.spec` 19 test (eksen dönüşümü, köşe resize, oran kilidi, açı normalizasyonu).
  İlgili: `components/vision-board/{board-stage,board-item-view,board-frame,board-document,board-stickers}`,
  `vision-board/board/_components/*`, `lib/vision-board-images.ts`, `i18n/routing.ts`,
  `messages/{tr,en}.json` (`vision.board.*`, 23 anahtar).

- **Hedef panosu → stil, export, yayınlama (2026-08-06, PR 3/3)** — Kolaj tamamlandı: arka planlar,
  dış/görsel çerçeveleri, fontlar, çıkartmalar, şablonlar, bağlama duyarlı üst bar, PNG indirme,
  cihazın paylaş sayfası, yayınlama ve panel kartının board görünümü.
  **Export elle yazılmış Canvas 2D** (`board-export.ts`, ~300 satır) — html2canvas yok, sunucu
  render yok. Doküman zaten "blok bazlı stille dikdörtgenler listesi", yani `drawImage`/`fillText`
  onu doğrudan çiziyor. Bu **yalnızca metin modeli karakter değil blok bazlı olduğu için** geçerli;
  satır içi biçimlendirme eklenirse bu dosya bir metin motoruna dönüşür.
  **Sapma riskini kapatan şey:** satır sarma, `object-fit: cover` kırpması ve çerçeve içi boşlukları
  `board-export-layout.ts`'te, DOM renderer'ıyla **paylaşılan saf fonksiyonlarda**. İki renderer'ın
  sessizce ayrışması aksi halde ancak kullanıcı PNG'yi indirince fark edilirdi.
  **Fontlar `document.fonts.ready` beklenerek** ölçülüyor — web font inmeden ölçüm yapmak metni
  fallback yüze göre sarar ve PNG ekrandakinden farklı dizilir.
  **Tainted canvas sessizce yutulmuyor:** `BoardExportTaintedError` ayrı bir mesaj gösteriyor
  ("görseller indirmeye kapalı geldi"), çünkü boş bir PNG döndürmek kullanıcıya *kendi panosunun*
  bozuk olduğunu düşündürürdü. R2 public bucket'ında CORS şart.
  **`el yazısı` fontu (Caveat) yalnız pano metinlerinde** — uygulama kroması tek DESIGN.md ailesinde
  kalıyor. Kolajın arayüzün sesinden farklı bir sese ihtiyacı var, chrome'un yok.
  **Panel kartı stored thumbnail kullanmıyor:** yayınlanmış board, editörün kullandığı `BoardStage`
  ile `readOnly` render ediliyor. Böylece thumbnail üretimi/yükleme/bayatlama/orphan temizliği diye
  bir alt sistem hiç doğmadı ve pano her zaman güncel.
  **Kaydet diyaloğu panoya davete dönüştü** — kullanıcı hedefine tam da o an bağlanıyor; reddetmek
  onu haritada bırakıyor, pano opsiyonel kalıyor.
  **Gotcha 1 (`blob:` URL'i):** `resolveApiUrl` yalnız http(s) tanıyor ve başka her şeyin başına API
  base'ini ekliyor — yeni yüklenen fotoğrafın `blob:` önizlemesini hem editörde hem export'ta
  bozuyordu. `boardImageSrc`/`needsCrossOrigin` bunu ayırıyor; `blob:` aynı origin olduğu için
  `crossOrigin` de verilmemeli, yoksa düz bir yükleme gereksiz yere CORS isteğine dönüşüyor.
  **Gotcha 2 (fake storage):** PR 1'de R2'ye `vision-board/` prefix'i eklenmişti ama
  `fake-storage.controller.ts`'teki `limitsForKey` dalı unutulmuştu; dev'de default allowlist'e
  (jpeg+png) düşüp **webp yüklemeleri reddediliyordu**. Eklendi.
  **Gotcha 3 (`targetCity` bayat kolonu — kapandı):** `VisionDto.targetNames` artık okuma başına
  çözülüyor. Harita yalnız `targetCityCode` yazdığı için panel kartındaki şehir chip'i ve panonun
  seed metni boş kalıyordu; `resolveNames` null id'lerde kısa devre yaptığı için hedefi olmayan
  kullanıcıya ek sorgu maliyeti yok.
  **Gotcha 4 (şablon uygularken veri kaybı):** `applyTemplate` mevcut görselleri slot'lara
  **yeniden akıtıyor**, silmiyor; sadece dokunulmamış `source: "goal"` metnini yeniden konumlandırıyor.
  Bir düzen denemek yüzünden yüklenmiş fotoğrafları kaybetmek en kötü sürpriz olurdu.
  Spec: `board-export-layout.spec` 27 test (satır sarma + uzun kelime kırma, cover kırpması, sıfır
  boyutlu kaynak, çerçeve boşlukları, `blob:`/`data:`/mutlak/göreli URL ayrımı),
  `vision.service.spec` 29 test (+`targetNames` çözümü).
  İlgili: `board-export.ts`, `board-export-layout.ts`, `board-toolbar.tsx`, `board-templates.ts`,
  `board-stickers.ts`, `vision-board-card.tsx`, `vision.service.ts` (`enrich`),
  `fake-storage.controller.ts`, `[locale]/layout.tsx` (Caveat), `messages/{tr,en}.json` (82 anahtar).

- **Vision board orphan süpürme + R2 hazırlığı (2026-08-07)** — `putBoard` panodan çıkarılan
  fotoğrafları zaten siliyordu; göremediği sızıntı şuydu: **editörde görsel yükleyip hiç
  kaydetmeden çıkan** kullanıcının objesi. Hiçbir kayıt ona işaret etmediği için bir daha
  bulunamıyordu — ve bu, public URL'de duran kişisel veri demek (KVKK). Maliyet gerekçe değil,
  ihmal edilebilir düzeyde.
  `VisionService.cleanupOrphanImages()` + `VisionBoardMaintenanceService` (6 saatte bir, forum'un
  `ForumMaintenanceService`'ini birebir izler). Forum'un aksine bekleyen-yükleme ledger'ı yok, o
  yüzden bucket listeleniyor: `StoragePort.listObjects(prefix, limit)` eklendi (R2'de
  `ListObjectsV2`, fake'te `.fake-storage` okuması).
  **Süpürme coaching modülünde, forum cron'una eklenmedi** — `vision_boards` coaching'in tablosu,
  forum servisinin ona uzanması bounded-context sınırını ihlal ederdi (workstreams §2).
  **İki koruma:** 24 saatlik grace window (devam eden bir düzenleme oturumunun yüklemeleri
  silinmemeli) ve **`lastModified` null ise obje "genç" sayılır** — bilinmeyen yaşta asla silme.
  Referanslı anahtarlar SQL'de `jsonb_array_elements` ile açılıyor
  (`listAllReferencedImageKeys`); tüm pano belgelerini API'ye taşıyıp atmak, fotoğraf sayısıyla
  değil kolaj büyüklüğüyle ölçeklenirdi.
  Ayrıca `content/articles` boyut limiti fake controller'dan `content.constants.ts`'e taşındı
  (aynı sayı iki yerde duruyordu).
  Spec: `vision.service.spec` +5 test (referanssız+eski → silinir · panoda geçen → kalır · yeni
  yüklenen → kalır · yaşı bilinmeyen → kalır · boş sayfada DB'ye gidilmez).
  Kurulum: [`docs/core/storage-r2.md`](docs/core/storage-r2.md).

- **Editör cilası: çerçeve tekrarı, kayma, font, ilerleme, thumbnail, drag&drop (2026-08-08)** —
  ekran görüntüsü incelemesinden çıkan sekiz düzeltme. Sidebar detay paneli
  `--color-surface-container` (gri) yerine `--color-surface` kullanıyor artık. Context toolbar,
  görsel çerçevesi seçeneklerini sidebar ile **birebir tekrar ediyordu** (metin buton + ilk 3 ikon)
  — tek bir `Frame` ikon tetikleyicisine indirgendi, tam liste yalnız sidebar'da kalıyor.
  Toolbar `AnimatePresence` ile mount/unmount olurken canvas'ı dikeyde kaydırıyordu (`flex-col`
  içinde rezerve alan yoktu) — `min-h-[52px]` sarmalayıcı + `w-fit` ile hem kayma hem tam-genişlik
  gerilmesi düzeltildi. Sol kolona `pt-4` boşluk eklendi.
  **Font bug'ı:** `font: "heading"` görsel olarak `"body"` ile **birebir aynıydı**
  (`--font-heading` → `globals.css`'te `--font-body`'ye alias) ve `serif` DESIGN sistemine
  bağlanmamış sabit `Georgia` idi — `VISION_TEXT_FONTS` fiilen 4 değil 3 farklı görünüme sahipti.
  Caveat/`--font-script` deseni izlenerek 5 yeni `next/font/google` yüklemesi eklendi (Poppins,
  Playfair Display, Baloo 2, Oswald, Merriweather → `--font-vision-*`), enum 7 değere çıktı
  (ek: `rounded`, `condensed`, `classic`). **Gotcha:** DOM render'ı (`board-item-view.tsx`
  `FONT_STACKS`) ve canvas PNG exporter'ı (`board-export.ts` `FONT_FAMILIES`) **iki ayrı harita** —
  biri güncellenip diğeri unutulursa ekrandaki pano indirilen PNG ile uyuşmaz; artık
  `board-text-fonts.spec.ts` ikisinin anahtar kümesini `VISION_TEXT_FONTS`'a karşı doğruluyor.
  Kaydet/yayınla/indir/paylaş'a `@mentor/ui` `Button`'daki spinner deseni eklendi; çoklu görsel
  yüklemede `@mentor/ui` `ProgressBar` ile tamamlanan/toplam gösteriliyor (bayt bazlı değil, dosya
  sayacı — `uploadBoardImage` hâlâ `fetch`, XHR'a geçmedi). Sidebar'ın "Görsel" kategorisine
  panodaki görsellerin thumbnail grid'i eklendi, tıklayınca canvas'ta seçili hale geliyor. Canvas
  alanına `onDragOver`/`onDrop` ile sürükle-bırak yükleme eklendi (mevcut `addImages` doğrulaması
  aynen kullanılıyor — tip/boyut/limit kontrolleri tekrar yazılmadı).
  İlgili: `board-editor-shell.tsx`, `board-context-toolbar.tsx`, `board-side-panel.tsx`,
  `board-item-view.tsx`, `board-export.ts`, `[locale]/layout.tsx`, `packages/types/src/coaching.ts`,
  `board-text-fonts.spec.ts`, `messages/{tr,en}.json` (+7 anahtar).
