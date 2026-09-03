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

- **KVKK erasure — `plan_tasks.description` de siliniyor (2026-09-03)** — `CoachingErasureRepository`
  `plan_tasks`'ı sadece `title: ERASED_TASK_TITLE` ile scrub ediyordu; öğrencinin kendi serbest metin
  notu olan `description` erasure'dan sağ çıkıyordu. Oysa bu, `study_sessions.struggleNote` ile aynı
  sınıf veri ve `domain/cohort-evidence.ts` trust-line kontratında "DELIBERATELY ABSENT" olarak
  adı geçiyor. Gözden kaçmış — `.set(...)` çağrısına `description: null` eklendi.
  **İlgili:** `infrastructure/coaching-erasure.repository.ts`, `apps/api/test/account-erasure.e2e-spec.ts`.

- **`PlanService.clearMentorshipOrigin` (2026-09-02)** — W8 erasure seam'i. Bir koç hesabı KVKK ile
  silindiğinde `coach_students` satırları gidiyor, ama `plan_tasks.origin_ref_id` FK'sız soft ref
  olduğu için öğrencinin ödevleri `origin_type='MENTORSHIP'` olarak kalıyor ve API onları düzenlemeye
  kapalı tutmaya devam ediyordu. Bu metod o satırların provenance'ını (`origin_type/ref/meta`)
  temizliyor. **Kullanım:** `MentorshipErasureService` çağırıyor; silinen bağ id'lerini alıp
  geçiyor. **Gotcha:** cross-user bir yazma (satırlar ÖĞRENCİlere ait), bu yüzden
  `withServiceContext` içinde koşuyor; görev satırı silinmiyor, yalnız kaynağı unutuluyor.
  **İlgili:** `application/plan.service.ts`, `infrastructure/plan-task.repository.ts`,
  [`mentorship.md`](./mentorship.md).

- **`PlanService.createFromMentorship` + koç-ataması düzenleme kilidi (APP-065, 2026-09-02)** —
  İnsan koçun (W8) ödev yazdığı public seam. `plan_tasks` yazma hakkı W2'de kalıyor; W8 bu metodu
  çağırıyor, tabloya dokunmuyor. `origin_type='MENTORSHIP'`, `origin_ref_id=coach_students.id`,
  `origin_meta` null (migration `0094`).
  **Kullanım:** çağıran, `MentorshipLinkService.requireActiveLink`'i geçmiş olmalı; metod verilen
  `linkId`'ye güvenir. `createMany` gibi all-or-nothing.
  **Gotchas:** (1) Bu, `createFromAiCoach`/`createFromCommunityCoach`'taki "kullanıcı onaylamadan
  yazılmaz" kuralının **bilinçli istisnası** — gerekçe atamanın daha güvenli olması değil, rızanın
  başka yerde alınmış olması: öğrenci bu koçu açıkça kabul etti, bağı ve görevi istediği an
  kaldırabilir. AI önerisinin arkasında böyle bir irade beyanı yok. (2) `update`, MENTORSHIP
  görevlerinde yalnız `status` değişimine izin verir; başlık/tarih/ders denemesi
  `COACHING_TASK_COACH_ASSIGNED` (403). `delete` serbest. (3) Aynı kural **plan uyarlamasında da**
  geçerli: `getAdaptationSnapshot` koç görevlerini aday listesinden çıkarır (AI hiç önermez) ve
  `applyAdaptation`'ın MOVE yolu elle hazırlanmış bir isteği reddeder. `planRevision` yine TÜM
  satırlardan hesaplanır, yoksa koç görevindeki eşzamanlı bir değişiklik uyarlamayı geçersiz
  kılmazdı. **İlgili:**
  `application/plan.service.ts`, `application/coaching.mappers.ts`, [`mentorship.md`](./mentorship.md).

- **Koç agrega sınırı — `CohortEvidenceService` (APP-064, 2026-09-02)** — İnsan koçun (W8) öğrenci
  verisine bakabildiği TEK kapı. `CoachEvidenceService`'in kardeşi: o AI için tek kullanıcıya
  lokalize düzyazı üretir, bu koç için N öğrenciye sayı üretir. `listCohortSnapshots(ids)` roster
  için altı batch sorgu (kohort boyutundan bağımsız), `getStudentReport(id)` tek öğrenci detayı.
  Sözleşme `domain/cohort-evidence.ts`'te ve neyin **dışarıda bırakıldığını** tek tek sayıyor.
  **Kullanım:** `CoachingModule` export ediyor; W8 `MentorshipRosterService` tüketiyor. Çağırandan
  önce `MentorshipLinkService.requireActiveLink` geçilmiş olmalı — repository verilen id'lere güvenir.
  **Gotchas:** (1) `select *` yasak, her kolon açıkça sayılıyor; yeni bir serbest metin kolonu bu
  yüzden kazara koça sızamaz. (2) `planCompletionRate7d` hiç plan yoksa **null**, sıfır değil —
  planlamamış öğrenci başarısız olmuş sayılmaz. (3) `previousMockNetAvg` son denemeden önceki üç
  denemenin ortalaması, pencere fonksiyonuyla aynı sorguda; ilk denemede null. (4) Sentinel testi
  (`cohort-evidence.service.spec.ts`) fake satırlara `struggleNote` gibi alanlar koyup çıktıda
  geçmediğini doğruluyor. **İlgili:** `modules/coaching/{domain/cohort-evidence.ts,application/cohort-evidence.service.ts,infrastructure/cohort-evidence.repository.ts}`,
  [`mentorship.md`](./mentorship.md).

- **Çalışılmış gün sinyali dışa açıldı (2026-08-30)** — `StreakService.listActiveDatesSince(userId,
  windowDays)`: son N günün çalışılmış tarihleri (≥1 tamamlanmış seans VEYA ≥1 biten görev), türetme
  yapmadan. İlk tüketici promotions (`ACTIVE_DAYS` indirim kuralı). Yeni sorgu yok — mevcut
  `DailyActivityRepository.listActiveDatesSince` sarmalayıcısı. Kullanım: `CoachingModule` zaten
  `StreakService`'i export ediyor, import yeterli. Gotcha: `daily_activity` **çalışılan** günü
  tutar, ziyaret edileni değil — "siteyi açtı" diye bir sinyal yok ve olmamalı (roadmap §3).
  İlgili: `streak.service.ts`, [promotions.md](./promotions.md).

- **Yoldaşlık sesi Dalga 19 — hayalet / defter ödül fiili (2026-08-29)** — `ghost.TIED` ve `notebook_pattern.READING` companion: kazanç/öne geç/net kazandırır kalktı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: `NEW_RECORD` / `BEAT_PREVIOUS` kişisel rekor durdu; `RUSHING` durdu. İlgili: `apps/api/src/i18n/locales/{tr,en}/coaching.json`.

- **Yoldaşlık sesi Dalga 17 — form kontrol et (2026-08-29)** — Resmî bilgi `UNAVAILABLE` “kontrol edebilirsin” kalktı. `RUSHING` durdu. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). İlgili: `apps/api/src/i18n/locales/{tr,en}/coaching.json`.

- **Yoldaşlık sesi Dalga 15 — uzun çizgi (2026-08-29)** — Mood/motivasyon/ghost/notebook companion fallback’lerde em dash kalktı. `SERIOUS_DISTRESS` durdu. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). İlgili: `apps/api/src/i18n/locales/{tr,en}/coaching.json`.

- **Yoldaşlık sesi Dalga 13 — derin analiz hak (2026-08-29)** — `analysis.deep.insufficient` companion: görevlerden hak düşer, “kazanabilirsin” yok. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: `go_earn` “Görevlere git” durdu. İlgili: `apps/web/messages/{tr,en}.json`.

- **Yoldaşlık sesi Dalga 10 — seri kurtarma (2026-08-29)** — Panel teklif companion dondurma (FOMO yok); başarı sheet Puhu “Serin yerinde.” Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: `?mockStreakRescueSuccess=1` başarı kopyasını gösterir. İlgili: `apps/web/messages/{tr,en}.json`, `streak-rescue-success.tsx`.

- **Yoldaşlık sesi Dalga 4 — seans / masa / buddy / vizyon (2026-08-29)** — İlk ziyaret empty Puhu: `session.history_empty`, `session_room.empty`, `session.buddy_empty` / `buddy_empty_hint`, `vision.empty`, `coach.conversations.history_empty`. Filtre/hata companion: `history_empty_filtered`, `history_error`; vizyon arama `search_empty` / `filter_programs_empty`. `seat_empty` etiket kaldı. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: resmi tarih paraphrase yok. İlgili: `apps/web/messages/{tr,en}.json`.

- **Yoldaşlık sesi Dalga 3 — plan empty (2026-08-28)** — `today_plan.empty_desc`, `plan.empty_desc`, `panel.today_focus_empty` Puhu (“bugün henüz bir iz yok”); `timeline_day_empty` / `pending_empty` companion. Kullanım: [`docs/copy/voice.md`](../copy/voice.md). Gotcha: seans geçmişi empty Dalga 3 dışı. İlgili: `apps/web/messages/{tr,en}.json`.

- **Yoldaşlık sesi Dalga 2 — mood / onboarding / paywall (2026-08-28)** — `coaching.json` mood (SERIOUS_DISTRESS hariç), motivation, nextAction, calibration companion kaydına çekildi: sen, kısa, suçluluk yok. Web `coach` + `coach_chat` + `mood` + `welcome` + `onboarding` + `paywall` + `campaign` TR/EN aynı kılavuz; boş sohbet ve FAB Puhu chrome, form hataları insan cümlesi (`Kaydedilemedi.` kalktı). Kullanım: `docs/copy/voice.md`. Gotcha: distress ve resmi sınav kopyası dokunulmaz; community/analiz empty Dalga 3. İlgili: `apps/web/messages/{tr,en}.json`, `apps/api/src/i18n/locales/{tr,en}/coaching.json`.

- **Panel geri sayım ikonu + kaynak satırı (2026-08-24)** — `CountdownCard` (DataCard sarmalayıcı)
  Lucide takvim yerine `public/img/hourglass.svg` kullanır; “Kaynak: ÖSYM ↗” alt satırı kalkar
  (tarih hâlâ caption’da, resmi kaynak Bilgi’de durur). SVG’den beyaz zemin ve gölge elipsi
  alındı. İkon kuyusu yok: maske + `--color-main` (açıkta `#111`, karanlıkta `#f4f4f5`),
  boy 40px (`h-10`, Puhu `sm` ölçeği). Kullanım: `/panel` sağ sütun. Gotcha: asset web
  `public/img` altında; ui paketi `/img/hourglass.svg` yolunu bekler. İlgili:
  `countdown-card.tsx`, `panel-shell.tsx`, `hourglass.svg`.

- **Premium kilit rozetleri (2026-08-22)** — Panel günlük selamı ve mood yansıması, analiz ghost
  teaser'ı ve seans sonrası yansıma kilitliyken paywall açar. İlgili: `premium-lock-nudge.tsx`,
  `use-daily-greeting.ts`, `mood-checkin.tsx`, `session-done-state.tsx`.
- **Derin bağlantı parametreleri tek kullanımlık oldu (2026-08-22)** — `?mockExam=` ve `?review=due`
  tüketildikten sonra adres çubuğunda kalıyordu. `mockExam` için bu gerçek bir yanlış atıf:
  yenilemede ekleme paneli tekrar açılıyor ve o sınavın id'si öğrencinin **sonra** kaydettiği
  hatalara damgalanıyor, yani eski bir oturuma ait sayılıyorlar. `review=due` de kapatılan tekrarı
  yenilemede geri açıyordu. İkisi de tüketildiği anda temizleniyor.

  Temizleme mantığı `lib/spent-query-param.ts`'e çıkarıldı: topluluk composer'ındaki
  `notebookEntry` için aynı şey zaten yazılmıştı ve **aynı tuzağı** taşıyor — `router.replace`
  çalışmıyor, çünkü buradaki yollar next-intl'in yerelleştirilmiş hâlleri (`/yanlis-defteri`,
  `/topluluk/akis`) ve istemci yönlendiricisi onları rotalara geri çözmüyor; `history.replaceState`
  gerekiyor. Gerekçe artık tek yerde.

  **Aranan ama bulunamayan:** `?mockExam=` ile gelirken kapağın bir an görünüp spread'e atladığını
  iddia etmiştim. Kod okununca öyle olmadığı görüldü — `setOverview` ile `setView` arasında hiç
  `await` yok, ikisi aynı senkron blokta, yani React tek commit'te birleştiriyor ve kabuk zaten
  `!overview` iken iskelet gösteriyor. İskeletten doğrudan spread'e geçiyor. Düzeltilecek bir şey
  yoktu; iddia doğrulanmadan yapılmıştı.

- **`notebook-shell.tsx` bölündü — ve nerede durulduğu (2026-08-22)** — Dosya 1846 satıra çıkmıştı.
  Bölmenin kuralı şuydu: _taşınan her parça kendi durumunu da götürmeli; bir parçayı ayırmak on yeni
  prop gerektiriyorsa dikiş orada değildir._ Kural uygulanınca çıkan sonuç, planlanandan **daha
  küçük** oldu ve bu kayda değer.

  **Çıkanlar (üçü de bileşen durumuna sıfır bağımlı):**
  `notebook-shell-layout.ts` — `View`/`Side` tipleri, `EMPTY_PAGE`, `AUTOSAVE_DELAY_MS`, boyut
  sabitleri, `MOBILE_QUERY`, `useFitSize`, `fitWithin` (defterin ne kadar büyüyebileceğini altı
  denemede bulan uzun gerekçe dahil).
  `notebook-rail-items.tsx` — `RAIL_CATEGORIES` ve `NotebookRailActiveFill`.
  `use-notebook-ink-settings.ts` — kalem durumu (tool/renk/kalınlık/opaklık) ve tool değişince o
  kalemin kendi ayarlarını yükleyen `changeTool`. İki sayfanın `useInkDraw`'u ve üstteki tepsi aynı
  dört değeri okuyor, yani hangi yaprağa çizilirse çizilsin tek bir kalem var.
  **1846 → 1694 satır.**

  **Çıkmayanlar, ölçülmüş gerekçesiyle:**
  _Ray JSX'i_ (~235 satır) ayrılırsa 20'den fazla prop ister — `activeRail`, `openCategory`,
  `focused`in tamamı, `saving`/`saveNow`, iki sayfanın dirty bayrakları, yan panelin kendi props'ları.
  Bu ayırma değil, prop taşımacılığı olurdu.
  _Veri yükleme efekti_ dokuz setter'a dokunuyor ve beşi UI durumu (`setView`, `setActivePanel`,
  `setDetailCollapsed`, `setReviewing`, `setMockExamId`). Temiz bir `useNotebookData` ancak URL
  niyetini _döndürüp_ UI sonucunu kabuğa bırakarak olurdu — ki o da URL'i mount'ta senkron okumayı
  gerektirir, yani **davranış değişikliği**. Saf bir refactor turunda bunu yapmak, "davranış
  değişmedi, kanıtı e2e" cümlesini yalan yapardı.
  _Diyalog bloğu_ (~62 satır) on beş prop ister; hepsi kabuğun kendi durumu.

  Kalan 1694 satır hâlâ büyük, ama bir tuval editörünün kabuğu gerçekten çok sayıda birbirine bağlı
  durum tutuyor; onu zorla bölmek dosyayı küçültüp kodu kötüleştirirdi. Davranışın değişmediğinin
  kanıtı 36 e2e senaryosunun yeşil kalması.

- **Fix: tekrar destesi uzak barındırıcıdaki fotoğrafta çöküyordu (2026-08-22)** — "Tekrar zamanı"
  çipine basınca dev'de runtime hata: _"Invalid src prop … hostname pub-….r2.dev is not configured
  under images"_. Sebep bende: flashcard'a geçerken soru fotoğrafını düz bir `<img>`'den
  `next/image`'a çevirmiştim ve `unoptimized`'ı düşürmüştüm. Uygulama `images.remotePatterns`
  **hiç tanımlamıyor**, bu yüzden defterdeki her R2 görseli (`notebook-entry-card`,
  `notebook-image-lightbox`, `notebook-add-panel`) baştan beri `unoptimized` geçiyor; kart yeniden
  yazılırken bu kayboldu ve sonraki üç çağrı yeri (çözüm bandı, deste listesi satırı, dizin satırı)
  eksiği kopyaladı. Dördüne de `unoptimized` eklendi.

  **Testler neden yakalamadı:** e2e fixture'ları fotoğraf için yerel `/img/...` yolu kullanıyordu,
  yani optimizer hiç yabancı bir host görmedi. Üstelik kontrol dev overlay'inde patlıyor ve suite
  `next start`'a karşı koşuyor — yani bu sınıf hata bu pakette **zaten görünmez**. Fixture artık
  gerçek bir R2 URL'i kullanıyor (`uzak barındırıcıdaki foto dizinde render edilebiliyor`); bu,
  çökmeyi yeniden üretemez ama yerel-yol körlüğünü kapatır ve niyeti kayda geçirir.
  **Ders:** R2'den gelen bir görseli `next/image` ile render eden her yeni çağrı yeri `unoptimized`
  taşımak zorunda; `remotePatterns` eklemek ayrı ve bilinçli bir karar olurdu (bucket host'u
  ortamdan ortama değişiyor).

- **Defter dizini: "Ara" paneli (2026-08-22)** — Defterde **hiçbir listeleme yoktu.** Repository'de
  `listEntriesByIds` (sayfalar), `listDueEntries` (deste) ve analiz için toplu sinyaller vardı;
  kullanıcının kayıtlarını listeleyen sorgu da uç da yoktu. Buna karşılık `0077` ile gelen iki
  indeks — `(userId, createdAt)` ve `(userId, subjectRef)` — **hiçbir sorgu tarafından
  kullanılmıyordu**; yazılmamış bir listeleme için kurulmuşlardı.

  Bir önceki turda eklediğim "Sadece sayfadan kaldır" seçeneği bu boşluğu görünür yaptı: o seçeneği
  kullanan öğrenci kaydı bir daha hiçbir yerden göremiyordu. Düzenleme/silme yalnız sayfadaki karta
  çift tıklayarak açıldığı için, kayıt tekrar zamanı gelene kadar ne düzeltilebiliyor ne
  silinebiliyordu. Sayfa dolduğu için hiç yerleştirilememiş kayıt da aynı durumdaydı.

  `GET /entries` (ders + hata tipi + durum filtreleri, sayfalı) ve ray'da "Ara" paneli geldi.
  Satıra dokunmak tek kart önizlemesini açıyor — düzenleme ve silme oradan zaten çalışıyordu, dizin
  onları yeniden yazmıyor, sadece **ulaşılır** kılıyor. Metin araması bilerek yok: `ILIKE` taraması
  indekssiz kalır ve kendi gerekçeleri olan bir trigram migration'ı ister.

  **Gotcha — çift kart.** `handleCreated` yerleştirmeyi sorgusuz yapıyor; dizinden zaten sayfadaki
  bir kaydı yerleştirmek aynı `entryId` ile ikinci bir kart üretiyordu. Panel açık sayfalardaki
  id'leri alıp o satırın düğmesini kapatıyor.
  **Gotcha — panel kapanması.** `handleCreated` yerleştirdikten sonra `setDetailCollapsed(true)`
  yapıyordu; ekleme formu için doğru (iş bitti, kartı göster) ama dizinde gezinen öğrencinin
  panelini kapatmak düşmanca. Yerleştirme `placeEntryOnPage` olarak ayrıldı; kapanma kararı
  çağırana ait.
  **Gotcha — yarış koşulu.** Panelin ilk sayfa efekti iki filtreyi hızlıca değiştirince iki istek
  başlatıyor ve yavaş olan sonra dönüp kimsenin bakmadığı filtrenin sonucunu boyayabiliyordu;
  `cancelled` bayrağı eklendi. Aynı düzenleme lint'in "efekt içinde senkron setState" hatasını da
  çözdü: önceki satırlar yeni sonuç gelene kadar ekranda kalıyor, ki bu her filtre dokunuşunda
  listeyi boşaltmaktan iyi okunuyor.
  **Gotcha — bayat liste.** Silme ve düzenleme dizinin dışında oluyor; `indexRefreshKey` olmadan
  silinen kayıt listede kalıp boş bir önizleme açıyordu.
  `measureImageAspect` add panel'den `lib/notebook-image-aspect.ts`'e çıkarıldı — iki yol da aynı
  `nextEntrySlot`'u besliyor, "bu kart ne kadar uzun" sorusunun iki cevabı olmamalı.
  İlgili: `notebook-index-panel.tsx` (yeni), `mistake-notebook.{controller,service,repository}.ts`
  (+spec), `packages/validation/src/coaching.ts`, `notebook-{shell,side-panel,add-panel}.tsx`,
  `lib/notebook{,-image-aspect}.ts`, `e2e/notebook.spec.ts`.

- **Kaydı silme/düzenleme, deneme→defter köprüsü, push deep-link ölçümü (2026-08-22)** —
  Uçları çağıranlarla karşılaştırınca **üçüncü kez** aynı kalıp çıktı: `DELETE /entries/:id`, istemci
  sarmalayıcısı, R2 fotoğraf temizliği ve testi hazırdı, **hiçbir UI çağırmıyordu.** Üç ayrı yüzü
  vardı: (1) sayfadaki çöp kutusu `dispatch({type:"remove"})` yapıyor, yani sadece `doc.items`'tan
  çıkarıyordu — kayıt yaşamaya devam ediyor ve ertesi gün destede geri geliyordu, öğrenci sildiğini
  sanarak; (2) fotoğraf public URL'de kalıyordu ve kaldırmanın hiçbir yolu yoktu (KVKK — servisin
  kendi testi bunu "a deleted mistake stops living at a public URL" diye anlatıyor); (3) hata tipi
  ve ders sonradan düzeltilemiyordu, yani yanlış etiket zayıflık haritasını kalıcı bozuyordu.

  Çöp kutusu artık **soruyor**: "Sadece sayfadan kaldır" / "Defterden sil". Sticker ve notlarda soru
  yok, onlar bugünkü gibi anında gidiyor. Yeni `notebook-entry-edit-dialog.tsx` hata tipi + ders/konu
  düzeltmesi ve onaylı silmeyi taşıyor; **yalnız tek kart önizlemesinden** açılıyor (`onEdit` sadece
  `singleReview` çağrı yerinden geçiliyor) — tekrar destesine yıkıcı bir eylem girmiyor.
  **Gotcha:** silme dört yerden birden düşürmeli — due listesi, sayaçlar, iki sayfa metası ve
  **sayfa dokümanındaki kart item'ı**. Sonuncusu atlanırsa `StageItem` silinmiş kaydı "renders as
  nothing" diye tolere ettiği için sayfada **görünmez ama seçilebilir ve sürüklenebilir** bir kutu
  kalıyor, ki bu kırık karttan beter: kimse neyi tuttuğunu göremiyor.

  **Deneme→defter:** kayıttaki `mockExamId` tablo yaratıldığından beri boştu. Deneme kaydedildikten
  sonra analiz ekranı yanlış sayısını gösterip deftere kapı açıyor (`?mockExam=<id>`), defter de o
  parametreyle kapak yerine ekleme formunu açıp kaydı denemeye bağlıyor. **Otomatik aktarım
  bilerek yok:** deneme kaydı soru bazında değil sayı bazında, ve 12 otomatik kayıt öğrencinin
  bakmadığı 12 kart demek olurdu — destenin güvenilir olmasının tek sebebi bunun tersi.
  **Gotcha:** kart mobilde tek satırlık flex olarak kelime kelime sarıyordu (`flex-1` + `min-w-0`
  metni kardeşlerini sarmadan önce daraltıyor); telefonda iki satır, geniş ekranda tek satır oldu.

  **Push deep-link: ölçüldü, hata yok.** Tüm push URL'leri ham iç yol (`/notebook?review=due`,
  `/dashboard`) ve service worker `clients.openWindow` ile ham yolu açıyor — kırık görünüyordu.
  Ölçüm: `/notebook?review=due` → `/yanlis-defteri?review=due`, `/dashboard` → `/panel`; next-intl
  middleware'i query string'i koruyarak yönlendiriyor. **Düzeltilecek bir şey yok** — ölçmeden
  "düzeltilseydi" var olmayan bir soruna karmaşıklık eklenmiş olacaktı.
  İlgili: `notebook-entry-edit-dialog.tsx` + `notebook-remove-choice-dialog.tsx` (yeni),
  `notebook-shell.tsx`, `notebook-{add,side}-panel.tsx`, `notebook-review-panel.tsx`,
  `analysis-{shell,tab-entry}.tsx`, `e2e/{notebook,analysis}.spec.ts`, `analysis.fixture.ts`.

- **Ders bazlı deste + topluluktaki soruyu deftere alma (2026-08-21)** — Destede filtre: liste
  başlıklarındaki "Sadece bunu çalış" desteyi tek derse indiriyor, "Tüm dersler" geri alıyor.
  Filtre **türetiliyor, kopyalanmıyor** (`fullDeck` state + `subjectFilter` → `deck`); kopyalansa
  not düzenleme yaması ikisinden öğrencinin bakmadığına yazardı. `answered` id bazlı olduğu için
  filtre boyunca korunuyor.
  **Gotcha:** liste artık _tüm_ desteyi gösteriyor (ders değiştirmenin yolu o), ama deste filtreli
  olabiliyor — yani indeks iki tarafta farklı kartı işaret ediyordu. `onPick` id alıyor;
  filtre dışındaki bir karta atlamak filtreyi kaldırıyor, çünkü öğrenci onu işaret etti.
  **İkinci gotcha:** filtreli deste bitince `index` -1 oluyor ve eski kod "Bugünlük bu kadar"
  diyecekti — başka derslerde kart dururken. Ayrı bir `SubjectDonePanel` geldi: "Matematik bitti,
  başka derslerde 1 kart daha var" + "Diğerlerine geç". Filtrelenmemiş desteyle davranış aynı.
  "Ders seçilmemiş" grubuna filtre düğmesi **bilerek konmadı** — filtrenin ifade edemediği tek
  değer o, ve "sadece etiketsizleri çalış" kimsenin istediği bir deste değil.

  **Köprünün diğer yönü de bağlandı:** `source: "COMMUNITY"` şemada ve enum'da baştan beri vardı,
  hiçbir yer kullanmıyordu. Soru sayfasında bookmark'ın yanına "Ben de çözemedim" düğmesi ve küçük
  bir dialog geldi (hata tipi zorunlu — defterin add panel'iyle aynı çipler, aynı tek zorunlu alan).
  **Tek tık değil, bilerek:** şema yorumunun kendi ifadesiyle, topluluk sorusu deftere ancak
  kullanıcının kendi "ben de çözemedim" beyanıyla girer ve zayıflık haritasına `OWN` gibi sayılır;
  sadece ilginç bulduğu şey forum'un bookmark'ına aittir. Kopya da bu yüzden "kaydet" değil.
  `examId` dialog açılınca çekiliyor — her thread'in her okuyucusu, yalnız bu düğmeye basanların
  önemsediği bir isteği peşin ödemesin diye.
  **Gotcha:** soru sayfasının e2e mock'u `/v1/forum/zones` olmadan boş `main` ile takılıyor;
  `notebook-community-bridge.spec.ts` bu yüzden zone listesini de mock'luyor.
  İlgili: `notebook-review-{panel,list}.tsx`, `question-shell.tsx`, `notebook-add-dialog.tsx` (yeni),
  `e2e/notebook{,-community-bridge}.spec.ts`, `messages/{tr,en}.json`.

- **Flashcard'ın arkasına çözüm alanı (2026-08-21)** — Kart arkası hata tipini, tekrar sayısını ve
  öğrencinin notunu taşıyordu ama **sorunun cevabını taşımıyordu**; bir flashcard'ın arkası tanımı
  gereği cevaptır. İlk beyin fırtınasında "ayrı PR" diye ertelenmişti, kart arkası da o alana yer
  açacak şekilde tasarlanmıştı. İki kolon geldi: `solution_storage_key` + `solution_note`
  (migration `0082`, el yazımı — `drizzle-kit generate` 0074 öncesi snapshot'a diff attığı için
  0074/0075/0077/0078'in kaydettiği sebeple). İkisi de isteğe bağlı ve birbirinden bağımsız:
  fotoğraflanmış cevap anahtarı, tek satırlık "paydayı eşitlemem gerekiyordu", ya da ikisi.
  Hem ekleme panelinde hem tekrar sırasında kart arkasında girilebiliyor — cevap çoğu zaman kartın
  seni ikinci kez yakaladığı anda öğrenilir.

  **En kritik gotcha, sessiz veri kaybıydı:** `listAllReferencedImageKeys` orphan süpürgesinin
  _whitelist_'i — `cleanupOrphanImages` `notebook/` altında bu sorgunun saymadığı ne varsa siliyor.
  Çözüm fotoğrafı aynı prefix'i paylaştığı için, kolon o sorguya eklenmese her kayıtlı cevap grace
  süresi dolunca silinecekti. Anahtar toplama saf bir fonksiyona (`notebookEntryImageKeys`) çıkarıldı
  ve kendi spec'i var; süpürgenin çözüm fotoğrafını koruduğu service seviyesinde de test ediliyor.
  Sorgunun `SELECT`'i bu suite'te DB olmadığı için kapsanamıyor — bu yüzden kolonun yanında da,
  sorgunun başında da uyarı duruyor.

  **İkinci gotcha, güvenlik:** `foreign_storage_key` guard'ı sadece soru fotoğrafına uygulanıyordu.
  Presigned PUT her yükleme için ayrı üretiliyor ama satıra düşen anahtar istek gövdesinden geliyor —
  yani guard'sız bir kayıt başkasının R2 objesini gösterebilir ve `getPublicUrl` onu her okumada geri
  verirdi. `assertOwnStorageKey` olarak ayrıldı, iki foto kolonu da ondan geçiyor.

  **Guardrail (§4):** çözüm öğrencinin _kendi_ kaydı; AI çözüm üretmiyor ve çözüm fotoğrafına
  pre-label vision pass'i **bilerek koşulmuyor** — vision bir _soruyu_ okuyup dersini tahmin eder,
  cevap anahtarına koşmak ona "çözüm ne diyor" diye sormak olurdu.

  **Tasarım:** `NoteField` iki alanın paylaştığı `EditableField`'a genelleşti (aynı kuyu, aynı açık
  Kaydet/Vazgeç, aynı drag+flip kilidi). Arka yüz artık `overflow-y-auto` ve yalnız not kuyusu
  `flex-1` alıyor — iki alan birden büyümeye çalışırsa çözüm bandı eziliyor. Çözüm fotoğrafı kısa
  bir şerit + büyüteç (tam boyu `NotebookImageLightbox` gösteriyor), çünkü kutu sabit 4:5 ve
  contained bir kare not alanını kartın dışına itiyordu. Bandın üstündeki "ÇÖZÜM" başlığı yazıldıktan
  sonra silindi: alttaki kuyu zaten "çözümü düzenle" diyordu, ve tracked-uppercase kicker bu kartın
  ihtiyacı olmayan tek şeydi.
  İlgili: `0082_notebook_solution.sql`, `database/schema.ts`, `mistake-notebook.{service,repository}.ts`
  (+specler), `packages/{types,validation}`, `notebook-add-panel.tsx`, `notebook-review-{card,panel}.tsx`,
  `e2e/notebook.spec.ts`, `messages/{tr,en}.json`.

- **Tekrar destesi tasarım geçişi + uygulama genelinde çip kontrast hatası (2026-08-21)** — Deste
  her ekran, iki tema ve iki viewport için ekran görüntüsüyle tarandı; çıkan dört sorunun ikisi
  erişilebilirlik hatasıydı.
  **(1) Karanlık temada kart yok oluyordu:** yüzeyler `--color-bg` kullanıyordu, ki dark'ta `#12141a`
  — %85 siyah scrim'den neredeyse ayırt edilemiyor, kenar hiç yok. Kart, liste, yığın kartı ve
  Stuck/Done panelleri `--color-surface` + `NotebookEntryCard`'ın kullandığı hairline'a geçti;
  light'ta ikisi de beyaz olduğu için görsel fark sıfır.
  **(2) "Çözebildim" butonunun etiketi `#ffffff` sabitiydi.** `--color-success` temalar arasında
  ters çevriliyor (light'ta koyu `#2e7d54`, dark'ta açık `#6bc49a`), yani dark'ta beyaz etiket
  ~2:1'e düşüyordu. `--color-btn-label` zaten tam bunun için var — light'ta beyaz, dark'ta koyu ink.
  Kaydırma sırasında çıkan doğrulama etiketi de aynı düzeltmeyi aldı.
  **(3) Kart arkasının %70'i boştu:** dört kısa satır sabit 4:5 kutunun tepesine yığılıyor, öğrencinin
  _yazdığı_ tek şey olan not ise o boşlukta kaybolan ince bir satır oluyordu. Artık üç bant var —
  başlık, meta çipleri, ve kalan yüksekliği dolduran bir not kuyusu; "Not ekle" de böylece yazı alanı
  gibi okunuyor. Tekrar sayısı da hata tipiyle aynı pill biçimini aldı ama nötr dolguyla: renkli olan
  öğrencinin seçtiği sınıflandırma, diğeri karta dair bir olgu.
  **(4) Modal iki noktada genişlik değiştiriyordu:** Stuck ve Done panelleri `max-w-xl` ile desteden
  160px genişti — yani modal, tam da öğrenciye bir şey söylenen iki anda şekil değiştiriyordu. İkisi
  de `REVIEW_CARD_WIDTH`'e alındı. Done paneli ayrıca kopyasını tekrar ediyordu ("soru kalmadı" +
  "2 tanesini çözdün"); sayım artık subtitle'ın kendisi, `review_done_subtitle` silindi.

  **Bulunan ama bu özelliğe ait olmayan hata:** `packages/ui/src/theme.css` dark bloğu
  `--color-chip-text`'i açık mora (`#c4b8e0`) çeviriyor ama `--color-chip` fillini light'ın
  `#bea1fe`'sinde bırakıyordu — **açık mor üstüne açık mor, ~1.3:1**, uygulamadaki 39 çip kullanımının
  hepsinde okunamaz. Dark'a `--color-chip: #332c47` eklendi (`accent-soft`'un dark kuyusuyla aynı
  kurulum, çipin kendi tonunda; `#c4b8e0` ile ~7:1). **Bu paylaşılan bir token, etkisi defterle
  sınırlı değil — dark temadaki diğer çip yüzeyleri gözle kontrol edilmeli.**
  İlgili: `notebook-review-{card,list,panel}.tsx`, `notebook-compact-button.tsx`,
  `packages/ui/src/theme.css`.

- **Defter ↔ topluluk köprüsü kapandı; tekrar sırasında not; deste sonu özeti (2026-08-21)** —
  `POST /entries/{id}/community-thread` **iki hafta boyunca çağrısız durdu**: uç hazırdı, testliydi,
  `lib/notebook.ts`'te `linkNotebookThread` sarmalayıcısı bile vardı, ama hiçbir bileşen çağırmıyordu.
  Sonuç: takılan öğrenci `/community`'ye bırakılıyor, sorduğu thread karta bağlanmıyor,
  `community_answered_at` hiç dolmuyordu — yani `card_community_answered` rozeti de, kart arkasındaki
  "Çözümü gör" linki de **hiç görünemeyen ölü koddu**. Artık `StuckPanel`
  `/topluluk/akis?notebookEntry=<id>`'ye devrediyor (composer hub'da değil akış sayfasında),
  `GlobalComposer` parametreyi görünce soru dialogunu açıyor ve thread oluşunca kartla bağlıyor.
  `QuestionComposerDialog.onCreated` artık `(thread: ThreadView) => void` — composer defterin
  varlığını öğrenmiyor, sadece ne yarattığını söylüyor; defter mantığı bir üst katmanda.
  **Ön doldurma yok, fotoğraf otomatik eklenmiyor:** `stuck_copyright` zaten "kendi denemeni anlat"
  diyor, gövdeyi bizim doldurmamız o tavsiyeyi baltalar, fotoğrafı eklememiz telif uyarısını
  anlamsızlaştırırdı. Bağlama **thread'i bloklamıyor** — soru zaten yayında; başarısızlık toast ile
  söyleniyor, akış devam ediyor.
  **Gotcha:** parametre `router.replace` ile temizlenmiyor, `window.history.replaceState` ile.
  Adres çubuğundaki yol next-intl'in yerelleştirilmiş hâli (`/topluluk/akis`) ve istemci yönlendiricisi
  onu bu rotaya geri çözmüyor — çağrı sessizce geçiyor, parametre yerinde kalıyordu. Ayrıca dialog'un
  açıklığı state'e **kopyalanmıyor**, parametreden türetiliyor (`handoffSpent` + `manualQuestionOpen`);
  effect içinde setState repo lint'inde hata.

  **Not artık tekrar sırasında yazılabiliyor.** Not yalnız kayıt eklenirken giriliyordu; oysa bir kartın
  seni ikinci kez yakaladığı an, "neden yanlış yaptım"ın **öğrenildiği** an. Kart arkasında kalem
  satırı → `<textarea>` + açık Kaydet/Vazgeç (blur'da kaydetme yok: kart kaydırılıp gidebilen bir
  yüzey, blur zaten metnin kaybolma yollarından biri). **Gotcha:** düzenlerken `drag` ve tıkla-çevir
  kapanıyor; yoksa textarea'da başlayan sürükleme kartı cevaplıyor, tıklama da notu arka yüze atıyor.
  `NOTEBOOK_NOTE_MAX_LENGTH` validation'dan export edildi — textarea'nın `maxLength`'i şemayla
  ayrışırsa sunucunun reddedeceği metni yazdıran bir form olur. Shell'de `handleReviewed`'ın
  `patchMeta` bloğu `handleEntryPatched` olarak ayrıldı: not güncellemesi açık sayfadaki kartı
  tazeliyor ama kaydı due listesinden **düşürmüyor**.

  **Deste sonu özeti:** "3 karttan 2 tanesini çözdün" + kalan varsa "tekrar döngüsünde". Deste
  _sırasında_ sayaç olmaması kararı duruyor (AGENTS.md §0) — bitişteki tek seferlik özet her dürüst
  "çözemedim"i fiyatlandırmıyor, kaçırılanlar da yanlış olarak değil rotasyonda kalan kart olarak
  anlatılıyor.
  **Yeni e2e dosyası** `notebook-community-bridge.spec.ts` köprünün topluluk yarısını sürüyor (defter
  mock'una forum zone'u öğretmemek için ayrı dosya). Yazarken app-shell'in
  `/v1/community/achievements/unseen` ucunun mock'lanmaması yine tüm sayfayı düşürdü — catch-all 204
  üzerinde `.length` — `notebook.spec.ts`'in bildirim zilinde öğrendiği dersin aynısı.
  İlgili: `global-composer.tsx`, `question-composer-dialog.tsx`, `notebook-review-{panel,card}.tsx`,
  `notebook-shell.tsx`, `packages/validation/src/coaching.ts`, `e2e/notebook{,-community-bridge}.spec.ts`.

- **Yanlış defteri tekrar destesi flashcard oldu (2026-08-21)** — "N soru tekrar zamanı" çipinin
  açtığı `NotebookReviewPanel` tek yüzlü bir foto önizlemesiydi: ders/konu, hata tipi, tekrar sayısı
  ve not fotoğrafın sol üstünde **sürekli** duruyordu, aksiyonlar da alt gradient barda fotoğrafın
  üstüne biniyordu. İkisi de somut zarar veriyordu — etiketler öğrenci soruya bakmadan yarı cevabı
  veriyor (bu ekranın tek işi ipuçsuz hatırlama; ipucu veren tekrar _tanımayı_ ölçer), gradient bar
  da okunması gereken alanı kapatıyordu.

  **Yeni model:** ön yüz sadece soru, tıklayınca kart çevriliyor, bağlam arkada. Sağa/sola kaydırma
  = çözebildim/çözemedim; ok tuşları aynı eşleşmede (gezinme okları kaldırıldı — cevaplamadan deste
  gezmek kendi başına bir amaç değildi, "sonra" zaten köşedeki X). Aksiyonlar kartın **dışına**
  taşındı, böylece hem fotoğrafın altı açıldı hem de butonlar yüz başına tekrarlanmadı.

  **Kutu bilerek sabit 4:5** (`REVIEW_CARD_BOX`, genişlik `min(92vw,26rem,60vh)` ile yükseklikten de
  sınırlı): flip'in iki yüzü aynı ayak izini paylaşmak zorunda, yoksa kart dönerken boyut değiştirir;
  ayrıca her kart aynı boyda olmadan arkadaki yığın kartı hizalanamaz. Foto `object-contain`, artan
  alan kartın kendi zemini (`--color-bg`) — eski sabit dikey kutunun "siyah bant" sorunu geri
  gelmiyor — ve büyüteç tam boy görüntüyü mevcut `NotebookImageLightbox`'a devrediyor.
  **Gotcha:** yığın kartında `translateY(22px) scale(0.95)` — CSS transform'ları sağdan sola uygulanır,
  önceki `translateY(10px) scale(0.96)` denemesinde ofset küçülmenin içinde eriyip 1.5px'lik görünmez
  bir çizgiye dönüşmüştü.

  **Gotcha:** sürükleme bitişini bir `click` izliyor; `dragMoved` ref'i olmadan her cevaplama kartı
  bir de çeviriyor. **Gotcha:** 3D yolda iki yüz de DOM'da duruyor (dönüşün gösterecek bir şeyi olsun
  diye) — arkadaki yüz `inert`, yoksa odak ve ekran okuyucu görünmeyen yüze giriyor;
  `prefers-reduced-motion`'da hiç 3D yok, tek yüz mount ediliyor ve çapraz geçişle değişiyor.
  Lightbox panelin **içinde** render ediliyor, panelin klavye kancası açıkken erken dönüyor — yoksa
  tek Escape ikisini birden kapatıyor.

  `NotebookCompactButton`'a `large` (44px dokunma hedefi) ve `tone="success"` eklendi: karanlık
  zeminde `primary`'nin `--color-btn`'i açık temada saf siyah, yani kayboluyordu; yeşil aynı zamanda
  kaydırınca çıkan etiketle eşleşiyor. Sayaç çipi bilerek **yok** (AGENTS.md §0: sıralama/utandırma
  yok) — sadece `3 / 7`. Swipe eşiği saf fonksiyonda (`swipeVerdict`), çünkü Playwright dürüst bir
  flick üretemiyor; e2e flip kontrolünün `aria-pressed`'ini doğruluyor.
  Kapsam dışı bırakılanlar: çözüm foto/metin alanı (backend + migration), swipe geri alma, ders
  başlıklı liste görünümü (aşama 2), deste bitirme achievement'ı.
  İlgili: `notebook-review-card.tsx` (yeni), `notebook-review-panel.tsx`, `lib/notebook-review-deck.ts`
  (+spec), `notebook-compact-button.tsx`, `e2e/notebook.spec.ts`, `messages/{tr,en}.json`.

- **Tekrar destesi: ders başlıklı liste görünümü + kart atlama hatası (2026-08-21)** — destenin
  üstüne, X'in yanına bir liste düğmesi geldi; aynı modal içinde kartın yerini `subjectName`'e göre
  gruplanmış bir liste alıyor (satır: küçük görsel/metin ikonu, konu adı, hata tipi). Satıra
  tıklamak o karta atlıyor, liste kapanıyor. Listede **cevaplama yok** — kart görünümünün var olma
  sebebi "liste göz gezdirip tiklemeye davet eder"di, o karar bozulmadı; listenin gerçekten iyi
  yaptığı şey yönelim ("yedi kart, dördü Matematik"), tek kartlık deste bunu asla gösteremez.

  Bunu yazarken **gerçek bir hata çıktı ve önce e2e ile kanıtlandı**: panel `entries` prop'unu, yani
  shell'in _canlı_ due listesini geziyordu; `handleReviewed` cevaplanan kaydı o diziden çıkarırken
  panel bağımsız olarak `index + 1` yapıyordu, dolayısıyla **her cevap bir sonraki kartı atlıyordu**
  (3 kartta "Bir" cevaplanınca doğrudan "Üç" geliyor, "İki" hiç sorulmuyordu). Düzeltme: deste
  panel açılırken bir kez anlık görüntüleniyor (`useState(entries)`) ve bir daha karıştırılmıyor;
  hangi kartların hâlâ due olduğu shell'in kendi meselesi. İmleç artık `index + 1` değil
  `nextUnansweredIndex(...)` — listeden atlama serbest olduğu için "sıradaki" ancak "henüz
  cevaplanmamış sıradaki" olabilir, ve deste sonuna gelince başa sarıp atlanmışları topluyor.
  Deste ancak `-1` dönünce bitiyor; cevap _sayısına_ bakmak, bir kart iki kez cevaplandığında
  günü erken bitirirdi.

  Bu yüzden liste, bu oturumda cevaplanmış kartları çek işaretiyle gösterip **tıklanamaz** yapıyor:
  aksi hâlde liste, aynı kartı ikinci kez cevaplatarak öğrencinin kendi aralık merdivenini
  sıfırlamanın yolu olurdu. Escape artık katman katman geri gidiyor (önce liste, sonra panel).
  `lib/notebook-review-swipe.ts` → `lib/notebook-review-deck.ts` olarak yeniden adlandırıldı
  (artık sadece jest değil, deste imleci de orada). **Gotcha:** liste kenarlarındaki fade mask
  kaldırıldı — `mask-image` listenin gerçekten taşıp taşmadığını bilemiyor, üç kartlık destede
  ilk başlığı ve son satırı sebepsiz soluklaştırıyordu.
  İlgili: `notebook-review-list.tsx` (yeni), `notebook-review-panel.tsx`, `notebook-review-deck.ts`
  (+spec), `e2e/notebook.spec.ts`, `messages/{tr,en}.json`.

- **`PUT /coaching/notebook/pages/:index` "Geçersiz istek" 400 fix (2026-08-21)** — bir sayfa
  `entry` item'ı içerdiğinde her zaman `BAD_REQUEST` ile başarısız oluyordu, `details` alanı yok
  (yani bir `DomainError` değildi). Kök neden `mistake-notebook.repository.ts`'deki
  `listEntriesByIds`: `sql\`${entries.id} = ANY(${entryIds})\``ham SQL'i, drizzle'ın bir JS
dizisini Postgres array literal'ına serileştirmemesi yüzünden`22P02 malformed array literal`atıyordu — bu SQLSTATE`mapPostgresError`'da genel `BAD_REQUEST`'e eşleniyor, o yüzden hata hem
Zod şemasını hem ownership kontrolünü geçmiş gibi görünüyordu (ikisi de gerçekten geçiyordu).
Fix: `sql\`ANY(...)\``yerine drizzle'ın`inArray()`helper'ı — doğru parametrelenmiş`IN (...)`üretiyor. Gerçek DB'ye karşı (drizzle repository'si doğrudan import edilerek) doğrulandı. Usage:
deftere fotoğraflı bir yanlış eklenip sayfaya yerleştirildiğinde tetiklenir. Related:`mistake-notebook.repository.ts`.

- **Yanlış defteri rail chrome motion (2026-08-21)** — Category/Not pills share a
  `layoutId` so the active fill travels between neighbours (vision-board editor nav).
  The detail panel keeps its enter/exit slide; switching Ekle/Sticker/Kağıt crossfades
  the body (`mode="wait"`). Reduced-motion snaps the pill and fades only. Usage: open
  a spread, tap rail icons. Related: `notebook-shell.tsx`, `board-chrome-motion.ts`.

- **Yanlış defteri light/dark chrome (2026-08-21)** — `/yanlis-defteri` rail, side-panel pills,
  error-type chips, save, and the community handoff CTA pair `--color-btn` with
  `--color-btn-label` so filled chrome stays readable when those tokens invert. Inactive
  plate swatches outline with a `--color-main` mix instead of `rgba(0,0,0,0.12)` (hairline
  vanished on charcoal). Paper, cover, rules, and spiral stay `--notebook-*`; the ink tray
  stays a dark physical object (white tray would hide a white pen). Photo overlays and
  lightbox remain photo-native whites. Usage: sidebar lamp on `/yanlis-defteri`. Related:
  `notebook-shell.tsx`, `notebook-side-panel.tsx`, `notebook-add-panel.tsx`,
  `notebook-review-panel.tsx`.

- **Achievement kanıtları ve haftalık tamamlama (2026-08-18)** — Geçerli oturum, plan, hedef panosu,
  streak, deneme ve yanlış-defteri eylemleri domain event üretir. `PUT /v1/coaching/weekly-review/completion`
  yalnız READY ve doğru İstanbul haftası için idempotent kayıt/event oluşturur. Toplu
  `CoachingAchievementEvidenceService` backfill'in coaching tablolarına dışarıdan erişmeden çalışmasını
  sağlar. “Kaldığın Yerden” iki çalışma tarihi arasında yedi tam İstanbul takvim günü arar; sayaç UI'a
  çıkmaz. İlgili: `coaching.events.ts`, `coaching-achievement-evidence.service.ts`,
  `weekly-review-completion.*`, `achievement-evidence.ts`.

- **Study-session light/dark surfaces (2026-08-15)** — `/seans` history lists, buddy
  invite field, done-state note, and circular controls use `--color-surface` /
  `--color-border`. Pause stays white-on-`--color-progress`. Usage: sidebar
  moon/sun on `/seans`. Related: `session-history.tsx`, `session-controls.tsx`,
  `session-done-state.tsx`, `docs/features/web-shell.md`.

- **Pano editor theme toggle (2026-08-15)** — Sağ üst tema butonu kaldırıldı;
  `/hedef/pano` temayı yalnız collapsed AppNav footer'dan değiştirir. Related:
  `board-editor-shell.tsx`.

- **Hedef panosu rail hizası (2026-08-15)** — Collapsed AppNav ile pano kategori
  rail / geri tuşu / undo sırası aynı `pt-3` + 44px ilk hedef. Related:
  `board-editor-shell.tsx`, `app-nav.tsx`.

- **Hedef panosu collapsed AppNav (2026-08-15)** — `/hedef/pano` keeps the desktop
  52px icon rail instead of hiding AppNav. Collapse is route-forced (cookie not
  overwritten). Mobile editor stays full-bleed. Related: `layout.tsx`,
  `app-nav.tsx`, `app-sidebar.ts`.

- **Vision board light/dark chrome (2026-08-15)** — `/hedef` map chrome and `/hedef/pano`
  editor chrome use `--color-surface` / `--color-btn-label`. Canvas, frames, export,
  and color palettes stay collage-native (DESIGN.md §2.5). Theme toggle sits in the
  editor top bar (AppNav is hidden on `/hedef/pano`). Turkey landmass mixes secondary
  into `--color-surface` (not `white`) so dark charcoal does not glare; province
  seams and label halos use `--color-bg`. Pin red + white eye stay map-native.
  Usage: sidebar moon/sun on `/hedef`; editor bar on `/hedef/pano`. Related:
  `vision-board-shell.tsx`, `board-editor-shell.tsx`, `map-browser.tsx`,
  `globals.css` (`.mentor-tr-map`), `docs/features/web-shell.md`.

- **Analysis light/dark surfaces (2026-08-15)** — `/analiz` tabs, history rail/drawer,
  next-focus card, and mock-exam form use `--color-surface` / `--color-btn-label`.
  Shared `HistorySideRail` / `HistorySideDrawer` follow the same so Koç history
  chrome stays paired. Weekly-recap story + overlay dock stay recap-native
  (DESIGN.md §2.5); only the note dialog and post-recap CTAs follow theme.
  Usage: sidebar moon/sun on `/analiz`. Related: `analysis-shell.tsx`,
  `analysis-tab-progress.tsx`, `history-side-rail.tsx`,
  `docs/features/web-shell.md`.

- **Coach calibration pills (2026-08-15)** — Preference chips no longer use hardcoded
  `white` fill. Unselected = surface + main ink; selected = `--color-btn` /
  `--color-btn-label`. Dark charcoal no longer washes the labels out. Related:
  `coach-calibration-card.tsx`.

- **Coach light/dark surfaces (2026-08-15)** — `/koc` chat shell, composer, history rail/drawer,
  memory dialog, calibration/action cards, and Puhu speech bubbles use `--color-surface` /
  `--color-btn-label`. Pastel backdrop blobs read `--blob-*` opacities so dark charcoal
  stays calm. User bubbles stay white-on-`--color-progress`. Usage: sidebar moon/sun on
  `/koc/sohbet`. Gotcha: mobile AppNav chrome is still a later slice. Related:
  `coach-chat-shell.tsx`, `coach-composer.tsx`, `puhu-coach-bubble.tsx`,
  `docs/features/web-shell.md`.

- **Plan light/dark surfaces (2026-08-15)** — `/plan` calendar, timeline, view switcher, and
  add/adapt dialogs use surface/border/btn-label tokens. Shared `Dialog`, `TextField`,
  `TextAreaField`, and `BottomSheet` follow the same so modal titles/labels stay readable
  on charcoal (no more light ink on `bg-white`). Usage: open “Yeni etkinlik” or coach
  adapt in dark. Gotcha: today-dot on `--color-progress` still uses white (mid-blue).
  Related: `plan-view-switcher.tsx`, `plan-add-task-button.tsx`, `dialog-panel.tsx`,
  `text-field.tsx`, `globals.css` `.mentor-plan-day-picker`.

- **Panel light/dark surfaces (2026-08-15)** — `/panel` cards, rhythm well, ritual/community
  promo shells, and coach-next-action now use `--color-surface` / `--color-main` instead of
  hardcoded `bg-white` + light text (dark-mode contrast break). `@mentor/ui` `Card` follows
  the same tokens. Usage: toggle theme in the sidebar; greeting + metrics stay readable.
  Gotcha: weekly-recap teaser and vision-board canvas stay on their own palettes. Related:
  `panel-shell.tsx`, `community-card.tsx`, `soft-promo-shell.tsx`, `packages/ui/src/components/card.tsx`.

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
  haritayı uzatmıyor. Program satırları chip-mor arka plansız; dropdown gibi
  `hover:bg-black/4`, ad + sakin meta (puan türü · kontenjan · taban). Tek arama
  alanı: üniversite açıkken yerel bölüm filtresi (ikinci bar yok); geri yalnız
  `ArrowLeft` ikon. Hover kart tıklanınca pin ile aynı sidebar detayı açılır;
  üniversite adının altında şehir (harita üzeri il etiketi değil). Sidebar
  arama satırı hover → haritada `data-preview` il highlight; tıklayınca şehir
  active + pin spotlight hover card + kampüs paneli. Üniversite arama hit'inde
  `cityCode`/`cityName` API'den gelir (`UniversitySearchHitDto`) — FE geo grafiğini
  tersine aramaz (mobil hazırlığı). Geo arama aktifken harita pin'leri sonuçlara
  göre filtrelenir: şehir hit → o ildeki tüm kampüsler; üniversite/bölüm hit →
  yalnızca ilgili kampüsler; arama bitince tüm pin'ler geri gelir. YKS haritasında
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
  (`AnalysisHistoryList`, ≥2 kayıt) kanıt amaçlı denendi — sidebar rail `overflow-y-auto` olduğu için
  Nivo'nun chart'a göre `position:absolute` konumlanan tooltip'i üstteki noktada kesiliyordu (`pt-6`
  ile geçici düzeltildi). Kullanıcıyla birlikte gözden geçirince üst KPI bandı (`AnalysisSummaryBand`)
  ile aynı trendi iki kez, farklı görünümlerde göstermenin gereksiz olduğuna karar verildi — geçmiş
  listesi sade bir liste olarak kalsın, chart yalnız KPI bandında (tone rengiyle, `compact`) dursun
  diye **`AnalysisHistoryList`'ten `StatLineChart` tamamen kaldırıldı** (`pt-6` workaround'u ve
  `net_chart_label` çevirisiyle birlikte). Diğer istatistik kartları (odak kartı, gelişim sekmesi
  trend grafiği) bilinçli olarak dokunulmadı — infra tek bir yerde (KPI bandı) kanıtlanmış oldu.
  Metin: `trend_subtitle`'daki tekrar eden "— sıralama yok" ibaresi (aynı uyarı zaten üst KPI
  bandında ve ders ortalamaları alt başlığında var) sadeleştirildi; üst KPI bandının `!latest` boş
  metni de kaldırıldı (Gir sekmesindeki Puhu'lu boş durum zaten aynı şeyi anlatıyor, iki boş-durum
  mesajı üst üste yığılmasın diye `AnalysisSummaryBand` veri yokken artık `null` render ediyor).
  `tsc --noEmit` ve `eslint` temiz; canlı tarayıcı doğrulaması kullanıcı tarafından yapıldı.
  Dosyalar: `analysis-mock-exam-form.tsx`, `analysis-date-picker-sheet.tsx` (yeni),
  `analysis-tab-entry.tsx`, `analysis-shell.tsx`, `analysis-ghost-teaser.tsx`,
  `analysis-tab-progress.tsx`, `analysis-tab-mistakes.tsx`, `analysis-history-list.tsx`,
  `analysis-summary-band.tsx`, `stat-line-chart.tsx` (yeni), `puhu-image.tsx` (+`sleepy` varyantı),
  `messages/{tr,en}.json`, `apps/web/package.json`.

- **Gelişim (progress) sekmesi cilası + Button/Chip primitive polish (2026-08-11)** — dört parçalı
  devam. **Haftalık özet:** `WeeklyRecapTeaser` artık Analiz > Gelişim'de gösterilmiyor — Panel'deki
  versiyonu (`source="dashboard"`) zaten localStorage ile "new/replay/hidden" durumunu yönetip
  açılınca kendini gizliyor; buradaki versiyonun öyle bir mantığı yoktu (her ziyarette kalıcı
  gösteriyordu), aynı kartı iki yerde göstermek gereksizdi. Kaldırma, `analysis-shell.tsx`'teki
  `developmentExtras` state + `loadDevelopmentExtras` fetch + tetikleyici `useEffect`'i, ve
  `analysis-tab-progress.tsx`'teki `WeeklyReviewSlot`'u tamamen söktü (`invalidateExtraData` →
  `invalidatePhotoAccess` olarak sadeleşti, artık sadece foto-erişim state'ini geçersiz kılıyor).
  `/analysis/recap` sayfası ve Panel'deki teaser dokunulmadı. **Chip/Button:** kullanıcı iki bileşenin
  de `@mentor/ui`'da tek merkezden yönetildiğini onayladı, o yüzden per-component override yerine
  kaynağı düzenledik (uygulama genelinde ~105 dosyayı etkiler, katmanı kasıtlı olarak ekledik):
  `Button` artık dolgu varyantlarında (`primary`/`accent`) hover'da `shadow-card` → `shadow-card-hover`
  yükseliyor (önceden statik inline `boxShadow` hover'ı engelliyordu, className tabanlı `shadow-[...]`
  kullanıma geçirdik) ve tüm varyantlar `active:scale-[0.98]` basma geri bildirimi kazandı — DESIGN.md
  §9 Micro katmanında tanımlı ama Button'da eksik olan `active` durumuydu. `Chip`'e `chip-text` @18%
  ince kenarlık eklendi (düz dolgu yerine biraz daha tanımlı/premium). **Tab geçişi:** üç panel artık
  `hidden` attribute yerine `AnimatePresence mode="wait"` ile crossfade+8px kayma (`tabTransition`,
  200ms, reduced-motion'da instant) — sadece aktif tab mount ediliyor; Gelişim'in kendi `window` state'i
  (4/8/12 filtre) tab değişince sıfırlanıyor, kabul edilebilir bir ödün (veri kaybı yok, hepsi parent'ta
  controlled). Foto sekmesinin mevcut `SkeletonGroup` fallback'i zaten kapsıyordu, yeni skeleton
  gerekmedi. **Metin:** `focus.subtitle` ("Bir sonraki küçük adım") kaldırıldı — başlığın hemen altında
  zaten spesifik içerik (ders adı + mesaj) var, jenerik ara satır gereksizdi; `focus.recent_subtitle`
  ve `evidence_subtitle` daha kişisel/akıcı ifadelere çevrildi (`sen` odaklı, "odak dersi" gibi
  dolaylı kalıplar yerine doğrudan "bu dersteki net seyrin").
  `tsc --noEmit` ve `eslint` (`@mentor/web` + `@mentor/ui`) temiz.
  Dosyalar: `analysis-shell.tsx`, `analysis-tab-progress.tsx`, `analysis-next-focus-card.tsx`,
  `packages/ui/src/components/{button,chip}.tsx`, `messages/{tr,en}.json`.

- **"Ders bazlı ortalamalar" kartları: yoğunluk, odak rozeti, trend göstergesi (2026-08-12)** —
  referans bir finans-app stat-tile görseli (icon + büyük değer + "This Month" + yeşil/kırmızı
  %değişim + mini grafik) baz alınarak. **İkon yok** — referansta ikon gelir/gider gibi anlamlı bir
  ayrım taşıyordu, bizde her kart aynı "ders" kavramı olduğu için jenerik bir ikon salt dekorasyon
  olurdu (DESIGN.md "her kartta illüstrasyon" yasağı). **Grid:** `grid-cols-2 sm:grid-cols-3` sabit
  kolonu, `repeat(auto-fit, minmax(9.5rem,1fr))` ile değiştirildi — ders sayısı ne olursa olsun kartlar
  sıkışık, boş alan bırakmıyor. **Mor kart açıklandı:** `analysis.nextFocus.subjectRef`
  eşleşen kart zaten `--color-chip` tint'iyle vurgulanıyordu ama sebep hiçbir yerde yazılı değildi —
  artık küçük bir "Odak" `Chip`'i var. **Backend'e yeni alan:** `SubjectStrengthDto`'ya
  `recentAverageNet` (son ≤4 denemenin ortalaması) ve `netDelta` (`recentAverageNet − averageNet`,
  yani "son performansın tüm-zamanlar ortalamana göre nerede") eklendi — `mock-exam.service.ts`
  zaten `recentSubjects`'i focus seçimi için hesaplıyordu, yeni sorgu gerekmedi, sadece hesaplama
  sırası `subjects` inşasından önceye alındı. FE, `netDelta`'nın işaretine göre `TrendingUp`/
  `TrendingDown` (lucide, "stonk" ikonları) gösteriyor — **düşüş yeşil/kırmızı değil, success/secondary**
  (DESIGN.md §2.4: "downward analytics use secondary, never red" — aynı turdaki taramada
  `AnalysisSummaryBand`'in bu kuralı ihlal eden eski `danger` kullanımı da düzeltildi). Sahte veri
  üretilmedi — |delta| < 0.005 iken hiç gösterge gösterilmiyor (yuvarlama gürültüsü "trend" gibi
  sunulmuyor). "Tüm kayıtlı denemeler" alt başlığı ve tekrar eden `avg_template` ("Ort. X · N
  deneme" — X zaten yukarıda büyük yazıyordu) kaldırıldı. `tsc --noEmit` (`@mentor/web` +
  `@mentor/api`) temiz; `mock-exam.service.spec` (13), `analysis-focus.spec` (11) yeşil;
  `e2e/analysis.fixture.ts` yeni alanlarla güncellendi.
  Dosyalar: `mock-exam.service.ts`, `packages/types/src/coaching.ts`, `analysis-tab-progress.tsx`,
  `analysis-summary-band.tsx`, `messages/{tr,en}.json`, `e2e/analysis.fixture.ts`.

- **Ders kartları: chip yerine inline trend, açıklayıcı info metni, "Net trendi" → StatLineChart
  (2026-08-12)** — devam. Ders bazlı ortalama kartlarında `TrendingUp`/`TrendingDown` rozeti artık
  büyük net değerinin yanında (tinted pill değil, sade renkli ikon+değer); "5 deneme" satırı
  kaldırılıp ders adının yanına `InfoTooltip` eklendi — hover/tap'te hem deneme sayısını hem
  `normalizedAveragePercent`'in ne anlama geldiğini (ortalama netin toplam soru sayısına oranı)
  açık cümlelerle anlatıyor. Kart `p-3`→`p-4`, `gap-2`→`gap-2.5` ile biraz büyüdü.
  **"Kanıtlar ve geçmiş" > Net trendi:** kullanıcı ApexCharts eklemeyi sordu — reddedildi (zaten
  `@nivo/line` tabanlı `StatLineChart` altyapısı var, ikinci bir chart kütüphanesi bundle'ı şişirip
  görsel dili tutarsızlaştırırdı). Bunun yerine eski özel `AnalysisSparkline` SVG'si + altındaki
  tarih/net `<ul>` listesi (chart'ın kendisiyle aynı veriyi iki kez gösteriyordu) `StatLineChart`
  (non-compact, eksenli, hover tooltip'i tarih+net gösteriyor) ile değiştirildi —
  `analysis-next-focus-card.tsx`'teki `AnalysisSparkline` kullanımı (farklı bağlam, "Son 4 deneme"
  mini paneli) dokunulmadan kaldı.
  `tsc --noEmit` ve `eslint` temiz.
  Dosyalar: `analysis-tab-progress.tsx`, `info-tooltip.tsx`, `messages/{tr,en}.json`.

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
  `KpssBrowser` `MapBrowser`'ın _varyantı değil, muadili_: YKS hedefi şehir → üniversite → program
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
  MÜHENDİS hedef olarak seçiliyken Ankara pininde **199** yazıyordu: o, Ankara'nın _tüm_ ilanları.
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
  _veriydi_ (başlık + kariyer enum'ı + 4 referans id'si). Artık kullanıcının kendi görsellerini ve
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
  **Gotcha 1 (mimari):** orphan diff'i başta `updateBoard`'dan _sonra_ `before.board` okuyordu ve
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
  **`BoardStage` tek render kaynağı.** Editör seçim çerçevesini ve tutamakları sahnenin _etrafına_
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
  ("görseller indirmeye kapalı geldi"), çünkü boş bir PNG döndürmek kullanıcıya _kendi panosunun_
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

- **Yanlış defteri: veri, defter kabuğu, kart, tekrar motoru, analiz köprüsü (2026-08-14, APP-042)** —
  `foto → ders/konu kategorize` özelliği emekliye ayrıldı ve yerine **yanlış defteri** geldi.
  Gerekçe: kategorize öğrenciye **zaten bildiği** şeyi söylüyordu (yanlış yaptığı dersi ve konuyu
  öğrenci bilir), üstüne premium kotasını bir etiketleme işine yakıyordu. Öğrencinin bilmediği ve
  kayıt tutmadığı şey **hata tipi** — "Problemler'de 8 yanlış" bilgisi _"konuyu tekrar et"_
  dedirtir (çoğu zaman yanlış karar, boşa giden hafta), _"8 yanlışın 6'sı dikkat hatası"_ bilgisi
  _"konu tamam, yavaşla"_ dedirtir.
  **Veri modeli — bilerek ikiye bölünmüş:** `mistake_notebook_entries` öğrencinin yanlış hakkında
  _söylediği_ şeyi tutar (kolon, çünkü iki sorgu var: cron `next_review_at`'i tarıyor, analiz
  `error_type`'ı topluyor); `mistake_notebook_pages` sadece _nereye koyduğunu_ tutar (sorgulanmıyor
  → sayfa başına tek jsonb). Vision board'un aksine kullanıcı başına tek doküman **değil**: defter
  sınırsız büyür, tek sayfayı kaydetmek tüm kitabı yeniden yazmamalı. `mock_exam_id` nullable +
  `ON DELETE SET NULL` — yanlışların çoğu deneme dışında yakalanıyor, deneme silinince ondan
  çıkarılan ders silinmemeli. Migration `0077` elle yazıldı (0074/0075'teki gerekçe: `drizzle-kit
generate` hâlâ 0074 öncesi snapshot'a diff atıyor; ayrıca RLS üretemiyor).
  **Defter görseli CSS + inline SVG, raster asset yok** — `board-stage.tsx:22` kuralı koyuyor:
  arka planlar prosedürel, çünkü canvas exporter'ı her birini yeniden üretmek zorunda. Spiral bir
  SVG `<pattern>`; kendini sayfa yüksekliğine tile ediyor, yani hiçbir yerde ring sayılmıyor veya
  konteyner ölçülmüyor. Sayfa çevirme `framer-motion` `rotateY` (yeni bağımlılık yok),
  `prefers-reduced-motion`'da çapraz geçiş. Tokenlar `theme.css`'e `--notebook-*` olarak eklendi.
  **Tekrar merdiveni sabit: 2 → 7 → 21 gün → HEALED**, SM-2 değil — uyarlanabilir algoritma bizde
  olmayan bir zorluk sinyali ister (burada not yok, sadece "bu sefer çözebildin mi?") ve gerçek
  kullanım olmadan kalibre edilemez. Başarısızlık `reviewCount`'u **sıfırlar**, bir basamak geri
  almaz: üç haftada kaçırılan kart "neredeyse öğrenilmiş" değildir, öyle davranmak kartı merdivenin
  tepesinde sonsuza kadar sektirir. İyileşen kart sayfadan **silinmiyor**, soluklaşıyor — duvar bir
  iyileşme haritası; iyileştikçe boşalan sayfa iyileşmenin kanıtını da götürür.
  **Hatırlatma** kullanıcı başına tek bildirim + sayı taşıyor (girdi başına fan-out verimli bir
  günü bildirim fırtınasına çevirirdi — §0'ın yasakladığı utandırma kalıbı), gün içinde `tryRecord`
  ile idempotent, e-posta kanalı yok (yanlışlar hakkında e-posta saatler sonra ve bağlamsız gelir).
  Notifications coaching'in tablosuna dokunmuyor: `CoachingQueryPort.listNotebookReviewCandidates`.
  **Gotcha — analiz sinyallerinin kaynağı değişti:** `photoSubjectSignals`/`photoTopicSignals` artık
  `mock_exam_photo_categorizations` yerine defter girdilerinden besleniyor. İsimler korundu (rename
  focus engine + weekly review + istemcilere yayılırdı, kullanıcıya faydası sıfır), ama **scope
  değişti**: "hangi denemeler yeniydi" yerine **60 günlük pencere**, çünkü girdilerin çoğunda
  `mock_exam_id` yok. `photo-categorize-card.tsx` silindi, `analysis-shell.tsx`'teki tüm
  photo-access state'i (loader, effect, invalidation) temizlendi.
  **Kapsam dışı bırakılanlar:** kart sürükleme (`use-item-gesture` `VisionBoardItem`'a tiplenmiş,
  jenerikleştirmek vision board editörünü yeniden doğrulamayı gerektiriyor); free'de konu seçimi
  (content'te public topics endpoint'i yok — konu yalnız premium ön-etiketlemeden geliyor);
  topluluk köprüsü; karne→form OCR.
  İlgili: `mistake-notebook.{service,repository}.ts`, `notebook-review.policy.ts`,
  `notebook-error-pattern.policy.ts`, `mistake-notebook.controller.ts`,
  `notebook-review-reminder.service.ts`, `components/notebook/*`, `[locale]/(app)/notebook/*`,
  `lib/notebook{,-layout}.ts`, `drizzle/0077_mistake_notebook.sql`, `messages/{tr,en}.json`.

- **Defter sayfası düzenlenebilir oldu: jest katmanı paylaşıma çıktı (2026-08-14, APP-042)** —
  Defterin "motor" yarısı (şerit, tekrar, bildirim) çalışıyordu ama **"sahiplenme" yarısı** eksikti:
  kartlar otomatik diziliyor, sticker/not yapıştırılamıyordu. Canvas o hâliyle stillenmiş bir
  listeydi.
  **Jest katmanı `components/stage/` altına taşındı ve iki yüzeye birden hizmet ediyor:**
  `board-gesture-math` → `gesture-math`, `use-item-gesture`, `board-selection-overlay` →
  `selection-overlay`. İki bağ koparıldı — tip `VisionBoardItem` yerine `VisionBoardItemBase`
  (dönen dikdörtgen her iki yüzeyde de aynı davranıyor), ve `toCanvasScale` artık `canvasWidth`
  parametresi alıyor (pano 1620, defter sayfası 1080 birim). **`SelectionOverlay`'in `item` prop'u
  tamamen kalktı**: çerçeve ebeveynini dolduruyor, tutamaçlar yüzde konumlu, yani overlay hangi
  tasarım uzayında çizildiğini bilmek zorunda değil — tek bileşenin iki yüzeye hizmet etmesini
  sağlayan da bu. Pano editörü yeniden yönlendirildi, 34 testi geçiyor.
  **`use-board-reducer` bilerek jenerikleştirilmedi.** O reducer panonun kendi kelime dağarcığını
  taşıyor (frame, background, yayın durumu) ve defter sayfasında bunların hiçbiri yok; ikisini
  birden karşılayacak hâle getirmek `use-notebook-page`'in 60 satırından pahalıya gelirdi. Defter
  reducer'ı tek yönlü geçmiş tutuyor (undo var, redo yok — sayfa saniyeler içinde düzenleniyor).
  **Gotcha:** `patch` **checkpoint almıyor**. Sürükleme saniyede onlarca patch atıyor; her birini
  anlık görüntülemek geçmişi neredeyse aynı 100 dokümanla doldururdu — jest, hareket _başlarken_
  tam bir checkpoint alıyor (`use-item-gesture` içindeki `drag.moved` kapısı). Undo, o dokümanda
  hiç var olmamış seçimi de düşürüyor; ikisi de testle çivilendi.
  Düzenleme modunda karta dokunmak **seçiyor, açmıyor** — yoksa her sürükleme denemesi tekrar
  ekranıyla bitiyordu. Kaydetme 900 ms debounce ile otomatik: kullanıcı buraya tekrar etmeye
  geliyor, sürüklediği sticker'ı sayfadan çıktığı için kaybetmesi herhangi bir kaydet
  göstergesinden kötü. Sticker listesi 8 ile sınırlı (panonun 77'si değil) — bu çubuk tekrar
  sayfasının altında duruyor, uzun kuyruk panonun işi.
  İlgili: `components/stage/*`, `use-notebook-page.ts`(+spec), `notebook-edit-bar.tsx`,
  `notebook-page-stage.tsx`, `notebook-shell.tsx`, `lib/notebook-layout.ts`, `board-editor-shell.tsx`.

- **Defter ↔ topluluk köprüsü: yarısı bağlandı (2026-08-14, APP-042)** — Tekrar sırasında ikinci kez
  "yine çözemedim" denen an, öğrencinin takıldığını **kanıtladığı** andı ve şimdiye kadar ölüydü:
  uygulama kartı yeniden zamanlayıp geçiyordu. Artık o anda topluluk teklif ediliyor. **İlk
  kaçırmada değil, ikincide** — ilkinde teklif etmek herkese her seferinde teklif etmek olurdu, yani
  gürültü (`reviewCount > 0` iken kaçırma).
  **Migration 0078** 0077'de bilerek ertelenen üç kolonu getiriyor: `source` (OWN | COMMUNITY),
  `community_thread_id`, `community_answered_at`. Thread id'de **FK yok, bilerek**: thread'ler
  forum'un bounded context'inde, veritabanı seviyesinde bir kenar coaching'in tablosunu forum'unkine
  bağımlı yapardı — silinmiş bir thread "thread yok" diye okunuyor, `exam_id`'nin izlediği soft-ref
  kuralının aynısı.
  **Geri yön tek kuplaj noktası:** `NotebookForumListener`, `forum.answer.accepted` olayını dinleyip
  o thread'e bağlı kartları işaretliyor (economy'nin `ForumEventsListener`'ıyla birebir aynı kalıp).
  Forum defterin varlığını bilmiyor, defter forum tablosuna dokunmuyor. Listener hata yutuyor +
  logluyor: `emitAsync` accept'in içinde await ediliyor, burada fırlatmak zaten commit olmuş bir
  accept'i 500'lerdi. `markThreadAnswered` **çoğul**: iki öğrenci aynı soruyu bağlayabilir, ikisinin
  de kartı cevabı hak eder.
  **Gotcha — `source` girdinin ne _anlama geldiğini_ değil, sorunun nereden geldiğini söyler.**
  Topluluktan gelen soru deftere ancak kullanıcının kendi "ben de çözemedim" beyanıyla giriyor, yani
  zayıflık haritasına `OWN` gibi sayılıyor. Sadece ilginç bulduğu şey forum'un kendi bookmark'ına
  ait; buraya alınsa harita başkalarının eksiklerini anlatmaya başlardı.
  **Yarım kalan yer, bilerek:** thread'i defter **oluşturmuyor**. Hangi zone'a soru sorulacağı
  kullanıcının katıldığı zone'lara bağlı ve defterden zone seçmek tahmin olurdu; ayrıca birinin
  fotoğrafını yabancıların önüne koyan bir eylemi yan panelden sessizce yapmak yanlış şekil. Defter
  devrediyor: telif uyarısı + `/community`'ye yönlendirme. **Topluluk tarafının soruyu oluşturup
  `POST /v1/coaching/notebook/entries/{id}/community-thread` ile geri bağlaması gerekiyor** — o uç
  hazır ve testli, çağıran taraf yok.
  İlgili: `0078_notebook_community_bridge.sql`, `notebook-forum.listener.ts`,
  `mistake-notebook.{service,repository}.ts`, `notebook-review-panel.tsx`, `notebook-entry-card.tsx`,
  `lib/notebook.ts`.

- **Defter E2E testi + ilk gerçek hatalar (2026-08-14, APP-042)** — Defterle ilgili o ana kadarki
  **her test saf mantıktı** (tekrar merdiveni, sayfa reducer'ı, yerleşim, hata-tipi eşiği); hiçbiri
  "kapak gerçekten açılıyor mu", "eklenen kart kaydediliyor mu", "iyileşen kart susuyor mu"
  sorusuna cevap vermiyordu. `apps/web/e2e/notebook.spec.ts` 6 senaryoyu iki viewport'ta koşuyor:
  kapak→sayfa→geri kapak, ekleme (hata tipi zorunlu + ders/konu), konu seçicinin derse göre
  daralması, tekrar akışı + iyileşme, ikinci kaçırmada topluluk teklifi, sticker + undo + autosave.
  **İlk koşuda iki gerçek hata çıktı, ikisi de tipkontrolün göremeyeceği cinsten:**
  (1) `content-topics.ts` `/v1/exams/{slug}/topics`'e gidiyordu ama controller `content/exams`
  altında mount edilmiş — çalışma zamanında 404. (2) Sayfa tamamen boş açılıyordu: bildirim zili
  mock'lanmamış bir uçtan gelen boş 204 üzerinde `.items` okuyup **tüm sayfayı** hata sınırına
  düşürüyordu. İkincisi sadece `page.on("pageerror")` dinlenerek görülebildi, o yüzden dinleyici
  kalıcı hale getirildi: hatalar toplanıyor ve kapak testinde `toEqual([])` ile doğrulanıyor —
  bir sonraki sessiz çökme sessiz kalmasın.
  **Gotcha:** E2E `next start` istiyor, yani `pnpm --filter @mentor/web build` olmadan koşmuyor
  (`playwright.config.ts` webServer). Ayrıca mock tablosundaki catch-all `204` döndürdüğü için
  **uygulama kabuğunun çağırdığı her uç açıkça mock'lanmalı**, yoksa hata defterde değil kabukta
  patlar ve teşhis yanıltıcı olur.
  İlgili: `apps/web/e2e/notebook.spec.ts`, `apps/web/src/lib/content-topics.ts`.

- **Defter kabuğu 2. tur: rail+panel yan menü, bağımsız sayfa kaydırma, gelişmiş spiral (2026-08-14,
  APP-042)** — Kullanıcı geri bildirimiyle dört değişiklik: (1) sabit rail (Ekle/Sticker/Not/Kağıt
  ikonları) + açılır-kapanır panel, vision-board editörünün `board-side-panel.tsx` kalıbı birebir
  taşındı (`notebook-side-panel.tsx`); monolitik `notebook-edit-bar.tsx` kaldırıldı. (2) "Defteri aç"
  butonu kalktı — kapağın kendisi artık `role="button"` + `tabIndex` + `onKeyDown` ile açılan kontrol
  (`NotebookCover`'a `onOpen`/`openLabel` eklendi); klavye/ekran okuyucu erişimi kaybolmadı, sadece
  ayrı bir buton olmaktan çıktı. (3) Sayfa çevirme artık **sadece değişen sayfa** kayıyor: eskiden
  tüm çift sayfa tek bir `rotateY` bloğu gibi dönüyordu, şimdi sol ve sağ sayfa **bağımsız**
  `AnimatePresence` bölgeleri (`overflow:hidden` kesme kutusu + `translateX` slide), ikisi de aynı
  `direction`'a göre kayıyor ama spine ve karşı sayfa sarsılmıyor. Kapak↔açık-defter geçişi ayrı bir
  dış `AnimatePresence` (crossfade, `mode="wait"` — aspect-ratio tek-sayfadan çift-sayfaya sıçradığı
  için üst üste binmesin diye) . (4) Spiral: halka artık **kapalı elips + ayrı vurgu elipsi + delik
  üstte radial-gradient** — tel dokunun içinden geçiyormuş gibi görünüyor, "metalik" parlama ayrı bir
  ince stroke. Görsel asset eklenmedi; prosedürel iyileştirme yeterli görüldü (mimari zaten raster'ı
  reddediyordu — bkz. dosya başındaki not).
  **Undo/sil artık rail kategorisi değil**, vision-board'un canvas üstü mini araç çubuğu gibi ayrı
  bir ikon satırı — ikisi de `focused` (en son dokunulan taraf) üzerinde çalışıyor.
  **Bilerek karar verilen açık nokta:** "Ekle" panelinin içinde `NotebookAddPanel` kendi `Card`
  sarmalayıcısıyla geliyor, bu da panel+kart iç içe iki kutu gibi görünebilir — kozmetik, gerekirse
  `NotebookAddPanel`'in kartı soyulabilir.
  İlgili: `notebook-shell.tsx` (yeniden yazıldı), `notebook-side-panel.tsx` (yeni),
  `notebook-surface.tsx` (spiral + `NotebookCover.onOpen`), `notebook-edit-bar.tsx` (silindi).

- **Defter kabuğu 3. tur: sayfa geçişi katmanlanıyor, tam sticker seti, foto-önce kart, sayfa-içi not
  düzenleme (2026-08-14, APP-042)** — Beş değişiklik: (1) **Sayfa çevirme artık tek birim.** Sol ve
  sağ sayfa ayrı `AnimatePresence` bölgeleri olmaktan çıktı; çift sayfa TEK bir kaydırılan blok, gelen
  blok `zIndex:2` ile giden bloğun (`zIndex:1`) **üstünden geçerek** kapanıyor — "sağdaki yaprak
  soldakinin üstüne gelecek" isteğinin karşılığı. İki katmanlı yapı korunuyor: dış `AnimatePresence`
  (`mode="wait"`) sadece kapak↔açık-defter arasında geçiyor (en-boy oranı tek sayfadan çifte
  sıçradığı için üst üste binmesin diye bekliyor), iç `AnimatePresence` sayfa çevirmeleri için
  (üst üste binsin diye beklemiyor — "üstüne gelme" efekti bunu gerektiriyor). Framer Motion'ın
  `initial`/`exit` prop'ları fonksiyon kabul etmediği için (`custom` sadece `variants` üzerinden
  çalışıyor) geçiş `variants` objesine taşındı.
  (2) **Sticker alanı vision-board'un tam 68 parçalık setine çıktı** — önceki 8'lik "ponytail"
  kısayolu kaldırıldı (kullanıcı haklıydı: mimari zaten paylaşılıyor, kısıtlamanın gerekçesi
  zayıftı). Aria-label'lar da tekrar üretilmedi — `vision.board.sticker_*` çevirileri (68 anahtar)
  doğrudan kullanılıyor, notebook namespace'ine ikinci bir kopya açılmadı. Panel genişliği `lg:w-64`
  → `lg:w-80`.
  (3) **Fotoğraflı kart artık sadece fotoğraf.** Chip/konu/not/durum satırı karta gömülü değil,
  `group-hover`/`group-focus-within` ile açılan bir overlay'e taşındı (saf CSS, yeni kütüphane yok).
  Tıklama artık **tam ekran önizleme** açıyor (`NotebookImageLightbox` — community'nin galeri
  lightbox'ının tek-görsel, ok/karusel'siz sadeleştirilmiş hali). **Bilinen ödün:** fotoğraflı
  kartlarda çift-tıkla-incele artık ulaşılamaz — ilk tıklama önizlemeyi açtığı için ikinci tıklama
  önizlemenin arka planına düşüyor (kapatıyor), stage'in `onDoubleClick`'ine hiç ulaşmıyor.
  Fotoğrafsız (yalnızca not) kartlarda çift-tık-incele aynen çalışıyor. Fotoğraflı kartlar için
  inceleme yolu tekrar şeridi akışı.
  (4) Not girme sidebar formu tamamen kaldırıldı. "Not" artık bir kategori değil, vision-board'un
  `addText` deseniyle birebir aynı **anlık eylem**: tıklanınca boş bir not öğesi odaklı sayfaya
  ekleniyor ve **sayfa üzerinde** satır-içi `<textarea>` (`NotebookTextInlineEditor`,
  `BoardTextInlineEditor`'ın notebook'a taşınmış hali) doğrudan düzenleme moduna giriyor — ayrıca
  çift tıklama da (artık entry+text kolu birlikte) aynı düzenleyiciyi açıyor. Boş bırakılıp
  odaktan çıkılırsa öğe **silinir**, hiçbir zaman boş metinle kaydedilmez (şema `min(1)` istiyor).
  `NotebookPageStage`'e vision-board'un `contentHiddenId` deseni eklendi — düzenlenen öğenin statik
  render'ı, üstündeki textarea ile çakışmasın diye gizleniyor.
  (5) Alt boşluk + kapak butonu: kabuğa dikey padding eklendi, önceki/sonraki butonlar sütunun
  altına sabitlendi; "Defteri aç" butonu kalktı, kapağın kendisi `role="button"` + klavye desteğiyle
  açılan kontrol oldu.
  İlgili: `notebook-shell.tsx`, `notebook-side-panel.tsx`, `notebook-entry-card.tsx`,
  `notebook-page-stage.tsx`, `notebook-text-inline-editor.tsx` (yeni),
  `notebook-image-lightbox.tsx` (yeni), `notebook-surface.tsx`.

- **Defter kabuğu 4. tur: gerçek yaprak çevirme, daha büyük defter, alta oturan sayfa kontrolleri
  (2026-08-15, APP-042)** — Kullanıcı geri bildirimi netti: "şu anda sağdan sola doğru **yatay
  zeminde** kayıyor", istenen ise gerçek bir kitapta olduğu gibi **tek yaprağın** ciltten kalkıp
  kıvrılarak **karşı sayfanın üstüne** düşmesi. Üç değişiklik:
  (1) **`NotebookPageTurn` (yeni).** 3. turda gelen "tek blok kayan çift sayfa" ve onun ardından
  denenen "çift sayfayı birlikte `rotateY` ile döndürme" ara adımı da yanlıştı: gerçek kitap **iki
  sayfayı birlikte döndürmez**, ciltte menteşelenmiş **tek yaprağı** çevirir. Artık iki canlı
  sahnenin üstünde uçan, `pointer-events:none` + `aria-hidden` **dekoratif** bir yaprak var:
  `transform-origin` spine tarafında, `rotateY` 0→∓180, `backface-visibility` ile ön yüz (defterin
  kendi kağıt deseni, `PAPERS` yeniden kullanıldı) ve arka yüz (kağıdın alt tarafı — çizgisiz,
  gri degrade) otomatik takas ediliyor. Kıvrım hissi üç ucuz sinyalden: menteşede koyu kırışık +
  serbest kenarda parlama degradesi, serbest kenarda yumuşayan `border-radius`, ve yaprak dikey
  konuma gelirken `scaleY` 1→0.972 (ayakta duran kağıt yatan kağıttan kısa görünür). Ayrıca yaprağın
  düştüğü sayfaya süpürülen ayrı bir gölge katmanı var. Yaprak **dekoratif olduğu için** alttaki
  `useItemGesture` sürükleme/seçim katmanı çevirme sırasında hiç sökülüp kurulmuyor.
  **Bilerek bırakılan iki tavan** (`ponytail:` yorumlarıyla dosyada işaretli): (a) uçan yaprak
  **boş kağıt**, sayfanın gerçek öğelerini taşımıyor — taşımak uçuş boyunca 3. ve 4. sayfa
  dökümanını da bellekte tutmayı gerektirirdi, ~600 ms'de kimsenin okuyamayacağı bir kazanç için;
  gerekirse `left±2` erken çekilip iki yüze etkileşimsiz `NotebookPageStage` basılır. (b) Kıvrım
  **gölgelendirme, geometri değil** — kağıdın gerçekten bükülmesi (sütun sütun deformasyon) WebGL
  veya canvas tabanlı bir page-flip kütüphanesi ister, ikisi de sahnelerimizin yaşadığı DOM'u
  sahiplenmek istiyor.
  Alttaki içerik takası artık kaymıyor, **çapraz solma** (yaprağın süresinin %80'i, `easeInOut`) —
  değişim en görünür olduğu orta noktada yaprak zaten spine üzerinde duruyor. Tam kitap doğruluğu
  (açılan taraf t=0'da, örtülen taraf t=0.5'te değişsin) giden sayfanın dökümanını uçuş boyunca
  tutmayı gerektirir; yarım vuruşluk fark gerçekten göze batarsa yapılacak iş bu.
  `prefers-reduced-motion` açıkken yaprak hiç oluşturulmuyor, sade crossfade kalıyor.
  (2) **Defter büyüdü:** genişlik tavanı 1180px→1440px, yükseklik bütçesi %74/%80dvh→%88/%92dvh
  (kapak dahil). `object-fit: contain` mantığı korundu — defter hâlâ sayfanın kendisini kaydırmaya
  zorlayamıyor.
  (3) **Sayfa kontrolleri gerçek alta oturdu:** kabuk `min-h-[100dvh]`, orta satır `flex-1` — mevcut
  `mt-auto` artık viewport'un gerçek altına yaslanıyor, defterin hemen altında asılı kalmıyor.
  İlgili: `notebook-page-turn.tsx` (yeni), `notebook-shell.tsx`.

- **Defter büyütmesi kaydırmaya sebep oldu, bütçe geri çekildi (2026-08-15, APP-042)** — 4. turda
  yükseklik bütçesi %74/%80dvh→%88/%92dvh yapılmıştı; bu, araç çubuğu (geri al/sil/kaydet) + sayfalama
  satırı + boşluklar için ayrılmış payı neredeyse sıfırladı. `min-h-[100dvh]` kabuk + `flex-1` sütun
  içindeki defter kendi `aspectRatio`'suyla sabit yükseklikte (flex tarafından küçültülemez), bu yüzden
  toplam içerik (araç çubuğu + defter + sayfalama + padding) 100dvh'i aştığında sayfa **kayan** bir
  sayfaya dönüştü. Bütçe %78/%84dvh'e çekildi — orijinal %74/%80'den hâlâ büyük ama krom için ~beşte
  bir viewport payı geri verildi. Kalıcı not: bu bütçeyi tekrar büyütmeden önce toolbar+pagination+
  padding'in gerçek yüksekliğini ölç, körlemesine artırma.
  İlgili: `notebook-shell.tsx`.

- **Defter biraz daha büyüdü (2026-08-15, APP-042)** — Taşma düzeldikten sonra ekran görüntüsünde hâlâ
  belirgin siyah pay vardı (yanlarda ve altta). Bütçe %78/%84dvh→**%84/%90dvh**, genişlik tavanı
  1440px→**1680px** (kapak 680px→**760px**). Krom payı beşte birden ona indi; taşma tekrar denendi,
  yok.
  İlgili: `notebook-shell.tsx`.

- **%84/%90dvh de taştı, %80/%86'ya çekildi + alt boşluk sıkıldı (2026-08-15, APP-042)** — Kullanıcı
  bir önceki büyütmenin de taştığını bildirdi; "alttaki butonları küçültelim mi" sorusuna DESIGN.md'nin
  bağlayıcı kuralıyla ("Etkileşim hedefleri en az 44px") cevap hayır oldu — sayfalama okları `size-11`
  (44px, dokunma hedefi tabanı) altına düşürülmedi. Onun yerine: bütçe %84/%90dvh→**%80/%86dvh** (ilk
  denenen kararlı değer %78/%84'ün az üstü, bilinerek çalışmayan %84/%90'ın altı), sayfalama satırının
  kendi `gap-4 pt-2`→**`gap-3 pt-1`**'i sıkıldı — birkaç px'lik pay butonlardan değil boşluktan geri
  alındı. **Ders:** bu bütçeyi bir daha "gözle" büyütmeden önce toolbar+pagination+padding'in gerçek
  px yüksekliğini ölç; iki turdur körlemesine artırıp iki turdur geri çekiliyoruz.
  İlgili: `notebook-shell.tsx`.

- **Defter kabuğu 5. tur: tek merkezî cilt, kapak menteşesi, kağıt geçişi (2026-08-15, APP-042)** —
  Kullanıcı iki referans görsel verdi (açık spiralli defter + mevcut ekran görüntüsü) ve teşhis nettir:
  "spiral ortada olacak ve yaprakları birbirine bağlayacak — şu anda ayrı ayrı duruyor". Dört değişiklik:
  (1) **`NotebookSpine` (yeni).** Her sayfa kendi sol kenarında `SpiralBinding` çiziyordu; iki sayfa
  yan yana gelince ortaya "iki ayrı defter" çıkıyordu. Artık **tek cilt**: spine'da duran tek bir SVG,
  kendi sütununun dışına taşarak (`left:-70%`, `width:240%`) her iki yaprağın **iç kenarına** deliklerini
  basıyor ve halkalarını oluğun üzerinden geçiriyor — gerçek bir spiralde teli iki yaprağın deliğinden
  birden geçiren o çapraz geçiş, iki sayfanın "tek kitap" okunmasının tek sebebi. `zIndex:2` ile
  kağıdın üstünde. Halka ritmi (`RING_STEP`, aynı tile yüksekliği) `SpiralBinding` ile paylaşılıyor, ki
  kapak ile açık defter aynı defter gibi hizalansın. Gradient tanımları `BindingDefs`'e çıkarıldı.
  (2) **`NotebookPageSurface` artık ciltlenme kenarını biliyor:** `binding: "left" | "right"` (çizgi,
  kırmızı marj çizgisi, spiral sütunu ve içerik padding'i tek bayraktan türüyor — bir sayfa asla bir
  kenardan çizgili başka kenardan padding'li kalamaz) + `coil: boolean` (spread'de tel spine'ın işi,
  sayfa sadece delikli marjını koruyor). Sol sayfa `binding="right" coil={false}`, sağ sayfa
  `binding="left" coil={false}`.
  (3) **Spread geometrisi tek sayıdan türüyor.** `SPINE_GUTTER` 56→**48** ve `notebook-surface.tsx`'e
  taşındı; oradan
  `PAGE_PERCENT` / `SPINE_PERCENT` türetiliyor. Kabuğun en-boy oranı, spine genişliği ve uçan yaprağın
  uçuş yolu artık üç ayrı elle ayarlanmış yüzde değil, aynı sayının türevi. (Kabuk `notebook-page-turn`'ü
  import ettiği için sabitler kabukta duramazdı — döngüsel import olurdu.)
  **Oluk bilerek dar.** İlk denemede 120 yapılmıştı ("tele yer açalım") ve sonuç yanlıştı: halkalar o
  genişliği kapatmak için gerilince cilt değil **tel örgü çit** gibi okundu, arada da uygulama arka planı
  göründü. Gerçek açık spiralli defterde iki yaprak neredeyse birbirine değer, delikler tam iç kenara
  açılmıştır ve tel dar bir kanalda ilerler. İki tur daralttıktan sonra oturan değerler: oluk
  120→48→**34** (≈%1.55), SVG taşması olukla orantılı
  (`left:-50%`, `width:200%` — ikinci bir elle ayarlanmış sayı olmasın diye), `RING_STEP` 7.2→**5.6**,
  halka `rx` %36→%34, delikler %16/%84→**%23/%77** (yani yaprakların delinmiş kenarına). Spine artık
  şeffaf değil: kağıt rengi + iki dudakta koyulaşan degrade, yani sayfaların cilde kıvrıldığı kanal.
  (4) **Üç animasyon eklendi/derinleştirildi.** (a) **Kağıt tipi** (çizgili↔kareli↔noktalı↔düz) artık
  anında sıçramıyor, `AnimatePresence` ile `paper`'a keyed 0.3s çapraz solma — çizgi deseni sayfanın
  dokusunun kendisi, tek karede takas edilmesi "render hatası" gibi okunuyordu; kırmızı marj çizgisi de
  ait olduğu desenle birlikte gidiyor. Opaklık geçişi zaten hareketin _azaltılmış_ alternatifi olduğu
  için ayrı `prefers-reduced-motion` dalı yok. (b) **Kapak** artık crossfade değil, gerçek kapak gibi
  **sol kenarından (spine) menteşeli** açılıyor/kapanıyor (`rotateY` 0↔-105°, sarmalayıcıda
  `perspective:1800`) — yapraklarla aynı eksen, aynı easing, dolayısıyla "aynı nesne" hissi.
  (c) **Yaprak çevirme derinleşti:** süre 0.62s→**0.78s**, perspektif 2000→**1400** (uzak perspektif
  yayı düzleştirip "silme" efektine benzetiyordu), bükülme `scaleY` 0.972→**0.952**, düşen yaprağın
  gölgesi belirginleşti.
  İlgili: `notebook-surface.tsx` (`NotebookSpine` + `BindingDefs` + `binding`/`coil` + geometri),
  `notebook-shell.tsx`, `notebook-page-turn.tsx`.

- **Yaprak kıvrılırken taşıyordu, `overflow:hidden` geri kondu (2026-08-15, APP-042)** — Bu turun asıl
  hatası boyut/bütçe değil, bir regresyondu: `NotebookPageTurn`'ü eklerken sarmalayıcı `spread-container`
  için "artık spread'in kendisi taşımıyor, o yüzden `overflow:hidden` gereksiz" diye düşünülmüştü — ama
  uçan yaprak `perspective` + `rotateY` + `scaleY` ile döndüğü için kendi kutusunun _mürekkep taşması_
  ("ink overflow") ekrana onun kutusundan büyük çiziliyordu, kırpan hiçbir şey olmadığı için tarayıcı
  bunu kaydırılabilir alan sayıp **body'yi kaydırıyordu**. Düzeltme: `spread-container`'a
  `overflow:hidden` geri kondu — hem sürükle-çevir spread'ini hem uçan yaprağı (kendi kırpması yok)
  defterin kendi kutusuna kırpıyor. Yaprağın kutusu (`top:0,bottom:0`, genişlik `PAGE_WIDTH`) zaten
  konteynerin içinde kaldığı için normal koşullarda kırpma yaprağı görsel olarak kesmiyor.
  İlgili: `notebook-shell.tsx`.

- **Defter kabuğu 6. tur: not için vision-board'un yazı editörü (2026-08-15, APP-042)** — Kullanıcı
  vision-board'un "Metin" panelinin ekran görüntüsünü referans verip "metin girildiğinde vision-
  board'da olduğu gibi metin editörü de ekleyelim" dedi. Notebook'un metin öğeleri zaten birebir
  `VisionBoardTextItem` (font, boyut, satır/harf aralığı, arka plan "plaka" rengi, döndürme — hepsi
  şemada var), sadece hiç yüzeye çıkmıyordu; `NotebookTextInlineEditor`'daki eski not "notebook
  exposes no font/colour controls" artık geçersiz.
  (1) **`NotebookPanelCategory`'ye `"text"` eklendi.** "Not" ekleme rail'de ayrı bir _eylem_ olarak
  kalıyor (kategori değil — sayfaya anında yerleşip satır-içi düzenlemeye giriyor, board'un `addText`'i
  gibi); yeni "text" kategorisinin kendi ekleme butonu yok, sadece seçili notun font/boyut/plaka/
  satır aralığı/harf aralığı/döndürme kontrollerini gösteriyor. Not seçili değilken kısa bir ipucu
  metni (`text_panel_empty`).
  (2) **Otomatik açılma, board'daki `handleSelect` ile birebir aynı desen.** Board'da bir metin öğesi
  seçilince panel otomatik "Metin" kategorisine geçiyor (`board-editor-shell.tsx:188`); notebook'a
  aynı davranış `handleSelect(side, id)` ile geldi — hem sol hem sağ sayfanın `onSelect`'i artık buna
  yönleniyor, seçilen öğe `text` ise panel `"text"`'e geçip açılıyor. `handleAddNote` da aynısını
  yapıyor, ki "Not" ile eklenen taze not, sayfa üstündeki satır-içi yazma kutusuyla **birlikte** yan
  panelde de kontrol edilebilir olsun.
  (3) **`Field`/`Row`/`Pill`/`Swatch`/`Range` yardımcıları `board-side-panel.tsx`'ten birebir
  kopyalandı** (sadece stil taşıyan, board'a özgü state tutmayan yarısı) — paylaşmak o dosyanın kendi
  route'unun `_components`'inden dışarı çıkarmak demekti, ~80 satırlık salt-stil yardımcıyı
  kopyalamak o cross-route erişimden daha ucuz görüldü. Aynı gerekçeyle `PLATE_COLORS` da
  `NOTE_PLATE_COLORS` olarak yerelde kopyalandı (`board-palettes.ts` route-özel). `board-swatch.tsx`'in
  kendi renk-adı tooltip'i taşınmadı — sekiz plaka rengi gözle tanınabilir, board'un `vision.board`
  renk-adı çevirilerine bağımlılık eklemeye değmedi.
  (4) **Çeviri anahtarları board'dan ödünç alınıyor** (`font`, `size`, `plate`, `line_height`,
  `letter_spacing`, `rotation` — `useTranslations("vision.board")`), tıpkı sticker isimlerinin zaten
  yaptığı gibi; tek yeni anahtar `notebook.text_panel_empty` (boş durum ipucu).
  İlgili: `notebook-side-panel.tsx`, `notebook-shell.tsx`, `messages/{en,tr}.json`.

- **Sürükleyerek sayfa çevirme kaldırıldı (2026-08-15, APP-042)** — Kullanıcı: "sayfa değişikliği
  sadece alttaki butonlarla olsun, şu anda yaprak üzerinde mouse ile değiştirilebiliyor". Dönen
  yaprağın kendisi zaten dekoratif ve tıklanamaz olsa da, altındaki spread'e framer-motion'ın
  `drag="x"` + `onDragEnd` eşik mantığı hâlâ bağlıydı — fare/parmakla sürükleyerek de sayfa
  çevrilebiliyordu. `drag`/`dragElastic`/`dragConstraints`/`onDragEnd` ve artık kullanılmayan
  `TURN_THRESHOLD_PX` kaldırıldı. Sayfa değiştirme artık yalnızca alt oklardan ve klavye
  ok tuşlarından (`turn()`, değişmedi) çalışıyor.
  İlgili: `notebook-shell.tsx`.

- **Defter kabuğu 7. tur: mobilde tek yaprak (2026-08-15, APP-042)** — Kullanıcı ekran görüntüsüyle
  net bir sorun gösterdi: dar ekranda iki-sayfalık spread'in en-boy oranı (`SPREAD_WIDTH_PER_HEIGHT`,
  geniş bir oran) telefon genişliğine sıkışınca yükseklik çok küçülüyor, defter ince bir şerit gibi
  üstte kalıp altında kocaman siyah boşluk bırakıyordu. İstek: "mobil görünümde sayfa tek yaprakta
  gözüksün, taşma durumunu önleyelim yine".
  (1) **`MOBILE_QUERY = "(max-width: 639px)"`** (Tailwind'in kendi `sm` kırılımı) + `matchMedia` ile
  `isMobile` state — `vision-board-shell.tsx`'in zaten kullandığı desenin birebir aynısı
  (`addEventListener("change", sync)`).
  (2) **`mobileSide: "left" | "right"`** — spread'in hangi yaprağının o an tek başına göründüğünü
  tutuyor. `goPage(dir)` adında yeni bir yönlendirici: mobilde ve spread içindeyken, gösterilen
  yaprak henüz spread'in kenarına (dir'e göre sağ/sol) gelmediyse SADECE `mobileSide`'ı değiştirip
  spread içi bir yaprak çeviriyor (fetch yok, `turn()`'e hiç dokunmuyor); kenara gelindiyse asıl
  `turn(dir)`'i çağırıp inen tarafı ayarlıyor. Masaüstünde `goPage` sadece `turn`'e devrediyor —
  davranış değişmedi. Pagination butonları, klavye ok tuşları ve kapağın `onOpen`'ı hepsi `turn`
  yerine `goPage`'e yönlendirildi.
  (3) **`NotebookPageTurn`'e `single?: boolean`.** Spread-geometrisine bağlı (`PAGE_PERCENT`,
  `RIGHT_PAGE_LEFT`) hesaplar `single` modunda tam-genişlik + her zaman sol menteşeye sabitlendi
  (telefon her zaman TEK sayfa gösteriyor, spine her zaman kendi sol kenarında — spread'in
  sağ/sol'a göre değişen menteşesi tek yaprakta anlamsız). Hem spread-arası `turn()` içindeki
  `flip` hem `goPage`'in spread-içi flip'i artık `single: isMobile` taşıyor.
  (4) **Tek yaprak render'ı** — spread ağacı `isMobile` ise `NotebookPageSurface`'i varsayılan
  `binding="left" coil` (kendi spiraliyle normal tek sayfa görünümü, kullanıcının referans
  görselindeki gibi) ile TEK basıyor, `NotebookSpine`/ikinci `NotebookPageSurface` hiç render
  edilmiyor. Crossfade key'i mobilde `spread-${left}-${mobileSide}` — spread içi geçişin de kendi
  view state'i yokken yine de tetiklenmesi için.
  (5) **Boyut/taşma:** `MOBILE_LEAF_MAX_WIDTH` kapak ile aynı tek-sayfa oranını, ama spread'in
  krom bütçesini (80dvh — araç çubuğu + sayfalama + padding kapak'takinden fazla) kullanıyor;
  kapağın kendi 86dvh'i buraya uymazdı (kapak ekranında araç çubuğu yok). Wrapper'ın
  `aspectRatio`'su da `isSpread && !isMobile` şartına bağlandı.
  (6) `focused` artık `isMobile ? mobileSide : focusedSide`'dan türüyor — ayrı bir senkron `useEffect`
  yazılmıştı ama `react-hooks/set-state-in-effect` (`biome`) reddetti ("effect içinde senkron
  setState kademeli render'a yol açar"); state'i ayrı tutup effect'le eşitlemek yerine `focused`'ı
  doğrudan `isMobile`'a göre türetmek hem daha az kod hem kural-uyumlu.
  Yeni çeviri anahtarı: `notebook.page_label` ("Sayfa {page}") — mobilde `page_range_label`
  ("Sayfa {from}-{to}") yerine geçiyor.
  İlgili: `notebook-shell.tsx`, `notebook-page-turn.tsx`, `messages/{en,tr}.json`.

- **Mobilde alt oklar ekranın altında kalıyordu, ayrı bütçe eklendi (2026-08-15, APP-042)** —
  `MOBILE_LEAF_MAX_WIDTH` yanlışlıkla spread'in %80dvh bütçesini paylaşıyordu. O bütçe rail'in
  (Ekle/Sticker/Kağıt/Not) masaüstünde `lg:flex-row` ile içeriğin **yanında** durduğunu varsayarak
  hesaplanmıştı; `lg` altında aynı rail düz `flex-col`'a düşüp içeriğin **üstüne** tam bir satır
  daha ekliyor — araç çubuğu+sayfalama+padding'in üstüne. Sonuç: sayfalama okları ekranın altına
  taşıp görünmez oldu. Mobil için ayrı, daha küçük bütçe: %80dvh→**%70dvh**, rail'e kendi ~%10dvh'i
  bırakıldı.
  İlgili: `notebook-shell.tsx`.

- **Dördüncü taşma turu: dvh tahmini terk edildi, flex tabanlı gerçek boyutlandırmaya geçildi
  (2026-08-15, APP-042)** — Kullanıcı: "sorun devam ediyor, mobilde hâlâ scrollable yapı var".
  Art arda dört `calc(Ndvh * oran)` tahmini (masaüstünde %88/%92, %84/%90, mobilde %80dvh, sonra
  %70dvh) her seferinde en az bir kez taştı — her tur "araç çubuğu+sayfalama+padding ne kadar yer
  kaplıyor" diye gözle tahmin edip bir dvh sayısı yazmak, gerçek krom yüksekliği değişince
  (rail'in masaüstünde yanda, mobilde üstte olması gibi) tekrar tekrar yanlış çıktı.
  **Kök çözüm: tahmin etmeyi bırak, flexbox'a gerçek sayıyı hesaplat.** Defter sarmalayıcısı artık
  kendi genişliğinden (`aspectRatio`) yükseklik türetmiyor — tam tersi: sütunun bir flex öğesi
  (`flex: 1 1 0%`, `min-height: 0`) oldu, araç çubuğu ve sayfalama satırlarından (kardeşleri, doğal
  yükseklikte) **arta kalan gerçek pikseli** flexbox'tan alıyor, `aspectRatio` de genişliği o
  flex-çözümlü yükseklikten türetiyor — yön tersine döndü. `maxWidth` artık sadece düz bir piksel
  tavanı (`1680px`/`760px`/`480px`), krom için gizli bir bütçe taşımıyor.
  Bunun çalışması için nested flex zincirinde her katman `min-height`/`min-width`'in varsayılan
  `auto` (içerik-tabanlı taban) tuzağından çıkmalı: sütun (`min-h-0 min-w-0` — masaüstünde yatay,
  mobilde dikey yön değiştiği için ikisi de gerekti) ve satır (`min-h-0`, savunma amaçlı) da
  eklendi. **Sayfalama satırındaki `mt-auto` kaldırıldı** — flexbox'ta auto-margin'ler flex-grow'dan
  ÖNCE boş alanı kapar; defter zaten sütunun tek `flex-grow` öğesiyken yanına bir de auto-margin'li
  kardeş koymak, o boş alanı auto-margin'e kaptırıp defterin yüksekliğini sıfıra çökertirdi. Artık
  sayfalama satırı hiçbir margin numarası olmadan, defterden sonra doğal boyutunda duruyor.
  Kök nedeni tam bu yüzden dört tur boyunca atlanmıştı: defterin boyutu **içerikten** (kendi
  `aspectRatio`'sundan) türüyordu, ki bu da onu ata zincirine geri "doğal yükseklik" olarak sızdırıp
  `ROOT`'un `min-h-[100dvh]`'ini aşmasına (ve sayfayı kaydırmaya) sebep oluyordu — hangi `dvh` sayısı
  yazılırsa yazılsın, ölçüm YÖNÜ ters olduğu sürece taşma garanti kalıyordu.
  İlgili: `notebook-shell.tsx`.

- **Beşinci tur: flex+aspectRatio de yanlış çıktı, JS-ölçümlü "contain" ile değiştirildi
  (2026-08-15, APP-042)** — Bir önceki tur ("dördüncü taşma turu") flex'in kendi hesapladığı
  yüksekliği `aspectRatio`'ya devretmenin dvh tahminini gereksiz kılacağını iddia etmişti; kullanıcı
  "hem X hem Y ekseninde overflow var" diye bildirdi ve haklıydı — o yaklaşım da yanlıştı, farklı bir
  şekilde. İki ayrı hata iç içeydi:
  (1) Sarmalayıcının kendisi `flex:1 1 0%` + `aspectRatio` taşıyordu: flex-çözümlü YÜKSEKLİK'ten
  genişlik türetiliyordu ama genişliği sütunun gerçek genişliğine karşı **kırpan hiçbir şey yoktu**
  (sütunun `items-center`'ı çocuğu geniş olsa bile ortalar, taşırmaz-hale getirmez) — dar telefonda
  yaprak sağdan taşıyordu (X ekseni).
  (2) Bunu "iç/dış kutu" ayrımıyla düzeltmeye çalışırken (`width:auto;height:auto;aspect-ratio;
max-width;max-height:100%`) statik bir HTML test sayfasında **gerçekten ölçüldü** (kod tabanına
  hiç girmeden `apps/web/public/` altında geçici bir dosyayla) ve iki gerçek bulgu çıktı:
  boş içerikli bir kutuda `width:auto;height:auto` + `aspect-ratio` **0×0'a çöküyor** (flex satır
  yönünde ana eksen içerik-tabanlı boyutlanıyor, boş kutunun içeriği de 0); ve `width:min(100%,cap);
height:auto;aspect-ratio;max-height:100%` kombinasyonunda `max-height` devreye girince oran
  **korunmuyor, kutu eziliyordu** (genişlik sabit kalıp yükseklik kırpılıyor) — yani düz bir
  `<div>`'in `aspect-ratio`'su, bir `<img>`'in `max-width`/`max-height` içinde oranını koruyarak
  küçülmesi gibi davranmıyor.
  **Gerçek düzeltme: CSS'e güvenmeyi bırakıp JS ile ölç.** `useFitSize` (yeni), dış kutuyu
  `ResizeObserver` ile izleyip gerçek piksel genişlik/yüksekliğini veriyor; `fitWithin` (yeni, saf
  fonksiyon, `object-fit:contain`'in yaptığı aritmetik) o ölçümden defterin genişlik×yükseklik'ini
  hesaplıyor — hangi eksen bağlayıcıysa ona göre küçülüyor, hiçbir eksende taşmıyor. İç kutu artık
  `aspectRatio` CSS'i değil, doğrudan hesaplanmış piksel `width`/`height` taşıyor. Üç eski
  `calc(Ndvh*oran)` sabiti (`NOTEBOOK_MAX_WIDTH` vb.) düz piksel sayılarına indirgendi
  (`NOTEBOOK_MAX_WIDTH_PX` vb.) — artık sadece üst sınır, boyutu belirleyen değil.
  **Doğrulama yöntemi de değişti:** önceki dört tur hiç ölçülmeden, sadece kodu okuyup mantık
  yürüterek "artık doğru" denmişti. Bu turda hem izole bir `ResizeObserver`+`aspect-ratio` testi hem
  de gerçek bileşen ağacının bir kopyası `apps/web/public/`'a geçici olarak yazılıp tarayıcıda
  `getBoundingClientRect()`/`document.documentElement.scrollWidth` ile gerçekten ölçüldü, sonra
  silindi — koda girmeden önce.
  İlgili: `notebook-shell.tsx` (`useFitSize`, `fitWithin`, yeni).

- **Altıncı tur: JS-ölçümlü genişlik + aspectRatio yükseklik (görünmezlik + taşma birlikte çözüldü)
  (2026-08-15, APP-042)** — Beşinci turun "JS ile ölç" fikri doğruydu ama uygulaması yanlıştı:
  `useFitSize`'ın ölçtüğü değeri hem `width` hem `height`'e DOĞRUDAN piksel olarak basıyordu
  (`width: fitted.width, height: fitted.height`), ve ilk render'da (ResizeObserver henüz ateşlemeden)
  bu değerler `{0,0}` idi — kullanıcı "hiçbir şey gözükmüyor" dedi, haklıydı: sayfa gerçekten 0×0
  render ediyordu, üstelik `useEffect` (asenkron, boyama sonrası) kullanıldığı için bu ilk kare her
  zaman görünür kalabiliyordu.
  **Düzeltme, ölçümü DOĞRU yöne uyguladı.** Altıncı turda anlaşıldı ki 5. turdaki asıl doğru fikir
  ilk (birinci) turun mekanizmasıydı — `aspectRatio`'nun WIDTH'ten HEIGHT türetmesi (tek yön, hiçbir
  zaman 0'a çökmez, çünkü sadece bir boyut `auto`) — bozuk olan hiç mekanizma değil, sadece genişliğe
  yazılan `dvh` SAYISIYDI. Şimdi: `useFitSize` `useLayoutEffect` + anlık `getBoundingClientRect()`
  ile (ResizeObserver'ın ilk callback'ini beklemeden, boyamadan ÖNCE) dış kutuyu ölçüyor;
  `fitWithin`'in sonucu SADECE `maxWidth`'e besleniyor (`width:"100%" maxWidth:<ölçülen>
aspectRatio:R` — `width`/`height`'e değil), ölçüm gelmeden önceki tek kare için de düz piksel
  tavanına (`notebookMaxWidthPx`) düşen bir `||` yedeği var — yani hiçbir zaman 0 genişlikte
  render olmuyor.
  **İki ayrı izole test ile doğrulandı** (`apps/web/public/` altında geçici dosyalar, sonra silindi):
  (a) `width:auto;height:auto;aspect-ratio` gerçekten 0×0'a çöktüğü ve `max-height` ile ezildiği
  ayrı ayrı gösterildi (5. turun neden yanlış olduğunun kanıtı); (b) `width:100%;maxWidth:<ölçülen>;
aspectRatio` — dış kutu normal (uzun) VE aşırı kısa (60px) iki senaryoda da — hiçbir zaman 0×0'a
  çökmedi, hiçbir eksende taşmadı, oranı her zaman korudu.
  **Ders, altıncı kez tekrarlanmasın diye altı çizili:** `aspect-ratio` sadece TEK yönde (bilinen
  boyuttan bilinmeyene) güvenilir; iki `auto` boyutla veya `max-height` ile "iki yönlü sıkıştırma"
  beklemek yanlış varsayım. Bundan sonra bu dosyada boyutlandırma değişikliği yapılacaksa, gerçek
  değeri kodda değiştirmeden ÖNCE izole bir test sayfasında ölçülmeli.
  İlgili: `notebook-shell.tsx` (`useFitSize`, `fitWithin`).

- **Sayfalama satırı `sticky` ile sabitlendi (2026-08-15, APP-042)** — Kullanıcı masaüstü büyüklüğünü
  onayladı ("desktop görünümü büyük olsun") ve ayrıca "prev-next butonları absolute position ile
  sabitleyelim, scroll durumunda aşağıda kalmasını engelle" istedi. `position:fixed` yerine
  `position:sticky; bottom:0` kullanıldı: `fixed` satırı sütunün flex akışından tamamen çıkarır —
  defter (`flex-grow` tek öğe) boşalan alanı doldurup pill'in altına render olurdu, telafi için ekstra
  boşluk ayarlamak gerekirdi. `sticky` ise normal koşulda (asıl amaç zaten `useFitSize` ile bunu
  sağlamaktı) sıradan bir akış öğesi gibi davranıyor — defterin hemen altında, olduğu gibi — sadece
  sayfa gerçekten bir viewport'tan uzun olursa (örn. ileride eklenebilecek bir içerik) kayarken
  viewport'un altına yapışıp kayboluşu engelliyor. Arkasına `var(--color-bg)` verildi ki sabitlendiği
  anda altından kayan içerik etiketin boşluklarından görünmesin.
  İlgili: `notebook-shell.tsx`.

- **"Yeni yanlış" formu: paylaşılan dropdown, yan yana butonlar, biraz daha geniş panel
  (2026-08-15, APP-042)** — Kullanıcı üç şey istedi: ders/konu native `<select>`'lerini uygulamanın
  geri kalanındaki paylaşılan açılır menüyle değiştirmek, alt butonları ("Deftere ekle"/"Vazgeç")
  yan yana getirmek, ve panelin sıkışık hissini gidermek (genişlet ya da metni küçült).
  (1) **Native `<select>` → `MenuSelect`** (`@/components/menu-select` — `PopoverMenu` üzerine kurulu,
  uygulamanın geri kalanında zaten kullanılan tek paylaşılan dropdown, ör. vision-board'un kariyer
  seçici). `<label>` sarmalayıcı yerine `id`+`aria-labelledby` idiomuna geçildi — `MenuSelect`'in
  tetikleyicisi bir `<button>`, ve `<label>`'ın örtük etiketleme'si sadece native form kontrollerinde
  (input/select/textarea) çalışıyor, keyfi bir buton'da değil. **Bilinen ödün:** `PopoverMenu`
  `position:absolute` kullanıyor, portal yok — vision-board-shell.tsx'te tam bu yüzden "form scroll
  panelinin dışına konuldu" notu var. Buradaki form hâlâ `overflow-y-auto` bir panelin içinde; alan
  panelin altına yakınsa açılan liste kırpılabilir. Kullanıcı şikayet etmedi, dokunulmadı — gerçek bir
  sorun çıkarsa düzeltme aynı: formu scroll alanının dışına taşımak.
  (2) **Butonlar `flex-1` ile yan yana, `flex-wrap` kaldırıldı.** `Button`'ın kendi `px-6`/`text-base`
  sınıflarını `className` ile ezmeye ÇALIŞILMADI — bileşen `cn`/`tailwind-merge` gibi bir birleştirme
  yardımcısı kullanmadan sabit bir string'e ekliyor, bu yüzden çağıranın verdiği sınıfın cascade'i
  kazanacağı garanti değil. `flex-1` (flex-basis:0% + grow:1) flex item'ın ANA eksen boyutlandırmasını
  zaten domine ediyor, `w-fit`'le çakışmıyor — güvenli.
  (3) **Panel genişliği** `lg:w-80`→**`lg:w-96`** (masaüstü). Mobilde zaten `w-full` (dokunulmadı —
  o boyutlandırma zaten kırılgandı, altıncı turda ancak sabitlendi, tekrar oynatılmadı).
  İlgili: `notebook-add-panel.tsx`, `notebook-shell.tsx`.

- **Üç buton küçültüldü, `CompactButton` yerel bileşeni eklendi (2026-08-15, APP-042)** — Kullanıcı
  "Deftere ekle", "Vazgeç" ve "Fotoğraf çek veya seç" butonlarını küçültmek istedi. Bir önceki turda
  not edilen risk gerçekti: paylaşılan `Button`'ı `className` ile küçültmeye çalışmak (bir cascade
  kumarı, `cn`/`tailwind-merge` olmadan) yerine, bu formun kendi üç eylemi için yerel `CompactButton`
  yazıldı — aynı görsel dil (radius token, focus ring, press scale), formda zaten var olan neden-tipi
  pillerle aynı boyut (`min-h-9`, o pilller de hiçbir zaman paylaşılan `Button` olmadığı için bu
  savaşı hiç vermemişti). `fullWidth` prop'u foto butonunun tam genişliğini korudu; alt iki buton
  `flex-1` ile yan yana kaldı.
  İlgili: `notebook-add-panel.tsx`.

- **Tekrar paneli tam ekran modala taşındı, kart görseli object-contain oldu, rail'deki gerçek bug
  düzeltildi (2026-08-15, APP-042)** — Üç ayrı istek:
  (1) **`NotebookReviewPanel` artık `NotebookImageLightbox` ile aynı kabuk** (fixed backdrop,
  Escape, click-away, X kapat) — eskiden sayfanın kendi akışına gömülü bir `<Card>` olarak en üstte
  açılıyordu (görsel küçük, çok boşluk, butonlar alt alta). Chip/konu/not bilgisi artık fotoğrafın
  ÜSTÜNDE sol üstte bindirme olarak duruyor — `NotebookEntryCard`'ın kendi hover kartıyla aynı görsel
  dil (yarı saydam koyu zemin, beyaz metin). İlerleme rozeti ("3/7") sağ üstte. Metin-only (fotoğrafsız)
  kayıtlarda bindirilecek görsel olmadığı için bilgi düz bir blok olarak kalıyor. Butonlar
  `NotebookCompactButton`'a taşındı (aşağıya bak).
  (2) **`NotebookCompactButton` paylaşılan bileşene çıkarıldı** (`components/notebook/
notebook-compact-button.tsx`) — bir önceki turda `notebook-add-panel.tsx`'e yerel yazılmıştı,
  şimdi `notebook-review-panel.tsx` de aynı ihtiyacı duyunca kopyalamak yerine paylaşıldı. Yeni bir
  `ghost` varyant eklendi (üçüncü, düşük öncelikli eylem — "Sonra devam ederim" — için, dolgu/kenarlık
  yok).
  (3) **Defter üzerindeki kart görseli**: `object-cover`→**`object-contain`**. Yerleştirilen kutunun
  en-boy oranı kullanıcının sürüklediği her neyse, neredeyse hiçbir zaman fotoğrafın kendi oranı
  değil — ve bu fotoğraf SORUNUN KENDİSİ, vision-board'daki gibi estetik bir kırpma burada bir
  şıkkı/denklemi kesip kartı incelemeye yaramaz hale getirebilir. Vision-board'un `cover` tercihiyle
  kasıtlı bir ayrım.
  (4) **Rail'deki "ilk tıklama çalışmıyor" gerçek bir bug'dı, tahmin değil.** `openCategory`,
  `setActivePanel`'ın updater'ı İÇİNDEN `setDetailCollapsed`'ı yan etki olarak çağırıyordu — saf
  olmayan bir updater. React'ın Strict Mode'u (dev) updater fonksiyonlarını mükerrer çağırarak tam
  bunu yakalamaya çalışır; bir TOGGLE (`c => !c`) mükerrer çağrıldığında kendini iptal eder
  (true→false→true), sabit bir değer (`false`) ise mükerrer çağrılsa da idempotent kalır.
  `activePanel`'ın varsayılanı zaten `"add"` (rail'in ilk kategorisi) olduğu için "Ekle"ye İLK
  tıklama her zaman toggle koluna giriyordu — ve sessizce hiçbir şey yapmıyordu. Başka bir kategoriye
  (`"sticker"` gibi) tıklamak "switch" koluna (`setDetailCollapsed(false)`, idempotent) giriyordu,
  çalışıyordu — bu da "önce Sticker'a basınca Ekle çalışıyor" bulgusunu birebir açıklıyor. Düzeltme:
  iki `setState` çağrısı birbirinden ayrıldı, hiçbiri artık diğerinin updater'ı içinde değil.
  İlgili: `notebook-review-panel.tsx` (yeniden yazıldı), `notebook-compact-button.tsx` (yeni),
  `notebook-add-panel.tsx`, `notebook-entry-card.tsx`, `notebook-shell.tsx`.

- **Modal gerçek "full preview" oldu, defterdeki görsel artık kendi oranına göre yerleşiyor
  (2026-08-15, APP-042)** — Kullanıcı ekran görüntüsüyle iki net sorun gösterdi: (a) tekrar modalında
  görsel sabit `aspect-[4/3]` bir kutuya zorlanıyordu, çoğu sınav fotoğrafı dikey olduğu için
  görselin sağında solunda kocaman siyah boşluk oluşuyordu, üstelik bilgi kutusu görselin ÜSTÜNE değil
  YANINA (ayrı bir siyah blok olarak) oturuyordu; (b) defter sayfasındaki kartlarda da aynı sebepten
  siyah boşluklar vardı — `nextEntrySlot` her zaman sabit 300px yükseklik kullanıyordu, yüklenen
  fotoğrafın gerçek oranı hiç bilinmiyordu.
  (1) **Kök neden aynıydı: hiçbir yerde fotoğrafın gerçek eni/boyu ölçülmüyordu.**
  `notebook-add-panel.tsx`'e `measureImageAspect(url)` eklendi (`new window.Image()` ile yükleyip
  `naturalWidth/naturalHeight`) — yükleme bitince bir kere ölçülüyor, `photo.aspect` olarak
  saklanıyor. `NotebookAddPanel.onCreated`, `NotebookSidePanel.onCreated` ve `notebook-shell.tsx`'in
  `handleCreated`'ı hepsi `(entry, aspect)` taşıyacak şekilde güncellendi.
  (2) **`nextEntrySlot(items, aspect)`** artık yüksekliği `ENTRY_WIDTH / aspect`'ten türetiyor
  (180–420px'e kelepçeli — çok uzun/kısa bir fotoğraf yine de tek bir kart gibi okunsun diye), aspect
  verilmezse eski sabit `ENTRY_HEIGHT` davranışı aynen kalıyor (geriye dönük uyumlu, mevcut testler
  dokunulmadan geçti). `y` konumlandırması bilerek hâlâ sabit adımla — her kartın gerçek yüksekliğini
  toplamak bu düzeltmenin kapsamının ötesinde bir masonry-layout işiydi, "sonra sürükleyip
  düzeltebilirler" felsefesi zaten var.
  (3) **`NotebookEntryCard`'daki `object-cover` zaten bir önceki turda `object-contain`'e çevrilmişti**
  — artık kutunun kendisi de fotoğrafın oranını taşıdığı için, taze eklenen kartlarda letterbox
  neredeyse hiç kalmıyor (eski, önceden kaydedilmiş kartlar sabit 300px'te kalmaya devam ediyor —
  geriye dönük migrasyon kapsam dışı).
  (4) **Tekrar modalı artık gerçek full-preview.** `NotebookImageLightbox` ile aynı kabuk
  (`h-[85vh]`, sabit oran YOK — `object-contain` fotoğrafın gerçek oranını koruyor). Eskiden fotoğrafın
  ALTINDA ayrı bir beyaz panelde duran soru+3 buton artık fotoğrafın ÜSTÜNDE, alttan yukarı koyulaşan
  bir gradyanın içinde (kartın kendi hover-overlay'iyle aynı görsel dil). Bilgi kutusu (chip/konu/not)
  sol üstte, ilerleme rozeti sağ üstte — ikisi de `rgba(17,17,17,0.6)` ince bir zemin üstünde, okunurluk
  için. `NotebookCompactButton`'a yeni `onDark` prop'u eklendi: `secondary`/`ghost` varyantların
  `--color-main` metni koyu zeminde neredeyse görünmez kalırdı, `onDark` beyaz metin/kenarlığa
  geçiyor (`primary` zaten dolgulu olduğu için hiç etkilenmiyor). Metin-only (fotoğrafsız) girişler
  hâlâ eski sınırlı kart düzeninde — bindirilecek görsel yok.
  İlgili: `notebook-layout.ts`, `notebook-add-panel.tsx`, `notebook-side-panel.tsx`,
  `notebook-shell.tsx`, `notebook-review-panel.tsx`, `notebook-compact-button.tsx`.

- **Modala ince zemin, hover metinleri küçültüldü, eski kartlar da kendi fotoğrafına oturuyor
  (2026-08-15, APP-042)** — Kullanıcı iki ekran görüntüsüyle devam eden sorunları gösterdi:
  (1) **Modal kutusu tamamen şeffaftı.** `object-contain` neredeyse hiçbir zaman kutuyu tam
  doldurmaz (dikey fotoğraf kutuyu enine, yatay fotoğraf boyuna taşırır); kutunun kendi arka planı
  olmayınca üstteki bilgi kutusu ve alttaki butonlar KUTUYA göre konumlanıp fotoğrafın değil, çıplak
  siyah backdrop'un üstünde havada asılı gibi duruyordu. `var(--color-bg)` + `rounded-[var(--radius-
card)]` verildi — artık tek parça bir "fotoğraf kartı" gibi okunuyor.
  (2) **`NotebookEntryCard`'ın hover overlay'i küçültüldü** — sayfanın kendi `DetailLines`
  ölçeğiyle kıyaslanınca oransız büyüktü (küçük bir thumbnail üstünde büyük başlıklar gibi
  duruyordu): chip 3cqw→2.3cqw, başlık 3.4cqw→2.6cqw, not/durum satırları 2.8cqw→2.1cqw, iç boşluk
  ve satır arası da orantılı küçüldü.
  (3) **Defterdeki eski kartların siyah boşlukları — geriye dönük düzeltme.** Önceki turda
  `nextEntrySlot` sadece YENİ eklenen fotoğraflar için kutuyu fotoğrafın oranına göre boyutlandırıyordu;
  bu turdan ÖNCE yerleştirilmiş kartlar sabit 300px yükseklikte kalmaya devam ediyordu. Şimdi
  `NotebookEntryCard`'ın `<Image>`'i kendi `onLoad`'unda gerçek `naturalWidth/naturalHeight`'ı bir
  kez raporluyor (`onNaturalSize` → `NotebookPageStage`'in yeni `onEntryNaturalSize` prop'u →
  `notebook-shell.tsx`'in `handleEntryNaturalSize`'ı); kutunun genişliği sabit kalıp yüksekliği
  fotoğrafın gerçek oranına göre sessizce düzeltiliyor (`Math.abs(fark) < 4` koruması sayesinde
  zaten doğru boyuttaki kartlarda hiçbir şey tetiklenmiyor, sürükleme/yeniden boyutlandırmayla da
  çakışmıyor — `onLoad` aynı `src` için yalnızca bir kez ateşleniyor). **Bilerek alınan risk:**
  erken aşama bir uygulama olduğu ve gerçek kullanıcı verisi henüz olmadığı için, kullanıcının
  BİLEREK yeniden boyutlandırdığı bir kartla "hiç dokunulmamış varsayılan boyuttaki" bir kartı ayırt
  eden bir bayrak yok — ileride gerçek kullanıcılar kartları elle yeniden boyutlandırmaya başlarsa bu
  otomatik düzeltme onların seçimini sessizce geçersiz kılabilir; o noktada "bir kez düzeltildi"
  bayrağı eklenmesi gerekir.
  İlgili: `notebook-review-panel.tsx`, `notebook-entry-card.tsx`, `notebook-page-stage.tsx`,
  `notebook-shell.tsx`.

- **Geriye dönük otomatik-boyutlandırma tamamen geri alındı — kaydetmeyi bozuyordu (2026-08-15,
  APP-042)** — Bir önceki turda eklenen `handleEntryNaturalSize` (eski kartların kutusunu fotoğrafın
  gerçek oranına göre sessizce düzelten özellik) kelepçesizdi; bir düzeltmeyle (8–5000px şema
  sınırına kelepçelemek) denendi ama kullanıcı sorunun **devam ettiğini** bildirdi — "eklenen her
  görsel kapakta sayılıyor (entry satırı oluşuyor) ama defterde gözükmüyor (sayfa PUT'u 400
  dönüyor)". İkinci bir kör yama denemek yerine özelliğin tamamı geri alındı: `notebook-shell.tsx`
  (`handleEntryNaturalSize` + üç `onEntryNaturalSize` bağlantısı), `notebook-page-stage.tsx`
  (`onEntryNaturalSize` prop'u ve `StageItem`'a aktarımı), `notebook-entry-card.tsx` (`onNaturalSize`
  prop'u ve `<Image onLoad>` ölçümü) — hepsi kaldırıldı.
  **Kalan, güvenli düzeltme:** `nextEntrySlot(items, aspect)` hâlâ duruyor — yeni eklenen fotoğraflar
  yerleştirilirken kutuları fotoğrafın oranına göre (180–420px'e kelepçeli) boyutlanmaya devam
  ediyor, çünkü bu asla var olan bir dokümanı geriye dönük yamalamıyor, sadece YENİ bir öğe
  oluştururken bir kerelik kullanılıyor — kaydetmeyi bozma riski taşımıyor.
  Eski, önceden yerleştirilmiş kartlardaki siyah boşluk sorunu **tekrar açık**: otomatik düzeltme
  güvenilir hale getirilemedi, kaldırıldı. Gerekirse ileride "bir kez düzeltildi" bayrağıyla veya
  server-side bir migration ile ele alınmalı — istemci tarafında sessizce çalışan bir kelepçe daha
  eklemek yerine.
  İlgili: `notebook-shell.tsx`, `notebook-page-stage.tsx`, `notebook-entry-card.tsx`.

- **Defterde çizim: kalem katmanı, sekiz araç, kayan tepsi (2026-08-18, APP-042)** — Kullanıcı iki
  referans görsel verdi (benji.org/drawesome'un araç çubuğu) ve isteği netti: "görsel üzerinde veya
  defter üzerinde kullanıcı çizimler yapabilecek". Dört karar birlikte alındı; kapsam **sayfa
  katmanı** (foto anotasyonu değil), motor **`perfect-freehand`**, sekiz araç (kurşun kalem, tükenmez,
  ince uçlu, marker, fosforlu, fırça, dolma kalem, silgi), cilt payını geçen çizgi orada biter.

  **`ink`, `items`'ın kardeşi — item türü DEĞİL.** İlk akla gelen tasarım her strok'u bir
  `NotebookPageItem` yapmaktı; üçü birden yanlış çıkıyordu: sayfanın kırk item slotundan birini
  yakardı, hiç kullanmadığı `VisionBoardItemBase` geometrisini (x/y/w/h/rotation) taşırdı ve sahne
  her item'ı jest katmanına verdiği için **sürüklenebilir** olurdu — kağıttaki mürekkep sürüklenmez.
  Bunun yerine `NotebookPageDoc.ink: NotebookInkStroke[]`, tek bir SVG katmanı olarak render ediliyor.
  **Bedeli, bilerek kabul edildi:** tek katmanın tek derinliği var ve her zaman item'ların üstünde —
  çizdiğin mürekkebin üzerine sticker kaydıramazsın. Gerçek kağıtta da kaydıramazsın.

  **Migration yok, ama `.default([])` tek başına yetmedi.** `doc` zaten jsonb olduğu için yazma
  şemasına alan eklemek yetiyor sanılabilir; **yetmiyor**. `.default([])` sadece _girişte_ çalışır.
  `getPage` depodaki değeri doğrudan `as NotebookPageDoc` ile geçiriyordu, yani çizimden önce
  kaydedilmiş her sayfa istemciye `ink: undefined` dönerdi ve defter mevcut tüm kullanıcılarda
  patlardı. Düzeltme okuma tarafında: `{ ...EMPTY_PAGE, ...stored }`. Bunu **typecheck değil, akıl
  yürütme yakaladı** — tipler mutluydu, çünkü yalan söyleyen zaten `as` idi. İki test bunu kilitliyor
  (`mistake-notebook.service.spec.ts`). Kalıcı not: jsonb'ye alan eklerken okuma tarafını doldur,
  yazma şemasının default'una güvenme.

  **Dolma kalem `perfect-freehand`'in yapamadığı tek şey.** Kütüphanenin `thinning`'i basınç ve hız
  tabanlı; kaligrafi ucunun kalınlığı ise **çizgi ile ucun açısı arasındaki farktan** gelir. Bu tek
  kalem için `nibOutline` yazıldı: polyline'ı sabit açılı bir vektörle ±ötele, git-gel kapat — ~15
  satır ve o iş için `perfect-freehand`'den basit. Çizgi ucun yönüne paralel gittiğinde iki kenar
  üst üste biner ve çizgi kıl gibi incelir; bir dolma kalemi dolma kalem yapan davranış bu.

  **Şema tarafında iki gerçek sınır.** `max(200 strok)` tek başına 200×400 örneğe izin verir, ki bu
  autosave'in taşıyacağından bir kat büyük — asıl muhafız `NOTEBOOK_INK_MAX_TOTAL_POINTS = 12_000`
  (~200KB döküman). Ayrıca `points` düz bir dizi (`[x,y,pressure,…]`) ve **her üçüncü eleman 0..1'e
  kelepçeli**: `coordSchema` x/y için ±5000'e izin veriyor, aynı aralık basınca da uygulansaydı
  uydurma bir 5000 render'dan şehir büyüklüğünde bir poligon isteyebilirdi.

  **Diğer notlar.** İstemci her strok'u kaydetmeden önce RDP ile sadeleştirip yuvarlıyor
  (`finalizeStroke`) — 200 örneklik düz bir çizgi 2 örneğe iniyor; canlı çizgi ise sadeleştirilmemiş,
  yani el tam çözünürlükte takip ediliyor, kaydedilen onun temizlenmiş hâli. `getCoalescedEvents`
  kullanılıyor: kalem ekranın tazelenmesinden hızlı örnekliyor, sadece dispatch edilen olayı okumak
  hızlı çizgileri gözle görülür köşeli yapıyordu. `use-notebook-page.ts`'e **redo eklendi** — dosyanın
  "redo would be a button nobody presses" gerekçesi düzenleme için doğruydu, çizim için değil: dakikada
  onlarca strok atılıyor ve birini kurtarmak için üçünü geri almak sıradan bir istek.
  **E2E'nin yakaladığı gerçek hata:** tepsi `z-20` ile masaüstü koç FAB'ının (`fixed bottom-6
right-6 z-30`) altında kalıyordu; koçun balonu tepsinin sağ ucundaki renk ve gizle butonlarının
  tam üstüne düşüyor ve gerçek bir tıklama hedefi olduğu için onları yutuyordu. Gözle bakınca
  "renk butonu bazen çalışmıyor" gibi görünür — üstelik sadece koçun söyleyecek bir şeyi olduğunda.
  Tepsi `z-[35]`'e alındı: app krom bandı (20–30) ile overlay bandının (40+) arasına bilerek
  yerleştirildi. Vision board aynı çakışmayı FAB'ı tamamen gizleyerek çözüyor
  (`isBoardEditorPath`) ama o koruma rota bazlı, çizim modu ise sayfa içi durum — aynısını yapmak
  koçu defterin tamamından kaldırırdı.
  **E2E'nin yakaladığı ikinci ve daha ciddi hata — paylaşılan jest katmanında.**
  `use-item-gesture.begin()` işaretçiyi `pointerdown` anında `setPointerCapture` ile yakalıyordu.
  Yakalama yapıldığı anda o işaretçinin sonraki tüm olayları yakalayan elemana yönlendirilir, yani
  `pointerup` basılan çocuk yerine **öğe sarmalayıcısına** düşer; tarayıcı da `click`'i iki hedefin
  en yakın ortak atasında ateşler. Sonuç: bir sahne öğesinin **hiçbir çocuğundaki `onClick`
  fare veya parmakla asla çalışamaz**. Fotoğraf kartlarının "Fotoğrafı büyüt" butonu bu yüzden
  sadece klavyeyle açılabiliyordu — ne birinci ne ikinci tıklama işe yarıyordu, `dispatchEvent`
  ise çalışıyordu (olay yolu izlenerek kanıtlandı: `pointerdown=IMG`, `pointerup=DIV`, `click=DIV`).
  Yakalama artık **ilk gerçek harekete** ertelendi (`move` içinde, checkpoint ile aynı yerde) ve
  `end` yalnızca gerçekten alınmışsa bırakıyor. Bedeli yok: yakalama, hızlı bir sürükleme elemandan
  çıktığında izlemeyi sürdürmek için var, işaretçi hareket etmeden kaybedilecek bir sürükleme yok.
  Vision board da aynı katmanı kullanıyor; onun 11 e2e senaryosu değişiklikten sonra da geçiyor.
  Araç çubuğu **koyu** ve uygulamada `--color-surface` almayan tek yer: kalemler tepside duran fiziksel
  nesneler olarak çizildi, beyaz mürekkepli kalem beyaz tepside görünmez olurdu. Kalem gövdeleri
  `INK_PALETTE` gibi literal hex — bunlar temanın sahip olduğu yüzeyler değil, kullanıcının seçtiği
  içerik; karanlık modda dönen bir palet, birinin çizdiği mürekkebi yeniden boyardı.
  İlgili: `notebook-ink.ts` (+spec), `notebook-ink-layer.tsx`, `use-ink-draw.ts`,
  `notebook-ink-pens.tsx`, `notebook-ink-toolbar.tsx`, `use-notebook-page.ts`, `notebook-shell.tsx`,
  `notebook-side-panel.tsx`, `packages/types/src/coaching.ts`, `packages/validation/src/coaching.ts`,
  `mistake-notebook.service.ts`.

- **Tekrar destesi flashcard'ı: UI/UX elden geçirme (2026-08-22, APP-046)** — Kullanıcının yedi
  maddelik listesi üzerinden. **(1) Bulanık arkaplan:** defterin dört modali (`review-panel`,
  `image-lightbox`, `entry-edit-dialog`, `remove-choice-dialog`) tek başına `rgba(0,0,0,0.85)`
  kullanıyordu; uygulamanın geri kalanı (`achievement-celebration`, coach drawer, history drawer)
  `bg-black/70 backdrop-blur-md`. Dördü de o değere çekildi — defter içinde iki farklı modal
  görünümü bırakmamak için hepsi, sadece tekrar paneli değil. **(2) Jest ipucu metni kaldırıldı**
  (`review_deck_hint` / `review_flip_hint` çevirileri de silindi): kaydırmayı kelimeyle anlatıyordu,
  artık kaydırmanın kendisi renkle anlatıyor. **(3) Verdict butonlarına ikon eklendi** (`RotateCcw` /
  `Check`) — _ikon-only'ye geçilmedi_: ✓/✗ tek başına "doğru cevap bu mu?" diye okunabilir, bu bir
  değerlendirme seçimi. **(4) Prev/next okları geri geldi.** APP-044'te "cevapsız gezinme kendi
  içinde amaçsız navigasyon" diye kaldırılmışlardı; pratikte kartı **dürüstçe erteleme** yolu
  kalmamıştı (liste görünümü yalnızca deste büyükse açılıyor). Tek `step(delta)` iki oku da sürüyor,
  cevaplanmışları atlıyor ve iki uçta sarıyor. **←/→ artık cevaplamıyor, geziniyor** — tuşlar yanındaki
  kontrolün anlamını taşımak zorunda; klavyeyle cevaplama butonların kendisinden sürüyor. Oklar
  kasten sessiz (yarı saydam beyaz daire), yoksa tüm desteyi hiç not vermeden yürümeye davet olurdu.
  **(5) `1/10` sayacı** karta `absolute left-2 top-2` ile taşındı — üstte ayrı bir satır, yüksekliği
  zaten viewport ile sınırlı bir kartta bedava değil; sayaç saydığı şeye ait. Dönen elemanın dışında,
  yani kartla birlikte çevrilmiyor. Liste açıkken "N kart kaldı" çipi eski yerinde kalıyor (kart yok).
  **(6) Kart arkası artık `Ders · Konu`** — `topicName ?? subjectName` idi, yani etiketli kart
  "Permütasyon" deyip hangi derse ait olduğunu hiç söylemiyordu. **(7) Kaydırma geri bildirimi
  kelimeden renge:** `SwipeCue` kartı verdict rengiyle yıkıyor (%22 tint) ve ortasına butonun kendi
  ikonunu koyuyor; metin iki parmak aşağıdaki butonlarda zaten var ve flick sırasında etiket okumak
  kartın yeşile döndüğünü görmekten yavaş.
  **Takip (aynı gün): butonlar tamamen ikon oldu.** Metin `group-hover` / `group-focus-within` ile
  açılan tooltip'e taşındı; erişilebilir ad `aria-label`'da, tooltip `aria-hidden` — ikisi asla
  çelişmiyor. Dört kontrol (iki verdict + iki ok) tek `DeckButton`'a indi: aynı halka, aynı disabled
  davranışı, aynı tooltip; üç ayrı buton gövdesi bir sonraki düzenlemede hizadan çıkardı. Ayrımı
  **renk değil ağırlık** yapıyor — `solved` 60px dolu disk (yeşil + yumuşak glow), `missed` aynı
  boyda outline (asla kırmızı değil), oklar 44px ve sessiz. `hover:scale-105` / `active:scale-95`,
  `motion-reduce` altında ikisi de kapalı. Busy durumunda `Check` yerine `LoaderCircle` dönüyor.
  Tooltip kayan bir konumlandırma motoru değil, kardeş `span`: tek yerleşim (üstte), flip yok, sabit
  bir dialog'un içinde üstünde yer var.
  **İkinci takip: ikon çakışması + üst kontrollerde tooltip.** Kullanıcı kartın sağ üstündeki çevirme
  ikonuyla "yine çözemedim" ikonunun neredeyse aynı göründüğünü bildirdi — ikisi de `RotateCw`/`RotateCcw`
  ailesindendi, yani aynı glif aynanmış haliyle iki _farklı_ eylemi temsil ediyordu. Çevirme
  `FlipHorizontal2` oldu (metafor zaten döndürme değil, çevirme), kart arkasındaki tekrar sayacı da
  `Repeat` aldı; böylece `RotateCw` karttan tamamen kalktı ve "geri dön" ailesi yalnızca verdict'e ait.
  `OverlayControl` (liste / ayarlar / kapat) ve `CardControl` (büyüt / çevir) `DeckButton` ile aynı
  tooltip sözleşmesini aldı — fark: bunlar **alta ve sağa yaslı** açılıyor. Üste açılsa kart
  `overflow-hidden` olduğu için kırpılırdı, ortalansa da etiket 44px butondan geniş olduğu için
  sağdaki buton ekran/kart dışına taşardı. Tüm ikonlar `strokeWidth 2.25` ve bir punto büyüdü.
  İlgili: `notebook-review-panel.tsx`, `notebook-review-card.tsx`, `notebook-image-lightbox.tsx`,
  `notebook-entry-edit-dialog.tsx`, `notebook-remove-choice-dialog.tsx`, `messages/{tr,en}.json`.

- **Liste görünümü desteye tepeden bakışa dönüştü (2026-08-22, APP-046)** — Kullanıcı bir referans
  görselle geldi: liste satırları değil, üst üste binmiş kart dilimleri. Eski görünüm (küçük görsel +
  başlık + hata tipi satırları, ders başlıkları altında gruplu) gayet iyi bir *liste*ydi ama yanlış
  nesneydi: öğrenci elinde bir deste tutuyor ve destede kart, kenarları okunarak bulunur — dizinine
  bakarak değil. **`STACK_OVERLAP_PX = 20`**: 64px dilim, 44px görünür bant (hâlâ geçerli dokunma
  hedefi, tek satır başlık sığıyor). `zIndex` sırayla artıyor, yoksa tarayıcının boyama sırası tersini
  yapıyor ve her dilim üstündekinin _arkasına_ giriyor — bu da yığın değil sekme görüntüsü veriyor.
  **Gölge yukarı bakıyor** (`0 -8px 18px -10px`): bir dilimin kanıtlaması gereken şey üstündeki kartın
  onun üzerinde durduğu; aşağı bakan gölge örtüldüğü yere düşer, kimse görmez. Aktif kart sadece
  renklendirilmiyor, `scale-[1.03]` + çift yönlü gölge ile **yığından kaldırılıyor** — dokuz benzer
  dilimde "neredeyim" tek bakışta hayatta kalmak zorunda. Başlık kart arkasıyla aynı `Ders · Konu`.
  Üstteki `maskImage` yığının kenardan devam ettiğini söylüyor; APP-042'de düz listeden kaldırılmıştı
  çünkü maskenin altında kalan şey bir başlıktı, şimdi bir kart. **Ders grupları başlıktan çip
  satırına taşındı** — dilimler arası başlık desteyi üç ayrı yığına böler, illüzyon ancak yığın
  kesintisizken duruyor. `review_list_only_this` çevirisi (grup başlığındaki "sadece bunu çalış")
  artık çipin kendisi olduğu için silindi. Cevaplanmış kartlar yığında kalıyor: %45 opaklık, tik,
  tıklanamaz — aynı kartı iki kez cevaplamak aralık merdivenini sıfırlardı.
  **Takip: yatay kayma + gerçek perspektif.** Kullanıcı ekran görüntüsünde destenin ayağında bir
  **yatay kaydırma çubuğu** gösterdi. Sebep CSS'in az bilinen kuralı: `overflow-y:auto` tek başına x
  eksenini `visible` bırakır, tarayıcı da onu `auto`'ya _hesaplar_ — aktif kartın `scale-[1.03]`
  taşması da bunu tetikliyordu. `overflow-x-clip` eklendi ve `scale` atıldı. Yerine **`translateZ(34px)`**:
  kart iki boyutta büyütülmüyor, destenin eğildiği eksende okuyucuya doğru **kaldırılıyor**; bedava,
  çünkü onu büyük gösteren perspektif zaten yığının içinde. Transform `li`'de, butonda değil — yoksa
  butonun kendi hover kalkışını eziyordu. **Perspektif gerçek 3D oldu:** kaydırma kabında
  `perspective:1100px` + `perspective-origin:50% 0%`, içindeki `ol`'da `rotateX(10deg)` /
  `transform-origin:50% 0%` ve `preserve-3d`. Dönüşüm kaydırılan elemanın kendisine konamaz — ikisi
  aynı kutuyu paylaşamaz. **10° tüm bütçe:** ~14°'den sonra başlıklar okunmaz biçimde eziliyor; bu
  bir diorama değil, okunacak bir liste. Doğrulama için gerçek CSS'in birebir kopyası olan 9 kartlık
  statik bir mockup üretildi (repoya girmedi).
  **Takip: kaybolan filtre + kaldırılan sayaç.** Kullanıcı çiplerin hiç görünmediğini bildirdi.
  Koşul `subjects.length > 1` idi; destesinde iki Türkçe + bir _etiketsiz_ kart vardı, yani ders
  sayısı 1 ve çipler hiç çizilmedi — oysa "Türkçe" filtresi orada anlamlı, etiketsiz kartı eliyor.
  Koşul **grup** sayısına çevrildi: `subjects.length + (etiketsiz var mı ? 1 : 0) > 1`. Etiketsizler
  hâlâ kendi çipini almıyor (filtre o değeri ifade edemiyor), ama artık _sayılıyor_. Listenin
  üstündeki **"N kart kaldı" çipi kaldırıldı** (`review_list_remaining` çevirisi de silindi): deste
  artık sayının kendisi — dokuz dilim, ikisi tikli — yani satır, resmin zaten gösterdiğini okuyan bir
  altyazıydı ve tam olarak filtre çiplerinin durması gereken yerde duruyordu.
  **Takip: ders filtresi tamamen kaldırıldı.** Kullanıcı "filtrelemeye gerek var mı?" diye sordu;
  cevap hayır. Filtre 24 kod referansı, 5 çeviri anahtarı ve **tam bir ekran** (`SubjectDonePanel` —
  "Türkçe bitti, başka derslerde 4 kart var") tutuyordu; o ekran tamamen filtrenin kendi yarattığı
  sorunu temizlemek için vardı, filtre olmasa hiç doğmazdı. Karşılığında verdiği şey — "her turda
  Matematik'ten Tarih'e zıplamayayım" — filtresiz de elde edilebilir: **`bySubject()`** desteyi panel
  açılırken bir kez derse göre sıralıyor. Grup içinde sıra bozulmuyor, gruplar arasında ilk-görülme
  sırası korunuyor (alfabetik sıralamak, fonksiyonun kimsenin istemediği bir öncelik icat etmesi
  olurdu); etiketsizler ilk etiketsiz kartın konumunda kendi grubunu tutuyor. İki birim testi eklendi.
  Ayrıca bu, filtrenin _asıl_ riskini de siliyor: öğrenciyi hâlâ tekrarı gelmiş kartlar dururken
  "bugünlük bitti" ekranına düşürebilme ihtimali. Silinenler: `subjectFilter` state'i, `applyFilter`,
  `fullDeck`/`remainingAll` ikiliği, çip satırı, `FilterChip`, `SubjectDonePanel`, `review_progress`
  önündeki ders adı ön eki ve `review_list_all_subjects` + `review_subject_done_*` çevirileri.
  **Takip: hover artık Z ekseninde.** Dilimler `hover:-translate-y-1` ile sayfa düzleminde yukarı
  kayıyordu; deste eğik olduğu için bu "kart yükseliyor" değil "satır kayıyor" gibi duruyordu. Artık
  bu yığındaki _her_ kalkış Z'de: hover `translate-z-[24px]`, aktif kart zaten 34px'te ve hover'da
  50px'e **daha da yükseliyor** (hover değerine düşmüyor). Üç durum tek class dizisinde, çünkü
  inline `transform` hover'ı ezerdi. Butonun kendi kalkışı kaldırıldı — yükselen kartın içinde ayrıca
  kayan bir buton, tek kart değil iki hareket eden şey gibi okunuyor. Klavye için `focus-within`
  hover ile aynı değerleri alıyor. **Tuzak:** Tailwind v4'te `translate-z-*` `transform` değil,
  standalone **`translate`** özelliğini yazıyor — `transition-transform` hiç değişmeyen bir özelliği
  izler ve kart yol almadan zıplardı; `transition-[translate]` oldu. Doğrulama: sınıfların gerçekten
  üretildiği `@tailwindcss/cli` ile tek dosya taranarak çıktı CSS'inden kontrol edildi.
  **Takip: deste kendini dağıtıyor.** Liste görünümüne geçiş sert bir kesmeydi — bir an önce tek kart
  varken aniden dokuz dilim. Artık kartlar sırayla, `staggerChildren: 0.045` ile aşağıdan ve arkadan
  (`y: 24, z: -90`) yığının _içine_ kayarak giriyor; üstüne fade ile binmiyor, aynı Z ekseninden
  geliyor. **45ms destenin kendi uzunluğundan seçildi:** dokuz kart 400ms'lik gecikmeyle iniyor, yani
  bir dizinin tek hareket olmaktan çıkıp beklenen bir kuyruğa dönüştüğü ~500ms sınırının altında.
  Elli kartlık deste bir üst sınır isterdi; elli kartlık tekrar günü ayrı bir problem. `reduceMotion`
  altında **sıralama korunuyor** (bilgi taşıyor: bu bir deste ve sırayla dağıtılıyor), yol kaldırılıyor.
  Framer `transform` yazıyor, hover `translate` yazıyor — CSS ikisini birleştirdiği için aynı eleman
  üzerinde çakışmadan yaşıyorlar.
  **Takip: dağınık deste + iki farklı yüz rengi (referans görsel).** Arkadaki deste tek, hizalı bir
  kopyaydı — bir kartın tam arkasındaki kart, ikinci bir kart gibi değil **gölge** gibi okunuyor.
  Artık `STACK_LAYERS` ile iki katman, hafif eğik: `-2.5°/0.965` ve `3.5°/0.93`, azalan opaklıkla.
  Değerler sabit, rastgele değil — her render'da kendini yeniden dizen bir deste "kendiliğinden
  oynadı" diye hata kaydı olur. Katmanlar `remaining`'e bakıyor, bir kart kalmışken iki kart daha
  varmış gibi yapmıyor. **Ön yüz artık `accent-soft`, arka yüz `surface`:** iki yüzü aynı renk olan
  bir flashcard'da dönüş inecek bir yer bulamıyor — kart 90°'de kenara geliyor ve hangi yüzün geldiğini
  anlamanın tek yolu okumak oluyor. Rengi _ön_ yüz taşıyor, çünkü bakman istenen yüz o. Arkadaki
  deste katmanları da aynı tinti alıyor: onlar sıradaki kartların ön yüzü. **Yakalanan regresyon:**
  `secondary-text` (#666) artık `accent-soft` (#C3D9FD) üstüne düşüyordu — 3.9:1, DESIGN.md'nin okunur
  metin için istediği 4.5'in altında; `color-mix(main 72%)` ile değiştirildi, iki temada da rahat geçiyor.
  **Takip: tint fotoğraflı karttan kaldırıldı.** Kullanıcı ekran görüntüsüyle sordu. Tintin işi
  "hangi yüz yukarıda" sorusunu metinden önce cevaplamak; fotoğraflı kartta bu soru zaten içerikle
  cevaplı (bir yüzde fotoğraf, diğerinde yazı), dolayısıyla orada renk bilgi taşımıyor — sadece
  fotoğrafın dövüşmek zorunda kaldığı renkli bir çerçeve ve fotoğrafın kendi beyazıyla sert bir bant
  üretiyordu. **Metin-only ön yüzde kalıyor:** orada iki yüz de yazı ve onları ayıran _tek_ şey renk.
  Arkadaki deste katmanları da `surface`'a döndü (renksiz kartın arkasında renkli bir yığın tutarsızlık
  olurdu) ve opaklıkları 0.45 / 0.7'ye çıkarıldı — onları kart yapan şey dolgu değil, eğim.
  İlgili: `notebook-review-list.tsx`, `notebook-review-panel.tsx`, `notebook-review-card.tsx`,
  `notebook-review-deck.ts` (+spec), `messages/{tr,en}.json`.

- **Tekrar oturumu artık ne olduğunu söylüyor (2026-08-22, APP-046)** — Kullanıcı "çözebildim
  denince kart desteden çıkıyor ve bir daha göremiyoruz, doğru mu?" diye sordu. Koda bakınca premis
  yanlış çıktı ve **asıl kusur başka yerdeydi**: kart silinmiyor, `advanceReview` merdiveni (2/7/21)
  ilerliyor, kayıt defterde kalıyor, üç üst üste doğrudan sonra `HEALED` olup rozet alıyor. Yani
  davranış zaten istenendi — eksik olan **geri bildirimdi**. Cevap anında sunucuya gidiyordu ama
  ekranda hiçbir iz bırakmıyordu; "kart kayboldu" hissi veri kaybından değil bu sessizlikten geliyordu.
  Dört parça eklendi. **(1) Cevaptan sonra tek satır:** `reviewFeedback()` sunucunun döndürdüğü
  `nextReviewAt`/`status`'tan "{n} gün sonra tekrar" ya da "Bu kart iyileşti" üretiyor — merdivenin
  ikinci bir kopyası burada tutulmuyor, yoksa politika değişince kayardı. Sabit yükseklikli slot
  (yoksa her cevapta buton satırı zıplıyor), `aria-live="polite"`, 2200ms. **(2) Kapanış özeti**
  `outcomes: {entry, solved}[]`den türüyor; kaçırılan kartlar **sayılmıyor, adlandırılıyor** —
  "3 kart" öğrencinin kendi yapabileceği aritmetik, "Matematik · Permütasyon, işlem hatası" ise bu
  ekranda bilemeyeceği tek şey. **(3) Kaçırılan satırın kendisi topluluk köprüsü**
  (`/community/feed?notebookEntry=<id>`); zaten thread'i olan kart link olmuyor — o öğrenciyi değil
  cevabı bekliyor. **(4) X/Escape ile yarıda çıkış** artık özet gösteriyor, ama yalnızca en az bir
  kart cevaplanmışsa: açıp hemen vazgeçenin önüne ekran koymak, kapatma butonunun kapatma butonu
  olmaktan çıkması demek. "Atlanan" istatistiği ancak burada gerçek — deste kendiliğinden bittiğinde
  atlanmış kart matematiksel olarak sıfır, çünkü `nextUnansweredIndex` atlananı başa sarıyor.
  **Yüzde/halka bilerek eklenmedi.** Üç sebep: payda öğrencinin kendi yanlışları (düşük sayı
  başarısızlık değil, defterin dolu olması); özet ekranına ancak her kart cevaplanınca gelindiği için
  "tamamlama yüzdesi" hep %100, değişen tek şey not; ve en önemlisi **dış hakem yok** — kararı
  öğrenci veriyor, yeşile basınca yükselen görünür bir sayı yeşile basmayı öğretir, o yalan da
  merdiveni tırmanıp kartı rotasyondan çıkarır. Yani yüzde, tam da korkulan "kayıp kart"ı kendi
  elimizle üretirdi. Silinen: `review_done_remaining` (per-cevap satırı aynı şeyi daha iyi söylüyor).
  İlgili: `notebook-review-deck.ts` (+spec, `reviewFeedback` 5 test), `notebook-review-panel.tsx`,
  `messages/{tr,en}.json`.

- **Özet ekranı zenginleşti + topluluğa devir artık bir şey taşıyor (2026-08-22, APP-046)** —
  Kullanıcı iki ekran görüntüsüyle geldi: özet satırı çıplaktı ("Etiketsiz · dikkat hatası") ve
  "Topluluğa sor"a basınca composer **bomboş** açılıyordu. İkincinin sebebi: devir yalnızca
  `?notebookEntry=<id>` taşıyor, composer o id ile sadece thread oluştuktan _sonra_
  `linkNotebookThread` çağırıyor — açılışta doldurulacak veri yok, üstelik modal defterden gelindiğini
  bile söylemiyor. Kartı çekemiyor da: **tek kayıt döndüren endpoint yok**, sadece sayfalı liste.
  Çözüm `lib/notebook-handoff.ts`: defter, elindeki kaydın etiketlerini çıkarken `sessionStorage`'a
  bırakıyor, composer varışta okuyor. Yeni endpoint yok, URL'e içerik girmiyor (öğrencinin notu
  taşınmıyor — o onun), mevcut bağlama akışı aynen duruyor. Composer'da **banner** (hangi kart + hata
  tipi + "yayınlanınca bu kartla ilişkilendirilecek") ve **başlık tohumu**; gövde bilerek boş —
  hazır şablon, olduğu gibi yayınlanan içi boş sorular üretir. **Lint iki kez yön verdi:**
  `react-hooks/set-state-in-effect` hem devri okuyan hem başlığı tohumlayan effect'i reddetti.
  Okuma **yıkıcı olmaktan çıkarıldı** (`readNotebookHandoff` + ayrı `clearNotebookHandoff`, spendHandoff
  içinde) — böylece render sırasında saf bir arama olarak çağrılabiliyor; silen bir okuma yan etkidir
  ve React'in iki kez çalıştırmakta özgür olduğu bir yan etki ikinci turda boş döner, banner'ı
  söndürürdü. Başlık ise effect yerine **initial state**, dialog `key={handoff.entryId}` ile
  yeniden bağlanıyor: client-side navigasyonla `?notebookEntry=` sonradan gelirse lazy init tek başına
  kaçırırdı. Özet tarafında dördü de yapıldı: satırda **küçük fotoğraf** (etiketsiz kartın kimliğini
  fotoğraf veriyor; aynı metni taşıyan liste hiçbir şey taşımaz), satır başına **"2 gün sonra
  dönecek"** (`reviewFeedback` yeniden kullanıldı), `HEALED` için **kendi success bandı**, ve
  `solved === 0` iken sayı cümlesi yerine sonuç cümlesi — "1 karttan 0 tanesini çözdün", kaçırdığı
  kart hakkında az önce doğruyu söylemiş birine okunan bir skordu. **Ertelendi:** fotoğrafın otomatik
  iliştirilmesi — `uploadAll()` `File` istiyor, URL'den `File` üretmek bucket CORS'una bağlı ve
  ölçmeden söz verilmedi.
  İlgili: `lib/notebook-handoff.ts` (yeni), `notebook-review-panel.tsx`, `global-composer.tsx`,
  `question-composer-dialog.tsx`, `messages/{tr,en}.json`.

- **Defter fotoğrafı topluluğa: sunucu tarafı kopya (2026-08-22, APP-046)** — Önceki turda ertelenmişti,
  gerekçe "URL'den `File` üretmek bucket CORS'una bağlı". Bakınca **CORS'a hiç girmemek** mümkün çıktı:
  `NotebookEntryDto` zaten `storageKey` taşıyor ve defter fotoğrafı ile forum eki **aynı R2 bucket'ında**
  (`storage.getPublicUrl` ikisinde de). Baytlar sunucunun elinin altındayken tarayıcıya 5 MB indirtip
  geri yükletmek boşuna bir gidiş-dönüş. `StoragePort.copyObject` eklendi (R2 `CopyObjectCommand`, fake
  adaptörde bellek kopyası) ve `POST /v1/forum/attachments/copy` açıldı. **Uç nokta forum modülünde:**
  ek anahtar alanı, MIME/boyut limitleri ve pending defteri onun; coaching'e koysaydım defter forum'un
  anahtar şemasını öğrenmek zorunda kalırdı. Sahiplik `isOwnUploadKey` ile **genel** kuralla doğrulanıyor
  — `{feature}/{userId}/{uuid}.{ext}` her ön ekte aynı, yani forum "defter" diye bir şey bilmiyor. MIME
  istemcinin beyanından değil **anahtarın uzantısından** türetiliyor; aksi halde `.pdf` bir anahtar
  `image/png` diye eklenebilirdi. Kopyalanan anahtar da `markPending`'e yazılıyor: yoksa fotoğrafı
  ekleyip soruyu yayınlamadan çıkan öğrenci **kalıcı olarak sızan** bir nesne bırakırdı, çünkü
  `cleanupOrphanAttachments` yalnızca deftere yazılanları süpürüyor. Referans değil kopya, çünkü tek
  nesneyi iki kayıt paylaşırsa kart silindiğinde thread'in görseli aylar sonra sessizce kırılır.
  İki limit de 5 MB olduğu için `headObject` gerekmedi. **Bir güvenlik hatası yakalandı ve teste
  bağlandı:** desen template literal içinde kurulduğu için `\.` tek ters bölüye düşmüştü ve regex'te
  `.` _herhangi bir karakter_ demek — `…f8Xpng` png diye geçerdi. Düzeltildi; düzeltmeyi geri alınca
  kırmızıya dönen bir regresyon testi eklendi. **İstemci:** `useForumImagePicker` yeni bir öğe türü
  aldı (`kind: "ready"` — yüklenmesi gereken bir `File`'ı olmayan, zaten depoda duran ek); `uploadAll`
  onu geçiriyor, `AttachmentPreviewStrip` dosya dalına düşüp `p.file`'da çakılmasın diye
  `p.kind !== "file"` ile ayırıyor. Ölçüler `naturalWidth` ile okunuyor — **gösterilen** bir görselin
  boyutunu okumak CORS izni istemiyor, baytlarını okumak istiyor — böylece thread'de CLS olmuyor.
  Fotoğraf **otomatik eklenmiyor, butonla**: defter fotoğrafı çoğu zaman telifli bir kitap sayfası
  (`stuck_copyright` uyarısı tam bunun için var) ve onu herkese açık bir gönderiye varsayılan olarak
  koymak bu dialogun öğrenci adına verebileceği bir karar değil. Yalnızca **soru** fotoğrafı —
  çözüm fotoğrafını soruyla birlikte yayınlamak yardım istemek değil, kendi kendine cevap vermek olur.
  İlgili (bir sonraki maddede devam): `storage.port.ts`, `r2-storage.adapter.ts`, `fake-storage.adapter.ts`,
  `attachment.constants.ts`, `forum-thread.service.ts` (+spec, 4 test), `forum-thread.controller.ts`,
  `forum.dto.ts`, `packages/validation/src/forum.ts`, `use-forum-image-picker.ts`,
  `attachment-preview-strip.tsx`, `forum-attachments.ts`, `notebook-handoff.ts`,
  `question-composer-dialog.tsx`, `notebook-review-panel.tsx`, `messages/{tr,en}.json`.

- **Karta tekrar destesinden çıkma/geri girme köprüsü (2026-08-22, APP-046)** — Kullanıcı "eklenen
  görseller ile tekrar zamanı arasında köprü kuralım; istediğinde ekleyebilsin, istediğinde
  çıkarabilsin" dedi. İki taraf da hazırdı: sayfadaki her fotoğraf zaten `kind: "entry"` öğesi, yani
  bir kayıt; yazma şeması da `status: "ACTIVE" | "ARCHIVED"` kabul ediyordu. **Ama arada kırık bir
  söz vardı:** `updateEntry` statüyü düz geçiriyor, `nextReviewAt`'e dokunmuyordu; deste sorgusu ise
  yalnızca `nextReviewAt <= now`'a bakıyor, statüye hiç bakmıyor. Sonuç: arşivlenen kart **destede
  kalmaya devam ederdi**, iyileşmiş kartı aktifleştirmek ise `nextReviewAt` null kaldığı için
  **sessizce hiçbir şey yapmazdı**. DTO'nun kendi yorumu ("`ARCHIVED` olunca null") kodun tutmadığı
  bir vaatti. Hiçbir arayüz bu alanı kullanmadığı için kimse fark etmemişti. Köprü yeni alanla değil,
  bu sözü tutturarak kuruldu: `ARCHIVED` → `nextReviewAt: null`; `ACTIVE` → `firstReviewAt()` +
  `reviewCount: 0`. Yeni bir sayı uydurulmadı, kaydın rotasyona ilk girişi zaten `firstReviewAt()`.
  **`reviewCount` sıfırlanıyor**, çünkü merdivenin tüm varsayımı aralıkların kesintisiz olması;
  iyileşmiş kartı geri alan öğrenci ona güvenmediğini söylüyor, sayaç 3'te kalsaydı ilk doğru cevapta
  anında yeniden iyileşirdi. Değişiklik yalnızca statü **gerçekten değişiyorsa** uygulanıyor — her
  kaydetmede tüm formu gönderen bir editör, sırf etiket düzeltirken kartın merdivendeki yerini
  sıfırlamamalı; bunun kendi testi var. UI kart ayarları diyaloğunda, kaydetme ile silme arasında:
  değiştirmeyen bir düzenleme ile bitiren bir düzenlemenin arasına ait. `save()`'den ayrı bir çağrı,
  yoksa alakasız bir etiket düzenlemesi kartı sessizce yeniden zamanlardı. İyileşmiş kartta buton
  "Yeniden çalış" diyor — orada eylem geri almak değil, merdivenin dibinden başlatmak. Arşivlenmiş
  kart yalnızca **indeks panelinde** rozet alıyor (`CalendarOff`) ve artık statü filtresinde
  seçilebiliyor; defter sayfası bir pano değil, kartın zamanlanıp zamanlanmadığı kâğıdın meselesi
  değil. `listNotebookEntriesQuerySchema`'daki "ARCHIVED sunulmuyor, ürün henüz yazmıyor" notu da
  düştü — artık yazıyor.
  İlgili: `mistake-notebook.service.ts` (+spec, 4 test), `mistake-notebook.repository.ts`,
  `packages/validation/src/coaching.ts`, `notebook-entry-edit-dialog.tsx`, `notebook-index-panel.tsx`,
  `messages/{tr,en}.json`.

- **Erken çalışma + ekleme anında zamanlama bilgisi (2026-08-23, APP-046)** — Kullanıcı gerçek bir
  kusur bildirdi: "deftere yeni soru ekledim, tekrar destesinde gözükmedi." Doğru: `createEntry`
  kaydı `firstReviewAt()` ile **2 gün sonrasına** zamanlıyor ve bunu kimseye söylemiyor. Aralık
  doğru (soruyu ekledikten 10 saniye sonra kendine sormak hiçbir şey ölçmez, cevabı az önce baktığın
  için biliyorsun) ama sessizlik özelliği bozuk gösteriyordu. Hatırlatma tarafı zaten otomatikti
  (`notebook-review-reminder.service.ts`); eksik olan manuel kapıydı.
  **(A) `advanceReview` artık kartın vadesini görüyor** ve nesne parametreye geçti
  (`{reviewCount, solved, dueAt, status, now}`). Vadesi gelmemiş kart çalışıldığında: **çözdüm →
  hiçbir şey değişmez** (aralığın ölçtüğü şey cevabın boşluğu atlatıp atlatmadığı, boşluk yoksa
  ölçülecek bir şey de yok — aksi halde bir kartı bir öğleden sonrada 21 güne tırmandırıp
  "öğrenildi" demek mümkün olurdu); **çözemedim + kart destede → 2 güne çekilir** (bilmediğini
  keşfetmek ne zaman olursa olsun gerçek bilgi); **çözemedim + kart arşivde/iyileşmiş → hiçbir şey**
  (öğrencinin bilerek desteden çıkardığı kart, geçerken verilen bir cevapla dirilmemeli). Kritik
  tasarım kararı: **istemci bunu söylemiyor.** Sunucu `now < nextReviewAt` ile kendisi anlıyor,
  yani hiçbir istemci hak etmediği terfiyi talep edemiyor — yeni alan, yeni bayrak, yeni uç nokta yok.
  `ReviewOutcome.status` `ARCHIVED`'ı da kabul edecek şekilde genişledi, çünkü erken cevap kartı
  bulduğu gibi bırakıyor. **(B) Ekleme sonrası toast:** "Deftere eklendi · {n} gün sonra tekrar
  destende karşına çıkacak" + **"Şimdi çalış"** eylemi (kartı tek kartlık tekrarda açıyor). Gün sayısı
  `reviewFeedback` ile sunucunun döndürdüğü tarihten — merdivenin istemci tarafında ikinci bir kopyası
  yok. Bunun için `@mentor/ui` toast'una toplamalı `action?: {label, onClick}` eklendi: **tek** eylem,
  çünkü iki düğmeli bir toast, engellemeyi unutmuş bir dialogdur; basınca toast kapanıyor.
  **Ertelendi (C):** manuel çalışmanın diğer giriş noktaları — indeks panelinde çoklu seçim +
  "seçilenleri çalış", kart ayarlarında "şimdi çalış", sayfadaki seçili öğe için "çalış" düğmesi.
  Sayfadaki fotoğrafa **çift tıklamak** zaten tek kartlık tekrarı açıyor ama keşfedilebilir değil.
  İlgili: `notebook-review.policy.ts` (+spec, 4 yeni test), `mistake-notebook.service.ts` (+spec),
  `packages/ui/src/components/toast/{types.ts,toast-provider.tsx,toast-item.tsx}`,
  `notebook-shell.tsx`, `messages/{tr,en}.json`.

- **Manuel çalışma: seçerek deste kurma ve sayfadan tek dokunuş (2026-08-23, APP-046)** — C parçası.
  Uygularken **iki maddesi gereksiz çıktı ve yapılmadı:** (1) kart ayarlarındaki "şimdi çalış" —
  `NotebookEntryEditDialog`'a tek giriş `singleReview` panelinin dişli düğmesi, yani oraya varmışsan
  zaten o kartı çalışıyorsun; (2) indeks panelinde tek kart çalışma — satıra dokunmak zaten
  `onOpen → setSingleReview` ile tek kartlık tekrarı açıyor. Geriye gerçekten eksik olan ikisi kaldı.
  **İndeks panelinde çoklu seçim:** her satıra gerçek bir `<input type="checkbox">` (ekran okuyucuya
  seçili durumunu platformun kendisi söylüyor), seçim varken beliren "Seçilen {n} kartı çalış".
  Seçimler **id ile** tutuluyor, indeksle değil — liste sayfalı ve filtreli, indeks ikisi de
  değiştiğinde başka bir kartı gösterir; filtre değişince seçimler temizleniyor, yoksa öğrencinin
  artık göremediği kartlarla oturum başlardı. Buton yalnızca seçim varken çiziliyor: ömrünü disabled
  geçiren bir kontrol, zaten üç filtre boyundaki bir panele eklenmez. **Sayfadaki seçili karta
  "Çalış" düğmesi:** `SelectionOverlay`'e toplamalı `action?: {label, icon, onClick}` slotu eklendi
  (vision board hiçbir şey geçmiyor — bu bir slot, özellik değil). Kart zaten **çift tıklamayla**
  açılıyordu; çift tıklama kimsenin bulduğu bir şey değil. Düğme kutunun altında, döndürme tutamağının
  karşısında; `pointerdown` ve `click` durduruluyor, yoksa sahne onu sürükleme başlangıcı sayardı.
  Shell'de `studyDeck` state'i `singleReview`'ün yanında ayrı duruyor, çünkü ikisi farklı bitiyor:
  sayfadan açılan tek kart cevaplanınca kapanır, öğrencinin kurduğu deste kendi sonuna kadar yürür.
  **Yol boyunca bir hata düzeltildi:** `handleReviewed` her cevapta `dueCount`'u azaltıyordu; vadesi
  gelmemiş bir kartı erken çalışmak da sayacı düşürüyor, yani defter hiç girmediği bir desteden kart
  temizlediğini iddia ediyordu. Artık yalnızca kart gerçekten `due` listesindeyse azalıyor.
  İlgili: `notebook-index-panel.tsx`, `notebook-side-panel.tsx`, `notebook-shell.tsx`,
  `components/stage/selection-overlay.tsx`, `messages/{tr,en}.json`.

- **Kart boyutlandırma, "Çalış" düğmesinin tonu ve panel kaydırması (2026-08-23, APP-046)** —
  Kullanıcı ekran görüntüsüyle dört madde bildirdi; üçü yapıldı (sayfalar arası taşıma ayrı tura).
  **(1) Boyutlandırma.** `nextEntrySlot` en-boy oranını _zaten_ kullanıyordu ama yarım: genişlik hep
  sabit `ENTRY_WIDTH`, yükseklik `width/aspect` hesaplanıp 180–420'ye **kırpılıyordu**. Yalnızca
  yüksekliği kırpmak kutunun oranını değiştiriyor ve `object-contain`'e doldurulacak bir boşluk
  bırakıyor — defterdeki siyah bantların kaynağı buydu, `aspect` ölçülemediğinde (sabit 300) ise
  bant devasa oluyordu. Artık sınıra takılınca **iki boyut birden ölçekleniyor**: kart küçülüyor,
  şekli hiç değişmiyor. Genişlik yine sert sınır (yazı alanı), o yüzden panorama bir foto minimum
  yükseklikten de kısa kalabiliyor. Dar kalan kart yazı alanında **ortalanıyor** — sola sabitken
  sağında büyüyen bir boşluk bırakıyordu ve bu hata gibi okunuyor. `y` artık sabit adım değil,
  **yerleştirilmiş kartların gerçek altı**; sabit adım değişken yüksekliklerde aynı anda hem
  çakışıyor hem boşluk bırakıyordu (kodda bunun "sonraya" notu duruyordu, iş bu turda geldi).
  Eski "stacks each card below the previous one" testi sabit-adım varsayımını kodluyordu ve yeni
  kuralla düştü; test **yeni sözleşmeyi** ifade edecek şekilde yeniden yazıldı, üstüne oran/ölçek/
  ortalama/metin-only için dört test daha (9/9). **(2) "Çalış" düğmesi** dolu accent hapken yüzey
  üzerine ince accent kenarlıklı 32px'lik bir çipe indi: dolu haliyle sayfaya sonradan konmuş yabancı
  bir nesne gibi duruyordu, şimdi asıldığı seçim çerçevesinin bir parçası gibi okunuyor.
  **(3) Kenar panelinin kaydırmaması gerçek bir hataydı ve paneller suçsuzdu:** zincir (`Panel` →
  `h-full min-h-0 overflow-y-auto`) doğruydu, kök kapta `min-h-[100dvh]` vardı — **taban var, tavan
  yok**. Uzun bir liste tüm kabuğu büyütüyor, aşağıdaki `flex-1 min-h-0` bölüştürecek bir yükseklik
  bulamıyor ve alttaki her `overflow-y-auto` ölü koda dönüyordu; diğer paneller kısa olduğu için
  yıllardır görünmemişti. Masaüstünde gerçek yükseklik verildi (`lg:h-[100dvh] lg:min-h-0
lg:overflow-hidden`), mobilde taban aynen kaldı — orada panel yarım ekran bir sayfa ve sayfa
  gerçekten kayıyor. Uygulama kabuğu masaüstünde yalnızca `padding-left` ekliyor, üstten pay yok,
  yani `100dvh` doğru ölçü.
  **Ertelendi:** sayfalar arası içerik taşıma. İki sayfa iki ayrı doküman, jest katmanı vision board
  ile ortak; sürükleyip diğer sayfaya bırakmak iki sahnenin dikdörtgenlerini, koordinat çevirisini ve
  iki dokümanın birden kaydını gerektiriyor — ortak katmana dokunduğu için kendi turunu hak ediyor.
  **Kaydırma vs sığdırma — dört denemede öğrenilen ders.** Kök kap `min-h-[100dvh]` idi: taban var,
  tavan yok. Sonucu iki katlıydı — yan panel kendi içinde kaymak yerine tüm kabuğu büyütüyordu, _ve_
  `useFitSize`/`fitWithin` düzeneği (tek işi yayılımı görüntü alanına sığdırmak) çalışacak kesin bir
  yükseklik bulamadığı için yalnızca genişliğe göre sığdırıyor, defter pencerenin altından taşıyordu.
  Yani sayfa kaydırması bir tasarım tercihi değil, **eksik bir sayının yan etkisiydi.**
  Denemeler: (1) `lg:h-[100dvh]` — **aslında doğruydu**, sığdırma düzgün çalıştı, tek eksiği kenar
  payıydı; (2) panik refleksiyle `max-h-[100dvh]` tavanına geçildi — **çok daha kötü**: tavan
  yüksekliği belirsiz bırakıyor, ölçüm sıfıra düşünce kod `fitted.width || notebookMaxWidthPx` ile
  sabit azami genişliğe geri düşüyor ve `justify-center` taşan kitabı iki yönden birden taşırıyor
  (kullanıcının gördüğü üstten _ve_ alttan kırpılma buydu); (3) tavan panele taşındı, defter eski
  haline döndü ama sayfa yine kaydı; (4) birinci denemeye dönüldü ve asıl eksik eklendi: kenar payı.
  Pay **ölçülen kutuya konamaz** — `getBoundingClientRect` dolguyu içerir, yani orada verilen dolgu
  kitaba "büyüyebileceğin yer" diye sunulur. Bir seviye yukarı, sahne kolonuna kondu (`lg:py-4`):
  orada fit kutusu kısalıyor ve kitap o boşluğu hiç görmüyor. Panelin tavanı da (`lg:max-h-[100dvh]`)
  emniyet kemeri olarak bırakıldı. Mobil taban aynen kaldı — orada panel yarım ekran bir sayfa ve
  sayfa gerçekten kayıyor.
  **(5) Ve asıl teşhis, doğru soruyu sorunca geldi:** dolgu 16px'ten `3vh`'ye çıkarıldığında kitap
  **hiç değişmedi**. Dolguya tepkisiz bir kutu, boyutunu dolgunun kısalttığı ölçümden almıyor
  demektir — yani `fitted.width` sıfır, kod `|| notebookMaxWidthPx` ile pencereyi hiç bilmeyen sabit
  bir piksel tavanına düşüyor ve kitap her koşulda o boyutta çiziliyordu. Tam yükseklik ve dolguya
  duyarsızlık aynı tek sebebin iki yüzüydü. Çözüm ölçümü beşinci kez tahmin etmek değil, **sığdırmayı
  JS'e bağımlı olmaktan çıkarmak** oldu: kitabın kutusuna `maxHeight: "100%"`. `aspect-ratio` zaten
  ayarlı olduğu için tarayıcı genişliği de birlikte küçültüyor, oran korunuyor. Artık sığma bir
  hook'un değil düzenin özelliği — kitap kabını tek kare için bile aşamıyor ve etrafındaki pay
  nihayet bir anlam taşıyor. `fitWithin` yerinde duruyor; ölçüm geldiğinde daha isabetli bir genişlik
  veriyor, gelmediğinde CSS zaten güvende.
  Ders: ölçüm yapan bir düzeneğin ölçtüğü kutuyu değiştirerek düzen hatası çözülmez; bir denemeyi
  "başarısız" diye kenara atmadan önce şikâyetin ne olduğunu tam okumak gerekir (birinci denemenin
  tek kusuru bir dolguydu); ve "değişiklik hiç görünmüyor" bir hayal kırıklığı değil, **teşhisin
  kendisidir** — beş turdur aranan cevabı tek başına verdi.
  Aynı turda sayfadaki eski kartların yeniden ölçülmesi konuşuldu ama **yapılmadı**: kullanıcı yeni
  eklenen görsellerin doğru boyutlandığını doğruladı, yani bantlı kartlar eski yerleşimin kaydedilmiş
  ölçüleri; geriye dönük düzeltme kimsenin istemediği bir düzen değişikliği olurdu.
  İlgili: `notebook-layout.ts` (+spec, 9 test), `selection-overlay.tsx`, `notebook-shell.tsx`.

- **Cilt yeniden tasarlandı: gümüş halkalardan siyah tel sarıma (2026-08-23, APP-046)** — Kullanıcı
  bir referans görselle geldi. Mevcut cilt iki yönden yanlıştı. **Renk:** `--notebook-wire-*` soluk
  gümüştü (`#e4e7ee`/`#9aa3b4`) ve krem kâğıt üstünde neredeyse hiç kontrastı yoktu — kitabı bir arada
  tutan tek donanım parçası değil, bir dizi silik oval gibi okunuyordu. Siyah lake telin iki ucuna
  çekildi (`#1e222b` / `#8b93a4`); parlaklık onu basılı bir çizgi olmaktan, koyuluk ise metal
  yapmaktan sorumlu. **Ritim:** halkalar `RING_STEP * 6` aralıkla, yani tam bir halka boyu arayla
  duruyordu; sonuç zincir çit görüntüsü. Gerçek sarım sıkıdır — turlar arasındaki boşluk bir turun
  kesri kadardır, tamamı kadar değil. Yeni `RING_TILE = RING_STEP * 3.2` sabiti hem kapak cildinde
  hem açılımın cildinde kullanılıyor: ikisi tek defter olmak zorunda ve elle ayarlanmış iki ayrı
  aralık bir sonraki düzenlemede birbirinden ayrılır. Tel kalınlığı 0.32'den 0.38'e, delikler 0.8'den
  0.62'ye indi (sıkı sarımda delik de küçüktür), halka yüksekliği artık döşemenin oranı (`RING_TILE *
0.42`) — yani ritim değiştiğinde halka kendiliğinden onunla ölçekleniyor, ikinci bir sayı gerekmiyor.
  Değişiklik uygulamayı açmadan görülebilsin diye koddaki birebir sayılarla eski/yeni karşılaştırmalı
  bir statik önizleme üretildi (repoya girmedi).
  **Takip: kapalı halkalar boruya dönüşüyordu.** Sıkı sarıma geçince halkaların sol ve sağ uçları
  dikeyde üst üste binip iki kesintisiz çizgi oluşturdu; cilt tel gibi değil **boru** gibi okunmaya
  başladı. Sebep sıklık değil, halkanın kapalı olmasıydı: kapalı bir ilmek bobinin _yandan_ görünüşü.
  Önden bakıldığında telin uzak yarısı kâğıdın arkasındadır ve göz yalnızca bir delikten çıkıp
  diğerine dalan bir **yay** görür. Her halka artık turun ön yarısı. Yarım, clip ya da elle yazılmış
  path ile değil, **`pathLength` + tek dash** ile kesiliyor: buradaki geometri yüzde cinsinden
  (halkalar genişliği yayılımın yüzdesi olan bir oluğu geçmek zorunda) ve SVG path verisi yüzde kabul
  etmiyor. Elipsi 100 birime normalize edip 50'lik tek bir dash vermek, elipsin gerçek boyutu ne
  olursa olsun tam olarak üst yarıyı seçiyor. Uçlara `strokeLinecap="round"` — kesilmiş tel ucu.
  Oluğun kendi gölgelendirmesi de yumuşatıldı (0.18 → 0.11): dudakların tek işi kâğıdın dikişe doğru
  kıvrıldığını söylemek, eski şiddetinde kendisi koyu bir sütun çiziyor ve kapalı halkaların
  yaptığı boruya ekleniyordu.
  **İkinci takip: yatık yay, ince oluk, yakın yapraklar.** Yay `50 50`'den **`42 58`**'e indi ve
  `ARC_OFFSET = 46` ile elipsin tepesine ortalandı — görünen aralık 54→96, saat on iki 75. Dash ile
  ofset tek bir çift halinde adlandırıldı, çünkü biri değişince diğeri onunla hareket etmek zorunda;
  ayrı ayrı ayarlanırsa yay tepeye değil bir yana kayar. `SPINE_GUTTER` **34 → 20**: dikiş 34'te
  kendi başına bir sütun olacak kadar genişti, artık iki yaprağın arasındaki ince bir kanal.
  Halkaların açıklığı bu sayının **yüzdesi** olduğu için oluğu daraltmak onları da daraltıyordu;
  `rx` 34% → 50%, delikler 23/77% → 8/92% ile telin mutlak açıklığı korundu ve delikler kâğıdın
  üstünde, gerçek bir defterin zımbaladığı yere geldi. Bu üç yüzde birbirine bağlı — biri
  diğerleri olmadan oynatılırsa tel, geçmesi gereken deliklere ulaşamadan bitiyor; kod bunu söylüyor.
  **Kapak cildi hizalandı.** Renk, ritim (`RING_TILE`), kalınlık (`WIRE_GAUGE`) ve yay (`ARC_DASH`
  /`ARC_OFFSET`) zaten paylaşılıyordu; ayrışan tek şey halkanın kendi kabındaki ölçüsüydü — kapak
  halkası **ham birimle** (`rx={RING_STEP * 1.35}`) çizilen son parçaydı. Sonuç: açılımın halkaları
  dikişle birlikte ölçeklenirken kapağınkiler tek bir sabit boyda kalıyordu, yani aynı defterin iki
  cildi birbirinden ayrı yaşıyordu. Kapak halkası da yüzdeye geçirildi (`cx 34% / rx 46%`), yüksekliği
  açılımınkiyle aynı orana (`RING_TILE * 0.42`) ve deliği aynı yarıçapa (`RING_STEP * 0.62`) çekildi.
  Kapakta tek delik olması fark değil, doğrusu bu: önden bakınca yalnızca ön kapak zımbalı görünür,
  açılımda ise tel iki yaprağı birden deler.
  İlgili: `packages/ui/src/theme.css`, `notebook-surface.tsx`.

- **Yaprak çevirme: gerçek kıvrım denendi, geri alındı, kazanımlar kaldı (2026-08-24, APP-046)** —
  Kullanıcı "gerçek yaprak kıvırma olsun, kıvrılırken yaprak boyutunda hareket etsin, taşan zaten
  `overflow:hidden` ile gizleniyor" dedi. Yaprak on dikey **dilime** bölündü, her dilim bir öncekinin
  serbest kenarına menteşelendi (katlanır metre), açı `(i/n)^1.5` ile serbest kenara doğru arttı.
  Yaprak dikken ikna ediciydi; **yatınca dağıldı** — ve bir sayfa zamanının çoğunu yatarak geçiriyor.
  İki kusur, ikisi de tekniğin içinden çözülemez:
  **(a) Dikişlerde kırık.** Komşu dilimler izleyiciye farklı açılarda durur, perspektif her birini
  farklı kısaltır ve yatay çizgiler her dikişte kırılır. Yaprak yattıkça kırık açılır. Dilim sayısını
  artırmak kırığı küçültür, dikişi çoğaltır; azaltmak tersi.
  **(b) Gölgelendirme hizalanmaz.** Yaprak boyu bir gradyan on parçaya bölünüp hizalanmak zorunda; üstelik
  arka yüz kendi `rotateY(180deg)`'siyle **aynalanıyor**, yani pencerelenen gradyan her dilimin içinde
  ters çıkıyor. Düz tintlere geçmek aynalama sorununu çözdü ama **bandın kendisi oldu**: bu ölçekte on
  basamak, bir düşüş gibi değil on basamak gibi okunuyor.
  Ara teşhislerden biri kalıcı bilgi: bükülme dönüşün ortasında zirve yapınca dilimlerin bir kısmı
  90°'nin altında (ön yüz), bir kısmı üstünde (arka yüz) kalıyor ve yan yana iki farklı yüz şerit
  üretiyor — dönemli olarak beliren bir çizim bozukluğunun sebebi genelde çizimde değil zamanlamadadır.
  **Karar: rijit levhaya dönüldü.** Sahte kıvrımın dikişi, kırığı ve bandı yok; ölçülen sonuç, dilimli
  hali önceki halden _daha kötü_ yapıyordu. Deneyden sağ çıkanlar bedeli olmayanlar: yaprak artık
  `LIFT_PX` ile kitaptan **kalkıyor** (kullanıcının işaret ettiği "yaprak boyutunda hareket", taşan
  yeri kitabın kendi `overflow`'u kırpıyor) ve **iki yüzü de çizgili** — gerçek bir defter yaprağı iki
  tarafından da çizgilidir; boş arka yüz, yaprağın dönüşün ortasında malzeme değiştirmesi demekti.
  Gerçek deformasyon WebGL/canvas ister; ikisi de etkileşimli sahnelerimizin yaşadığı DOM'a sahip
  olmak ister. Denemenin her aşaması için, uygulanan halin birebir kopyası olan bir önizleme üretildi
  — tarayıcıda oturum açmadan karşılaştırma yapmanın tek yolu buydu.
  İlgili: `notebook-page-turn.tsx`.

- **Seans idle 3 kolon + focus overlay redesign (2026-08-24)** — `/seans` kurulum ekranı artık
  analizdeki gibi 3 kolon: solda paylaşılan `HistorySideRail` / mobilde `HistorySideDrawer` (son
  seanslar + “Tümünü gör”), ortada timer, sağda günlük odak hedefi + yol arkadaşı (tek instance;
  mobilde timer’ın altında). Sayfa başlığı / subtitle kalktı (`sr-only` `h1` duruyor). Ders ve
  odak müziği timer’ın üst köşelerinde pill dropdown; `preview_hint` metni yok (idle’da 5 sn
  preview hook’ta duruyor). Focus/break overlay `.session-focus-theme` (DESIGN.md §2.5 istisnası):
  `/visuals/session-focus-bg.webp` + wash, yoksa blob fallback, timer arkasında CSS damla/ripple.
  Müzik focus’ta da değişir; ders pill’i salt okunur (subject PATCH yok). Kontroller yatay
  `[X] [pause] [✓]`; ayrı mute dairesi kalktı (mute dropdown içinde). `CircularTimerRing`
  countdown’da 60 tick (12 majör) + kalın progress. Arkadaşla birlikte çalışma redesign’ı bu
  turda yok. Kullanım: `/seans` — idle’da kolonlar, Başla ile immersive overlay. Gotcha: görsel
  henüz yoksa blob fallback; `html.dark` overlay’i tersine çevirmez. İlgili:
  `study-session-shell.tsx`, `session-history.tsx`, `session-subject-picker.tsx`,
  `session-ambient-picker.tsx`, `session-focus-backdrop.tsx`, `session-content-skeleton.tsx`,
  `circular-timer-ring.tsx`, `packages/ui/src/theme.css`, `DESIGN.md`, `messages/{tr,en}.json`.

- **Seans idle kolon sıkılaştırma (2026-08-24)** — Sol rail artık desktop’ta analiz gibi
  `lg:h-[calc(100dvh-4rem)]` tavanıyla full-height. “Daha fazla göster” kalktı; rail son 8 seansı
  gösterir, footer’da yalnız “Tümünü gör”. Satırlar analiz listesi yoğunluğunda (circle/chip yok,
  dakika + konu + durum + tarih). Timer `+/−` ve preset pill’ler token yüzeyi/kenar (`--color-surface`
  / `--color-btn`), hardcoded `bg-white/70` yok. Yol arkadaşı kartı dar kolonda dikey: kimlik ayrı,
  Dürt / Birlikte çalış / Ayrıl altta full-width. İlgili: `study-session-shell.tsx`,
  `session-history.tsx`, `session-history-row.tsx`, `session-timer-ring.tsx`,
  `session-buddy-card.tsx`, `circular-timer-ring.tsx`.

- **Koç notu sızıntısı + timer ticks + sidebar geçmiş (2026-08-24)** — Seans bitişindeki koç
  notu `<<TASK{...}}` (kapanış `>>` yok, fazla `}`) ham metin olarak sızıyordu: reflection artık
  `extractReplyMarkers` ile strip + recover ediyor; cache hit de aynı. FE `sanitizeCoachDisplayText`
  - `recoverSuggestedTask` ikinci hat. Timer setup’ta da focus’taki 60 tick + parlayan progress
    var; hızlı çevirince görünen kare çerçeve `outline-none` + `rounded-full` focus ring. Son seanslar
    rail/drawer full-height; “Tümünü gör” ve `/seans/gecmis` sayfası yok (eski URL `/seans`’a
    yönlenir). Tarih/konu filtreleri + “Daha fazla göster” sidebar içinde. Kullanım: `/seans` idle
    rail. Gotcha: bozuk `<<TASK` JSON’u parse edilemezse kart çıkmaz, metin yine temizlenir.
    İlgili: `suggested-task.ts`, `session-reflection.service.ts`, `coach-reply-markers.ts`,
    `circular-timer-ring.tsx`, `session-history.tsx`, `study-session-shell.tsx`,
    `study-session/history/page.tsx`.

- **Skeleton, defter boyutu ve sayfa göstergesi (2026-08-24, APP-046)** — Üçü de aynı şeye bağlandı:
  dikey bütçe. **Sayfa göstergesi akıştan çıkarıldı** (`sticky` → `absolute`, spread'in ayağında
  yüzüyor). Akıştayken gerçek yüksekliği olan bir satırdı ve o yüksekliğin her pikseli doğrudan
  defterden gidiyordu: `useFitSize` bu satırın ve araç çubuğunun geriye bıraktığını ölçüyor, yani
  kimsenin bakmadığı bir kontrol şeridi defteri sessizce küçültüyordu. Şerit `pointer-events-none`,
  butonlar tek tek geri açılıyor — şerit tam genişlikte ve altındaki şey öğrencinin kart sürüklediği
  canlı bir sayfa. Sahne kolonunun dolgusu da `3vh`'den `2vh`'ye indi. **Skeleton yeniden yazıldı ve
  asıl kusuru şekildi:** portre _tek sayfa_ ayırıyordu (`max-w-md`, 1080/1440), oysa gelen şey bir
  **açılım** — boyunun bir buçuk katı genişlikte; ayrıca ray ve yan panel hiç yoktu, dolayısıyla
  gerçek içerik gelince tüm düzen yana kayıyordu. Yanlış yer ayıran bir skeleton hiç olmamasından
  kötüdür: bir düzen vaat edip sözünü bozar. Yeni skeleton kabuğun çerçevesini birebir taklit ediyor
  (aynı dış dolgu, masaüstünde aynı sabit yükseklik, aynı ray genişliği, aynı panel genişliği) ve
  kitabın kutusu tahminle değil **`SPREAD_RATIO`** ile türetiliyor — bu sabit `notebook-surface`'tan
  export edildi, çünkü skeleton'ın oranı elle yazılırsa `SPINE_GUTTER` ilk değiştiğinde ikisi
  birbirinden ayrılır.
  İlgili: `notebook-content-skeleton.tsx`, `notebook-shell.tsx`, `notebook-surface.tsx`.

- **Kapak özelleştirme: renk, malzeme, kapak yazısı (2026-08-25, APP-046)** — Kullanıcı sordu:
  görsel mi, SVG/CSS mi? Cevap **CSS + tek SVG filtresi**, üç gerekçeyle: kapak zaten CSS ve kodda
  gerekçesi yazılıydı; defter `useFitSize` ile sürekli ölçekleniyor, yani raster bir görsel için
  birden çok boy üretmek gerekir ve yine de büyük ekranda yumuşar; ve seçicideki önizlemeler **gerçek
  tariflerle** çizilince önizleme ile kapak asla ayrışamaz — kağıt seçicisinin `PAPERS` üzerinden
  yaptığının aynısı. Görselin kazanacağı tek yer fotoğrafik gren; onu `feTurbulence` ile üretilen,
  satır içi data-URI olarak gömülü tek bir gürültü katmanı karşılıyor (asset yok, decode yok, her
  boyutta net). **Renkler literal hex, tema tokenı değil** — mürekkep kalemlerinin de gerekçesi bu:
  bunlar temanın sahip olduğu yüzeyler değil, kullanıcının seçtiği içerik; karanlık modda dönen bir
  palet birinin bordo defterini yeşile boyardı. Kapak yazısı krem bir **etiket plakasında** duruyor,
  doğrudan kapağa basılmıyor — bu yüzden renk başına ayrı yazı rengi kuralı gerekmedi ve palete yeni
  renk eklemek tek satır. **Depolama:** kitap seviyesinde kayıt yok (`NotebookOverviewDto` sadece
  sayaç), `paper` ise sayfa başına. Kapak, **0. sayfanın jsonb dokümanında** isteğe bağlı bir alan
  olarak duruyor: migration yok, repository yok, uç nokta yok — mevcut kaydetme yolu çalışıyor.
  Alan `optional`, `default`'lu değil: yokluğu "bu sayfa kapak taşımıyor" demek ve bu kırk sayfanın
  otuz dokuzu için doğru; defaultlamak, önemli olan tek kopyayı diğerlerinden ayırt edilemez yapardı.
  **Yazma iki yollu**, çünkü 0. sayfa açık olabilir de olmayabilir de: açıksa kendi reducer'ından
  geçip zaten çalışan otomatik kayda biniyor (aksi halde ikisi yarışır ve kaybeden kazananın üzerine
  yazar), kapalıysa dokümanı **taze çekilip** geri kaydediliyor — mount'ta alınmış bir kopya o ana
  kadar dakikalarca eskimiş olabilir. Reducer'daki `setCover` bilerek **geçmiş kaydı tutmuyor**:
  kapak sayfaya çizilen bir şey değil, kitabın bir özelliği; sticker'ı geri alan biri cildi yeniden
  boyamak istemiyor. Test, sürüklenmenin gerçekten olabileceği tek yeri tutuyor: enum'a değer eklenip
  tarifi unutulduğunda kapak sessizce boyasız çizilir, derleyici bunu yakalamaz.
  İlgili: `packages/types/src/coaching.ts`, `packages/validation/src/coaching.ts`,
  `notebook-surface.tsx` (+`notebook-cover.spec.ts`), `notebook-side-panel.tsx`,
  `use-notebook-page.ts`, `notebook-shell.tsx`, `messages/{tr,en}.json`.

- **Mobilde yaprak çevirme yerine slayt geçişi (2026-08-25, APP-046)** — Mobil zaten tek yaprak
  gösteriyordu (`isMobile` + `mobileSide`); değişen şey geçişin kendisi. Telefon tek sayfa gösterirken
  koca bir yaprağı çevirip tek sayfa ilerlemek tereddüt gibi okunuyor; sayfalar birbirinin yanından
  kayıp geçmeli. **Asıl zorluk şuydu:** yaprak çevirme, içeriğin _altında_ değişmesine izin veriyor —
  uçan yaprak boş ve opak, değişimi örtüyor. Slaytta ise çıkan sayfanın **eski içeriğini** göstermesi
  gerekiyor, oysa `mobilePage` sayfa değiştiği anda diğer tarafın dokümanına geçiyor; mevcut
  `AnimatePresence` de çıkan alt ağacı canlı tuttuğu için o da yeni içeriği çiziyordu. Yani iki slayt
  da aynı sayfayı gösterirdi. Çözüm çıkan sayfanın **fotoğrafı**: `doc` + `entries` referansı bir
  kereliğine saklanıp etkileşimsiz bir katman olarak çiziliyor (`NotebookPageStage`'e hiçbir pointer
  callback'i verilmiyor, etkileşimsizliği bundan türetiyor). Ek istek yok — bu, bir kare önce zaten
  çizilmekte olan nesne; sayfa-çevirme yorumunun reddettiği şey "üçüncü ve dördüncü sayfayı
  **çekmek**"ti, bu değil. Temizlik `onAnimationComplete`'te ve **sıra numarasıyla**: ilk kayma
  bitmeden ikinci sayfa değişimi olursa fotoğraf değiştiriliyor, yanlış olanı silecek bir zamanlayıcı
  yarışmıyor. Süre 320 ms — masaüstündeki 780 ms yaprak ağırlığı olan bir nesneyi satıyor, kayma ise
  navigasyon ve üçte bir saniyeyi geçince telefon yavaş sanılıyor. Crossfade mobilde sıfırlandı: o
  fade, değişimi dönen yaprağın altında gizlemek içindi ve artık yaprak yok — kaymanın üstüne fade,
  aynı hareketi anlatmaya çalışan iki geçiş demek. `startSlide` `mobilePage` yerine iki sayfa
  hook'undan türetiyor, çünkü o değişken bileşende bu callback'ten sonra tanımlı (TDZ). **Parmakla
  sürükleyerek sayfa değiştirme bilerek eklenmedi:** mobil sahnede kartlar zaten parmakla
  sürükleniyor, sayfa üzerinde yatay bir sürükleme "kartı taşı" mı "sayfayı çevir" mi belirsiz kalır.
  İlgili: `notebook-shell.tsx`.

- **Defterlerim koleksiyonu (2026-08-25)** — `coaching` içine kullanıcıya ait `notebooks` üst
  kaynağı eklendi. `/defterlerim` (`/notebooks`) sistem **Yanlış Defteri**ni sabit ilk kartta ve
  custom defterleri son kullanıma göre 12’li sayfalama ile gösterir; kullanıcı genel veya mevcut
  sınav taksonomisinden tek derse bağlı defter oluşturabilir, düzenleyebilir ve silebilir. İlk
  custom defter başarıyla oluşturulunca editöre geçilir. Custom editörde yalnız not, sticker,
  kalem, kâğıt/kapak, undo/redo ve autosave vardır; fotoğraf, yanlış kartı, arama/tekrar, AI ve dosya
  eki yoktur. API de custom sayfadaki `entry` item’ını `400` ile reddeder; sistem defteri silme
  `403`, sahip olunmayan defter `404` olur.

  Migration mevcut her kullanıcı için tek `MISTAKE` kaydı açar, eski
  `mistake_notebook_pages` tablosunu `notebook_pages` olarak yeniden adlandırır, sayfaları sistem
  defterine bağlar ve sayfa 0’daki `cover` başlık/renk/malzeme verisini kitap metadata’sına kayıpsız
  taşıdıktan sonra JSON’dan kaldırır. Sayfalar custom defter silinince cascade olur; KVKK hesap
  silme artık koleksiyon kökünü siler. Yeni kullanıcıda sistem defteri koleksiyon veya legacy
  yanlış-defteri erişiminde idempotent oluşturulur. `/v1/coaching/notebook/**` uçları korunur;
  overview yalnız additive `notebook` metadata alanı kazanır ve custom sayfalar yanlış/tekrar
  sayaçlarına girmez. Önceki “kapak sayfa 0 JSON’unda saklanır” timeline kararı bu geliştirmeyle
  sona ermiştir.

  İlgili: `0084_unknown_old_lace.sql`, `schema.ts`, `mistake-notebook.repository.ts`,
  `mistake-notebook.service.ts`, `notebooks.controller.ts`, `packages/{types,validation}`,
  `apps/web/src/lib/notebook.ts`, `notebooks/`, `notebook-shell.tsx`, `app-nav.tsx`,
  `routing.ts`, `messages/{tr,en}.json`.

- **Defterlerim release hardening (2026-08-25)** — `0084`, sayfanın `notebook_id` ile başka
  kullanıcının `user_id` değerini birleştirmesini artık veritabanı seviyesinde de reddeder:
  `notebooks(id,user_id)` benzersiz anahtarı ve `notebook_pages(notebook_id,user_id)` composite FK
  birlikte çalışır; mevcut repository sahiplik filtresi ve RLS ikinci/üçüncü koruma olarak kalır.
  Migration provası her çalıştırmada benzersiz geçici veritabanı açar, `0083` sonuna kadar legacy
  durumu kurar, kapak/sayfa taşımasını ve `0085` zincirini doğrular, yalnız kendi veritabanını
  `finally` içinde siler. `0085` sonrasında benzersiz `NOSUPERUSER/NOBYPASSRLS` probe rolüyle
  kullanıcı context'inin oda/üyelik satırlarını okuyamadığı ve yazamadığı, `SERVICE` context'inin
  ise iki tabloyu okuyup yazabildiği gerçek PostgreSQL üzerinde kanıtlanır; geçici rol de cleanup'ta
  silinir. Gerçek Postgres HTTP E2E paketi plural CRUD, legacy delegasyon, taksonomi, sahiplik,
  RLS, cascade, sayaç ayrışması ve KVKK silmeyi kapsar.

  Web'de create/delete sonrasında koleksiyon sunucudan yeniden ilk sayfaya alınır; yükleme devamı
  ve silme hataları mevcut kartları bozmadan inline yeniden deneme sunar. Dialog ilk alan odağı,
  44px hedefler, focus ring ve reduced-motion doğrulandı. Mobil defter editörü tam ekran chrome
  kullanır; böylece üst navigasyon editör araçlarının dokunma alanını kapatmaz. DELETE başarılı
  olup liste yenileme başarısız olduğunda defter yerelden kaldırılır ve yeniden deneme yalnız ilk
  sayfayı eşitler; silme isteği ikinci kez gönderilmez. Bu regresyon harici dev sunucusunu kabul
  eden Playwright `baseURL` override'ı ile stale production build'e ihtiyaç duymadan desktop ve
  mobil viewportlarda doğrulanır; varsayılan CI `next start :3100` davranışı değişmez.

  Defter oluşturma/düzenleme formunun ortak `@mentor/ui` modalı Framer Motion ile merkezden sakin
  bir ölçek/opaklık geçişi kullanır; kapanış tamamlanmadan dialog DOM'dan ayrılmaz ve işletim
  sisteminin reduced-motion tercihi animasyonu kapatır. Custom defter kartlarındaki düzenle/sil
  aksiyonları hover destekleyen cihazlarda kart hover'ı veya klavye odağıyla görünür, dokunmatik
  cihazlarda ise erişilebilir kalmak için sürekli gösterilir. İlgili: `packages/ui/src/components/modal.tsx`,
  `notebooks-shell.tsx`.

  Koleksiyon ve tekil defter sorguları sayfa sayılarını forced RLS altında correlated alt sorgudan
  okumak yerine kullanıcıya ait sayfaları tek bir toplu `GROUP BY notebook_id` sorgusuyla hesaplar.
  Böylece dolu sistem Yanlış Defteri kartının `0 sayfa` görünmesi giderilir; N+1 oluşmadan repository
  sahiplik filtresi ve RLS birlikte korunur. İlgili: `mistake-notebook.repository.ts`,
  `notebooks.e2e-spec.ts`.

  Yanlış Defteri tekrar akışının tamamlandı, yarıda bırakıldı ve ikinci kez takılma ekranları ortak
  bir highlight-summary diliyle yenilendi. Duruma göre nötr, başarı veya yardım vurgulu başlık alanı;
  tek aksiyon hiyerarşisi ve kart içine kart görünümü oluşturmayan sade kaçırılanlar listesi kullanılır.
  Uzun listeler modal içinde kayar; mobil ölçüler, tema tokenları, 44px hedefler ve reduced-motion
  davranışı korunur. İlgili: `notebook-review-panel.tsx`.

  Özet içindeki “Yine takıldıkların” satırında görsel ve metin alanı artık mevcut soru lightbox'ını
  açar; “Topluluğa sor” ayrı bağlantı olarak aynı entry handoff verisiyle topluluk composer'ına
  yönlendirir. Fotoğrafı olmayan kayıtta yanıltıcı önizleme aksiyonu gösterilmez.

  Yanlış Defteri handoff'uyla topluluk feed'ine taşınan dikey soru fotoğrafları feed kartını artık
  doğal oranıyla aşırı uzatmaz: tek görsel feed'de `4:3` ve üstten odaklı kompakt önizleme kullanır.
  Detay/cevap/yorum galerileri doğal oranı, lightbox ise kırpılmamış tam görseli korur. İlgili:
  `attachment-gallery.tsx`, `discovery-feed-card.tsx`.

  **Rollout checklist (deploy bu PR'nin parçası değil):**

  1. Staging yedeği/PITR ve uygulama sürümünü kaydet; aktif migration'ın `0083` olduğunu doğrula.
  2. `0084`ü uygula. Salt-okunur smoke sorgularıyla kullanıcı başına tek `MISTAKE`, toplam
     `notebook_pages`, boşta kalan sayfa ve `doc ? 'cover'` sayılarını kontrol et; çapraz kullanıcı
     eşleşmesi sıfır olmalı.
  3. Additive API'yi çıkar; plural CRUD, legacy overview/page ve sahiplik `404` smoke'larını çalıştır.
  4. Web'i çıkar; TR/EN koleksiyon, create/edit/delete, load-more retry ve custom autosave smoke'larını
     masaüstü/mobilde tamamla.
  5. Çalışma masası açılacaksa `0085`i uygula, API/web'i çıkar ve ancak smoke sonrası
     `coaching.study_rooms.enabled` bayrağını etkinleştir. Production'da aynı sırayı tekrarla.
  6. Sorunda uygulamayı önceki sürüme döndür; additive şemayı yerinde bırak. Eski tablo modeline
     dönüş SQL'i çalıştırma; gözlenen veriyle forward-fix migration hazırla.

  `0084` sonrası smoke sorguları (dördü de `0` dönmeli):

  ```sql
  SELECT count(*) FROM (
    SELECT u.id FROM users u LEFT JOIN notebooks n ON n.user_id = u.id AND n.kind = 'MISTAKE'
    GROUP BY u.id HAVING count(n.id) <> 1
  ) users_without_exactly_one_system_notebook;
  SELECT count(*) FROM notebook_pages p LEFT JOIN notebooks n ON n.id = p.notebook_id
  WHERE n.id IS NULL;
  SELECT count(*) FROM notebook_pages p JOIN notebooks n ON n.id = p.notebook_id
  WHERE p.user_id <> n.user_id;
  SELECT count(*) FROM notebook_pages WHERE doc ? 'cover';
  ```

  İlgili: `notebook-collection-migration.spec.ts`, `notebook-migration.e2e-spec.ts`,
  `notebooks.e2e-spec.ts`, `rls-isolation.e2e-spec.ts`, `account-erasure.e2e-spec.ts`,
  `notebooks-shell.tsx`, `e2e/notebooks.spec.ts`, `app-sidebar.ts`.

- **Çalışma masası — Dilim 1: çekirdek (2026-08-25)** — `/seans`'taki birlikte-çalışma akışı
  username ile arkadaş eklemeye dayanıyordu (karşı tarafın kullanıcı adını bilmeyi + kabul beklemeyi
  gerektirir, cold-start'ta ölü). Yerine **davet kodlu, temalı, kalıcı çalışma masası** geldi:
  kurucu masayı açar, `MASA-XXXXXX` kodunu paylaşır, gelen kişi kodla katılır. Buddy silinmedi —
  rolü daraldı: **buddy = asenkron hesap verebilirlik**, **masa = eş zamanlı birlikte çalışma**
  (buddy kartındaki çakışan iki yüzey Dilim 3'te kaldırılacak).

  **Sayaç hiç değişmedi.** Masa yalnızca zemin + koltuk + "kim şu an odakta" sinyali katıyor;
  herkes kendi Pomodorosunu tutuyor (body-doubling). Masada çalışmaya başlamak `/seans?room=<id>`'e
  yönlendirir, yani uygulamada tek bir timer implementasyonu kalır.

  **Presence yeni altyapı istemedi.** `study_sessions_self_or_service` politikası SERVICE rolüne tam
  okuma verdiği için bir masanın tüm koltukları `findRunningByRooms` ile **tek indexli sorguda**
  geliyor (`study_sessions_room_status_idx` + mevcut `runningNow` stale koruması). WebSocket, Redis
  ve heartbeat yok; istemci 30 sn'de bir poll ediyor.

  **Üyelik ≠ oturma.** Kişi başı **3 aktif** masa üyeliği var ama aynı anda tek koltuk: hangi masada
  oturulduğunu `study_sessions.room_id` belirler. Üç masaya üye biri seans başlattığında yalnız
  seçtiği masada canlı görünür, diğerlerinde koltuğu soluk kalır. Bu kolon ayrıca masa geçmişini de
  bedavaya veriyor (masa kapanınca `set null` — seans kaydı korunur, yalnız etiketini kaybeder).

  **Arşiv cron'u bilinçli olarak yok.** Kota `study_rooms.last_active_at > now() - 60 gün`
  filtresiyle sayılıyor; ölü masa kotayı yemiyor, silinmiyor da — yeniden oturulunca canlanıyor.
  `archived_at` kolonu ve sweep job'ı eklenmedi.

  **Bilinçli v1 sınırları:** sohbet ve tepki yok (roadmap §257 "sohbet kısıtlı"; moderasyon
  maliyeti sıfır kalsın diye hiç açılmadı) · ekonomiye dokunulmadı, masada çalışmak da tek başına
  çalışmak da aynı XP'yi verir, coin yok (§106) · **ban listesi yok**, çıkarılan üye aynı kodla geri
  dönebilir, sahibin kodu da yenilemesi gerekir (ban Faz-2 public odalarla gelecek) · mola sunucuya
  bildirilmiyor, koltuk "18 dk'dır masada" der, "molada" demez · masa seçimi seans **başlarken**
  yapılır, ortasında değiştirilemez.

  **Güvenlik ve yarışlar:** `study_rooms` / `study_room_members` yalnız SERVICE context'e izin veren
  `ENABLE + FORCE RLS` politikalarıyla korunur; kullanıcı görünürlüğü repository'nin açık sahiplik
  ve üyelik filtrelerinde kalır. Katılma kapasitesi ile sahip mutation'ları masa satırına
  `select … for update` kilidi alan tek transaction içinde doğrulanır. Kullanıcının aktif masa
  kotası create/join boyunca kullanıcı kimliğinden türetilen transaction advisory lock ile
  serileştirilir; iki paralel istek 3-masa sınırını birlikte aşamaz. Özellik
  `coaching.study_rooms.enabled` bayrağının arkasında ve varsayılanı `false`; her uç
  `assertEnabled()`'dan geçer.

  İlgili: `0085_unknown_newton_destine.sql`, `schema.ts`, `study-room.{service,repository}.ts`,
  `study-room.controller.ts`, `study-session.repository.ts` (`findRunningByRooms`),
  `session.service.ts` (start'ta üyelik doğrulaması + `touchLastActive`),
  `coaching-erasure.service.ts` (KVKK: üyelik hard delete, sahiplik devri),
  `config.catalog.ts`, `packages/{types,validation}`, `apps/web/src/lib/study-rooms.ts`,
  `study-room-theme.ts`, `session-room-list.tsx`, `room-shell.tsx`, `study-session-shell.tsx`,
  `use-session-timer.ts`, `routing.ts`, `messages/{tr,en}.json`.

- **Çalışma masası — Dilim 2: tema (2026-08-25)** — Masa artık düz grid değil: tema zemini + masanın
  etrafına dizilmiş koltuklar. Üç tema (Kütüphane/Kafe/Ev) hem zemini hem varsayılan ambient parçayı
  belirliyor.

  **Koltuklar yay uzunluğuna göre dağıtılıyor, açıya göre değil** (`room-seat-layout.ts`). Elips
  parametresini eşit adımlarla ilerletmek yalnızca çemberde doğru sonuç verir; uzun bir masada
  koltukları kısa kenarların uçlarında kümeler ve uzun kenarları boş bırakır. Çevreyi sabit hızla
  yürümek bir kümülatif-uzunluk tablosuna mal oluyor ama her kapasite (2–10) tek formülle, elle
  çizilmiş yerleşim olmadan çalışıyor — "kurucu koltuk sayısını seçer" kararını ucuzlatan şey bu.
  Test bunu **bağımsız integrasyonla** ölçüyor: koltuklar arası kenar uzunluğu farkı <%1, naive açı
  adımının onda birinden az.

  **Tema renkleri DESIGN token'larından `color-mix` ile türetiliyor** (`study-room-theme.ts`), sabit
  hex yok — üç tema paletle birlikte güncelleniyor ve dark mode'da okunur kalıyor. Aynı renkler
  arkaplan görseli yokken/yüklenemezken **fallback zemin** olarak da iş görüyor, yani oda hiçbir
  zaman boş dikdörtgen değil.

  **Odak ekranı masaya dönüyor:** `SessionFocusBackdrop` opsiyonel `roomTheme` alıyor ve odada
  başlatılan seansta solo zemin yerine odanın zeminini gösteriyor; halkalar (ripple) iki durumda da
  duruyor, böylece odak modu tek bir şey gibi okunuyor. Sayaç yine hiç değişmedi.

  **Gotcha — ambient tohumlaması saklanan tercihi ezmez.** Tema, ambient parçayı yalnızca kullanıcı
  o cihazda **hiç** tercih belirtmemişse dolduruyor (`localStorage` anahtarının varlığına bakılır;
  "off" değeri tek başına yeterli sinyal değil, çünkü "hiç seçmedi" ile "sessizi seçti" aynı değeri
  üretiyor). Öneri state'e yazılmıyor, türetiliyor — yani kendi başına kalıcı tercihe dönüşmüyor.
  `toggleMute` çalan parça üzerinden işliyor (aksi hâlde tema tohumlu parça sessize alınamazdı) ve
  o dokunuş tercihi kalıcılaştırıyor — çünkü sessize almak, çalan parça hakkında açık bir seçimdir.

  **Gotcha — zemin görseli `priority` olmak zorunda.** İlk hâlinde `RoomBackdrop` görseli lazy
  yüklüyordu; dosya olmadığı için istek hiç atılmıyor, dolayısıyla `onError` hiç tetiklenmiyor ve
  fallback ölü kod kalıyordu (oda yine doğru görünüyordu çünkü zemin `img`'in altında boyanıyor —
  ama tesadüfen). Tarayıcı doğrulamasında yakalandı; `priority` eklendi. Tam ekran zemin lazy
  yüklenmemeli: hem geç oturur hem hata yolu erişilemez kalır.

  **Eksik:** `public/visuals/room-{library,cafe,home}-bg.webp` dosyaları **henüz yok**. Bu ortamda
  görsel üretimi (text-to-image) kapalı olduğu için üretilemedi; kod fallback zeminle çalışıyor ve
  dosyalar sonradan bırakıldığında kod değişikliği gerekmiyor. Üretim promptu plan dosyasında.

  İlgili: `room-seat-layout.{ts,spec.ts}`, `room-seats.tsx`, `room-backdrop.tsx`, `room-shell.tsx`,
  `session-focus-backdrop.tsx`, `use-session-ambient-sound.ts`, `study-room-theme.ts`,
  `study-session-shell.tsx`.

- **Çalışma masası — Dilim 3: davet linki + masa bildirimi (2026-08-25)** — Masa artık kendi
  başına yayılıyor ve kendi kendini haber veriyor.

  **Davet linki.** `/masaya-katil?kod=MASA-XXXXXX` (`/join-room`) sohbete yapıştırılabilir bir
  bağlantı; masa sayfasındaki kopyala butonu artık çıplak kod yerine bu linki veriyor
  (`getPathname` ile okuyanın diline göre üretiliyor). Sayfa **bilerek `(app)` grubunun dışında**:
  o layout anonim ziyaretçiyi doğrudan `/login`'e atıyor, oysa davet linkinin bütün anlamı
  uygulamayı hiç açmamış birine çalışması. Dört yol: girişli+onboarding tamam → katıl ve masaya
  in · onboarding yarım → daveti park et, önce onboarding · anonim → daveti park et, `/kayit?next=`
  · kod yok/geçersiz/zaten üye → kendini açıklayan ekran.

  **Gotcha — `?next=` tek başına yetmiyor.** Yeni kullanıcı kayıt → onboarding → uygulama
  yolundan geçiyor ve query string o sıçramayı atlatamıyor. Bu yüzden davet ayrıca
  `sessionStorage`'a park ediliyor (`pending-invite.ts`) ve **onboarding'in bitiş butonunda**
  (`complete-step.tsx` `handleGoPanel`) tüketiliyor. İlk denemede yanlış yere — wizard'ın
  "zaten onboarded" guard'ına — bağlamıştım; tarayıcı testinde yakalandı, kullanıcı panele
  düşüyordu.

  **Gotcha — `next` bir açık yönlendirme yüzeyidir.** `safeNextPath` yalnız aynı-köken mutlak
  yolları geçiriyor: şema, `//host`, ters bölü (tarayıcı `//`'a normalize edebilir) ve kontrol
  karakterleri temizlenmiyor, **reddediliyor**. `sessionStorage` kullanıcı tarafından
  yazılabilir olduğu için okurken de yeniden doğrulanıyor.

  **Masa bildirimi.** Yeni `CoachingEventTopic.SESSION_STARTED` (yalnız `roomId` varken emit
  edilir — solo başlangıcı bekleyen kimse yok) → `StudyRoomActivityListener` masadaki diğer
  üyelere "Masada biri var" sessiz zil bildirimi düşürür, linki doğrudan masaya gider.
  `NotificationDeliveryRepository.tryRecord` ile **(alıcı, masa, aktör, gün)** başına tek
  bildirim: üst üste beş pomodoro masayı bir kez uyandırır. Uçtan uca best-effort — bildirim
  hatası seans başlatmayı asla kırmaz.

  **Neden modal değil:** biri oturması bir *davet* değil, bir *sinyal*. On kişilik masada her
  oturuşta diyalog açmak, odanın var olma sebebi olan odağı baltalar.

  **Silinen: buddy "birlikte çalışalım" daveti.** Sadece bir buton değildi — endpoint
  (`POST /v1/buddy/study-invite`), `BuddyService.sendStudyInvite`, `BUDDY_STUDY_INVITE` event'i,
  kalıcı bildirim, canlı SSE ipucu (`pushRealtimeEvent("study_invite")`) ve istemcideki modal
  zinciriydi. Eş zamanlı birlikte çalışma artık masanın işi (brainstorming'deki rol ayrımı), tek
  giriş noktası da o butondu; erişilemez kod bırakmamak için zincirin tamamı kaldırıldı. Buddy
  kartındaki **kullanıcı adıyla davet kutusu** da gitti — kohort önerileri kaldı. İlgili 11 i18n
  anahtarı temizlendi.

  İlgili: `coaching.events.ts` (`StudyRoomSessionStarted`), `session.service.ts`,
  `study-room.service.ts` (`getNotificationTargets`), `study-room-activity.listener.{ts,spec.ts}`,
  `join-room/` (sayfa + shell), `pending-invite.ts`, `post-auth-destination.{ts,spec.ts}`,
  `complete-step.tsx`, `(auth)/{login,signup}/page.tsx`, `room-shell.tsx`, `routing.ts`,
  `session-buddy-card.tsx`, `notification-drawer-shell.tsx`, `messages/{tr,en}.json`.

- **Yeni defter formu Nuton primitive’lere bağlandı (2026-08-26)** — Koleksiyon create/edit
  dialogu `@mentor/ui` `Modal` + `TextField` + `Button` ve web `MenuSelect` ile kuruldu.
  Vazgeç ghost, Kaydet primary/`busy`. Kullanım: `/defterlerim` → Yeni defter veya kart
  düzenle. Gotcha: ders alanı native `<select>` değil; e2e `option` role ile seçer.
  `DialogProvider` confirm yığınına form konmaz. İlgili: `notebook-form-dialog.tsx`,
  `notebooks-shell.tsx`, `choice-chip.tsx`, `modal.tsx`, `e2e/notebooks.spec.ts`.

- **Kapak rengi/malzeme swatch (2026-08-26)** — Formdaki kapak seçimi metin chip değil;
  defter yan panelindeki metin-arka-plan swatch sırası: renk daire (`size-5` nokta).
  Malzeme dururken 44px kare doku örneği (seçili rengin üstünde `COVER_MATERIALS`) —
  20px dairede kumaş/kraft/deri/düz ayrılmıyordu; hover’da büyütmek dokunmatikte
  işe yaramaz. İsim (Kumaş/Kraft/Deri/Düz) renklerle aynı hover/focus tooltip’inde;
  doku `overflow-hidden` iç katmanda, yoksa isim kesilir. İlgili: `notebook-form-dialog.tsx`.

- **Defter A4 + overlay chrome (2026-08-26)** — Sayfa tuvali 1080×1440 (3:4) → 1080×1527
  (ISO A4 210∶297); mevcut öğelerin X’i kaymaz, altta boş kâğıt açılır. Desktop chrome
  (tekrar chip, undo/sil/Kaydet, araç rail, detay paneli, sayfa okları) defterin üzerine
  biner — kolon/satır olarak yer kaplamaz, paneli açmak kitabı küçültmez. Mobil rail
  hâlâ akışta (yaprağı kapatmamak için). Dış padding 8px; immersif editörde tab-bar
  `pb` kalkıyor (AppNav zaten gizliydi). Kullanım: `/yanlis-defteri` veya
  `/defterlerim/:id`. Gotcha: e2e ink `viewBox` 1080×1527. İlgili: `notebook-shell.tsx`,
  `notebook-shell-layout.ts`, `notebook-content-skeleton.tsx`, `coaching.ts`
  (`NOTEBOOK_PAGE_CANVAS`), `(app)/layout.tsx`.

- **Defter mobil chrome (2026-08-26)** — Header + alt tab notebook’ta geri geldi: defter günlük
  alışkanlık, pano editörü gibi tam ekran değil (`hidesMobileAppChrome` yalnız pano + topluluk).
  Mobil araç rail varsayılan kalem dairesi (çizim tray’deki gizle ile aynı scale açılış);
  Ekle/Sticker satırı tıklanınca genişler. Yükseklik `100dvh - header - tab`. Kullanım: telefonda
  defteri aç, kaleme bas. Gotcha: e2e önce `Araçları göster`. İlgili: `app-nav.tsx`,
  `app-sidebar.ts`, `notebook-rail-items.tsx`, `notebook-shell.tsx`, `e2e/notebook.spec.ts`.

- **Defter mobil alt krom (2026-08-26)** — Üstte kalem FAB; tekrar chip + undo/sil/Kaydet onun
  hemen alt satırında (sayfanın en altına değil). Sayfa okları defter–tab boşluğunda — kâğıt
  üstünde kartları kapatmasın. Masaüstü overlay aynı. Kapakta yalnız chip (üstte) + pager.
  Kullanım: telefonda kalemin altında Kaydet, altta Sayfa. İlgili: `notebook-shell.tsx`,
  `notebook-content-skeleton.tsx`.

- **Defter araç rail kapsül (2026-08-26)** — Mobil açılış scale değil: kalem dairesinden
  `width`/`height` clip-reveal (framer-motion). Kapalı dairede opak kalem diski — ilk araç
  (Ekle) sızmasın. Ink tray aynı animasyon. Radius `rounded-[50px]`. Kullanım: kaleme bas,
  pill sağa büyür; Çiz gizle aynı. Gotcha: kapalıyken satır `inert`. İlgili:
  `notebook-rail-items.tsx`, `notebook-ink-toolbar.tsx`, `notebook-shell-layout.ts`.

- **Defter skeleton kapak (2026-08-26)** — Yükleme iskeleti açık spread değil kapak: A4 oranı
  (`COVER_RATIO`), `sm` kırılımı (`MOBILE_QUERY` ile aynı; eskiden `lg` tablet’te mobil krom
  bırakıyordu). Mobil: due üstte, pager defter–tab boşluğunda. Desktop: due + pager defterin
  üzerinde. Kalem/Kaydet yok — kapak gelince kaybolmasın. İlgili:
  `notebook-content-skeleton.tsx`, `notebook-surface.tsx`.

- **Çalışma masası — sahne redesign (2026-08-26)** — Masa sayfası karttan **yere** dönüştü.
  Öncesinde: 1660px ekranda 512px'lik kolon, bej bir kutu içinde gri elips ve zar zor görünen
  kesik çizgili halkalar; 1/4 doluyken sakin değil bozuk görünüyordu. İsim yine kırpılıyordu
  ("Yunus Emre Erke…"), ve masa başına bir kez yapılan **davet kartı sayfanın en büyük kartıydı**.

  **DESIGN.md'nin kendi istisna deseniyle genişletildi, yok sayılmadı.** Sistem zaten temayı
  takip etmeyen kapsamlı yüzeyler tanımlıyor (§2.5: `.session-focus-theme`, `.weekly-recap-theme`,
  `.premium-paywall-theme`). Masa da öyle bir yüzey: `packages/ui/src/theme.css` içinde
  `.room-stage` + `[data-room-theme]` ile kendi **`--room-*`** ailesi var. Kafe öğle vakti de
  loştur, kütüphane gece yarısı da aydınlıktır — sahne açık/koyu çerezini takip etmez. Yüzen
  chrome tek bir sözleşme okur: **`--room-ink`**; aydınlık kütüphane ile loş kafede aynı
  kontrollerin okunur kalmasını sağlayan şey bu.

  **Masa artık mobilya gibi okunuyor:** üst yüzey + kenar (iki kaydırılmış elips) + temas gölgesi
  + vinyet. Koltuklar **sandalye**: avatarın arkasında yuvarlatılmış sırtlık, boş sandalye de
  sandalye gibi görünüyor — "kesik çizgili daire" gibi render hatası gibi değil.

  **Boş sandalye davet kontrolüdür.** Sahibe boş sandalyeye basmak davet sayfasını açar. Kalıcı
  davet kartı kaldırıldı: eylem, boşluğun *olduğu* yerde yaşıyor ve birincil CTA ile yarışmıyor.
  Yıkıcı eylemler (ayrıl / masayı kapat) taşma menüsüne indi — masa kapatmak niyet istemeli.

  **Presence altyazı oldu, dipnot değil:** başlıkta canlı nokta + "2 kişi çalışıyor · Matematik,
  Tarih". Oturan avatarda `room-seat-live` nefes halkası; `prefers-reduced-motion` altında
  animasyon durur, halka kalır (ödül korunur, hareket düşer — §9.1).

  **İsim kırpması kaynağında çözüldü:** sandalye etiketi "Yunus E." biçiminde kısaltılıyor, tam ad
  `title`'da. Sabit genişlikli sandalye sayesinde kapasite değişse de etiket bozulmuyor.

  **Kabuğu kaplamıyor:** `fixed inset-0` değil, içerik alanını dolduran `relative min-h-screen`.
  Kenar çubuğu ve tab bar yerinde kalır — odadan çıkmadan gezinilebilir (odak modundan kasıtlı
  fark).

  **Not:** `ui-ux-pro-max` skill'inin önerdiği yön (Liquid Glass + teal/turuncu + Lora/Raleway)
  bilerek alınmadı; aracın kendi etiketi "Performance: Moderate-Poor / Accessibility: text
  contrast" diyor ve sayaç dönerken bakılan bir yüzeyde `backdrop-filter` + düşük kontrast yanlış
  yön. Araçtan alınan şey UX kontrol listesi oldu (reduced-motion, başlık hiyerarşisi, 44px
  hedefler, empty state).

  İlgili: `theme.css` (`.room-stage`, `room-seat-breathe`), `room-shell.tsx`, `room-seats.tsx`,
  `room-backdrop.tsx`, `messages/{tr,en}.json`.

- **Çalışma masası — hareket + tema karuseli + Masalarım (2026-08-26)** — Üç iş, ikisi aynı kökten:
  tema seçimi artık masa kurma akışının kendisi.

  **Tema karuseli (`room-theme-carousel.tsx`).** `<select>` yerine içinden geçilen bir oda:
  prev/next okları, dokunmatikte sürükleme, klavyede ok tuşları. Her geçişte **bütün sahne kayar**
  — zemin, masa, isim — çünkü seçilen şey bir atmosfer; açılır liste onu veritabanı değerine
  çeviriyordu. Yön (`direction`) tema ile aynı olayda set ediliyor, böylece çıkan ve giren slayt
  odanın hangi yöne gittiği konusunda anlaşıyor.

  **Gotcha — kapsam iki yerde gerekiyor.** Oklar ve noktalar animasyonlu elemanın *dışında*
  yaşıyor; dış sarmalayıcıya `.room-stage` verilmezse `--room-*` ailesi tanımsız kalıyordu.
  Slayt kendi kapsamını da koruyor: aksi hâlde çıkan tema, giderken yeni temanın rengine
  atlıyordu.

  **Gotcha — ref'i render'da okumak.** İlk sürümde yön bir `useRef`'te tutuluyordu ve `initial`/
  `exit` prop'ları onu render sırasında okuyordu (React ihlali, lint yakaladı). State zaten aynı
  olayda set edildiği ve batch'lendiği için ref gereksizdi.

  **Masa kurma sheet'e taşındı.** Önceden 288px'lik kenar çubuğunda üç üst üste alan vardı ve
  tema görünmüyordu. Şimdi: karusel banner, ad alanı, ve koltuk sayısı için **stepper** (aralık
  2–10; klavye açmaya değmez). Ortak `RoomSheet` kabuğu (mobilde alt sheet, `sm` üstünde ortalı
  dialog; Escape kapatır, gövde kaydırması kilitlenir) kur/katıl/davet/tema akışlarının hepsinde
  kullanılıyor.

  **Masalarım yeniden tasarlandı:** her satır kendi temasının **swatch**'ini taşıyor (sahnenin
  token'larıyla, küçültülmüş masa dahil), canlı çalışan sayısı yeşil rozette, satırlar stagger ile
  geliyor. Liste artık kayıt değil, yer listesi gibi okunuyor.

  **Masa sayfası hareketleri:** zemin tema değişiminde çapraz geçiş yapıyor (anlık atlamıyor),
  masa yerine oturuyor, koltuklar sırayla iniyor — odaya girmek "oda doluyor" gibi okunuyor.
  Sahip artık taşma menüsünden **temayı değiştirebiliyor**; aynı karusel, ve seçim anında
  kaydediliyor (karusel sonucu zaten gösterdiği için Kaydet butonu kullanıcıya gördüğü şeyi
  onaylatmaktan başka iş yapmazdı).

  Hepsi `useReducedMotion` ile korumalı: hareket düşer, değişim kalır (§9.1).

  İlgili: `room-theme-carousel.tsx`, `room-sheet.tsx`, `room-create-sheet.tsx`,
  `session-room-list.tsx`, `room-shell.tsx`, `room-seats.tsx`, `messages/{tr,en}.json`.

- **Çalışma masası — tema değiştirme sheet'siz (2026-08-26)** — "Temayı değiştir" modal'ı
  kaldırıldı; tema artık başlığın hemen altında, prev/next okları arasında — bir tıkla değişiyor
  (önceden menü → öğe → sheet → ok, dört adımdı). Sahibe göre gösterim: okları yalnız sahip
  görüyor, üye tema adını salt görüyor (eski menü öğesiyle aynı yetki sınırı).

  **Presence metni ("Şu an kimse çalışmıyor") o satırdan kalktı, geri getirilmedi.** Bir odanın
  chrome'a ayırabileceği tek satır vardı ve tema orada duracaktı; koltuklardaki canlı halka zaten
  kimin orada olduğunu bir cümleden daha iyi anlatıyor. Kasıtlı kayıp, unutulmuş değil.

  İlgili: `room-shell.tsx` (`changeTheme`, inline tema switcher), `messages/{tr,en}.json`
  (`theme_change`/`nobody_working`/`working_count` orphan oldu, kaldırıldı).

- **Çalışma masası — kütüphane masa/sandalye görselleri entegre edildi (2026-08-27)** —
  Kullanıcının ürettiği `library.webp`/`library-desk.webp`/`library-chair.webp`
  `public/visuals/room-library-{bg,table,seat}.webp` olarak proje konvansiyonuna taşındı.
  `RoomSeats` artık görsel varsa onu kullanıyor, yoksa (tema henüz asset'siz veya 404) mevcut
  CSS elipse/kutucuğa düşüyor — `RoomBackdrop`'takiyle aynı `onError` deseni. Masa **tek,
  kapasiteden bağımsız** bir görsel (CSS `scale` yerine `object-contain` ile kutuya sığdırılıyor);
  sandalye **radyal simetrik tek görsel**, 2-10 koltuğun hepsinde rotasyonsuz tekrar kullanılıyor.

  **Bulunan hata — `sizes` prop'u rem kabul etmiyor.** `sizes="34rem"` / `sizes="4rem"` Next.js
  image optimizer tarafından ayrıştırılamıyor, ikisi de en büyük cihaz kovasına (`w=3840`)
  düşüyordu — 64px'lik bir sandalye ikonu için 3840px genişliğinde görsel istemek gereksiz
  yavaşlık. `px` değerlerine (`"544px"`, `"96px"`) çevrildi, `srcset` artık `w=32`'den başlıyor.

  **Bulunan tasarım sorunu — sandalye halkası avatarın altında kayboluyor.** Sandalye çerçevesi
  64px (`size-16`), avatar 40px → geriye kalan görünür kadife/ahşap halka ~10-12px. Boş koltukta
  (avatar yok) tam disk net görünüyor; dolu koltukta bu ince halka avatarın kendi border'ıyla
  karışıp görünmez oluyordu. 80px'e (`size-20`) çıkarıldı — avatar boyutu (uygulamanın her
  yerinde aynı) değişmedi, sadece sandalyeye nefes payı verildi.

  İlgili: `room-seats.tsx`, `study-room-theme.ts` (`STUDY_ROOM_TABLE_SRC`, `STUDY_ROOM_SEAT_SRC`),
  `public/visuals/room-library-{bg,table,seat}.webp`.

- **Çalışma odası — okunabilirlik ve ölçek düzeltmesi (2026-08-28)** —
  **Kök neden: token seti ile gerçekte gelen görsel birbirini tutmuyordu.** `.room-stage`
  varsayılanı (LIBRARY) "aydınlık parşömen oda" varsayıyordu — `--room-ink: #2e2a22` koyu
  mürekkep, `--room-ground-to: #ede4d3` açık zemin. Ama entegre edilen `room-library-bg.webp`
  loş, lamba ışıklı bir okuma odası. Sonuç: koyu metin koyu zeminde kayboluyor ("Yunus E.",
  "Davet et" okunmuyordu), üstüne `RoomBackdrop`'un %26 veil'i açık `--room-ground-to` ile
  boyandığı için görseli de griye çalıyordu. Token bloğu görsele uyduruldu (koyu zemin, açık
  mürekkep, koyu scrim, `color-scheme: dark`). Ders: bir tema hem renk hem görsel taşıyorsa
  ikisi tek commit'te doğrulanmalı — biri diğerini sessizce okunamaz yapabiliyor.

  **Ölçek: kare sahne yalnızca genişlikten sınırlanmıştı.** `max-w-[34rem]` (544px) sabitti;
  full-bleed arka planın devasa kitaplıklarının ortasında masa oyuncak gibi kalıyordu.
  `max-w-[min(46rem,78vh)]` — kare olduğu için hangi eksen önce biterse ona uyuyor. Sandalyeler
  `lg:size-28`, etiket kolonu `w-[7.5rem]`, metinler 13/11px → `text-sm`/`text-xs`. Her etiket
  odanın kendi zemin rengiyle (`--room-ground-to`) halo alıyor: loş kütüphanede koyu, aydınlık
  evde açık — tek kural, üç tema.

  **CTA artık her odada marka mavisi (`--room-cta`).** Eskiden `--room-accent` okunuyordu, yani
  buton kütüphanede yeşil / kafede amber / evde maviydi. "Bu masaya otur" her yerde aynı
  aksiyon; rengi odaya göre değişen birincil buton her odada yeniden öğreniliyor. `--room-accent`
  odanın kendi sinyallerinde kaldı (oturan avatarın nefes alan halkası, focus ring'ler).
  Mürekkep beyaz değil koyu (`#0f2233`): beyaz-üstü-#55acee ~2.4:1 ile AA'yı geçmiyor.
  Token stage'de tanımlı, `--color-progress`'ten okunmuyor — sahne uygulamanın light/dark
  cookie'sini takip etmemeli (DESIGN.md §2.5 istisnası).

  İlgili: `packages/ui/src/theme.css` (`.room-stage`), `room-seats.tsx`, `room-shell.tsx`.

- **Çalışma odası — masa ölçeği, tema geçiş hatası, mobil dikey masa, tema önizleme
  (2026-08-28)** —

  **Bug: tema değiştirince masa/sandalye CSS çizimine düşüyor, sayfa yenileyince düzeliyordu.**
  `RoomSeats` görsel hatasını iki boolean'da tutuyordu (`tableImageFailed`, `seatImageFailed`).
  Henüz asset'i olmayan bir temaya (CAFE/HOME) geçmek `onError` ile bunları `true` yapıyor,
  kütüphaneye dönmek **geri almıyordu** — bileşen unmount olana kadar (yani reload'a kadar)
  fallback'te kalıyordu. Artık hata **kaynak bazında** (`failedSrc: string[]`) tutuluyor:
  asset'i olan tema, olmayandan etkilenmiyor ve 404 alan bir src bir daha istenmiyor.
  Aynı tuzak `RoomThemeCarousel`'de de vardı (karusel zaten temalar arasında geziyor), aynı
  şekilde çözüldü — orada state slaytın değil **ebeveynin** üstünde durmak zorunda, çünkü slayt
  `key={value}` ile her adımda remount oluyor.

  **Masa büyütüldü.** Elips yarıçapları %26/19 → %30/22. Koltuk yörüngesi %42/37'ye açıldı;
  aradaki boşluk keyfi değil, "sandalye + etiketi sığsın" mesafesi.

  **Mobilde masa dik duruyor.** `(max-width: 639px)` altında `LAYOUT.portrait` devreye giriyor:
  elips dikey (%17/30), koltuklar uzun kenarlara diziliyor, sandalyeler 64px'e iniyor. Masa
  görseli **aynı dosya**, `rotate(90deg)` ile — tam tepeden bakış olduğu için bir masayı
  döndürmek fiziksel olarak anlamlı, perspektifli bir çizimde olmazdı. Görsel kutusu
  döndürülmeden ÖNCE yatay kuruluyor (`TableImage`); dikey kutuya `object-contain` uygulayıp
  sonra döndürmek geniş görseli önce şeride sıkıştırırdı. Sahne her iki yönde de **kare**
  kalıyor: `seatPositions` yay uzunluğunu x ve y'yi aynı birimde sayarak ölçüyor, bu da ancak
  genişliğin %1'i ile yüksekliğin %1'i aynı piksel olduğunda doğru.

  **Yeni masa modalındaki tema önizlemesi artık gerçek oda fotoğrafı.** Öncesinde CSS'le
  çizilmiş jenerik bir elipsti — "Kütüphane" ile "Kafe"yi ayırt ettiren tek şey zemin rengiydi,
  ki bir atmosfer seçimi için dayanak değil. CSS çizimi fallback olarak duruyor, yani asset'i
  olmayan tema boş panel göstermiyor. `CAFE`/`HOME` (ve opsiyonel kütüphane v2) için üretim
  promptları: [`room-theme-visual-prompts.md`](./room-theme-visual-prompts.md). Dosyaları
  `public/visuals/` altına doğru adla bırakmak yeterli, kod değişikliği gerekmiyor.

  İlgili: `room-seats.tsx`, `room-theme-carousel.tsx`, `room-theme-visual-prompts.md`.

- **Çalışma odası — masa ölçeği (asıl neden), sabit CTA, seans sayfasıyla süreklilik
  (2026-08-28)** —

  **Masa neden hâlâ küçüktü: `object-contain` + kare asset.** Yarıçapları büyütmek işe
  yaramadı çünkü sorun yarıçaplarda değildi. `room-library-table.webp` **1254×1254 kare**
  (oval, şeffaf kutunun içine çizilmiş), ama görsel kutusu ovalin kendi oranlarına göre yatay
  kuruluyordu (%60×%44). `object-contain` kare bir görseli yatay kutuya **kısa kenardan**
  sığdırır — yani %44'ten. Genişlik hiçbir şey yapmıyordu. Kutu kareye çevrildi (`tableBox`),
  görsel artık tam `tableBox` kadar render ediliyor: masaüstü %66, mobil %64. Yan fayda:
  rotasyon bedava, kare kutunun dönmeden önceki ve sonraki ayak izi aynı.

  **CTA artık `absolute`, akışta değil.** Oda etrafına bakılan bir yer; oradan çıkan tek yol
  bakarken yerinde durmalı. Akışta olduğu için sahnenin yüksekliğiyle sürükleniyordu ve
  telefonda tab bar'ın altına düşüp tamamen kayboluyordu. Ayrıca `<main>` `min-h-screen`
  kullanıyordu — uygulamanın kendi chrome'unu yok sayan bir ölçü; repodaki standart viewport
  aritmetiğine çevrildi (`100dvh-4rem-80px-safe-area`, `lg:` üstünde tam ekran).
  **Butonun kendisi kaldırılmadı:** boş sandalyedeki `+` ikonu *davet et* (yalnız sahip için),
  "otur" değil. İkisi ayrı aksiyon; sandalyeye tıklamayı "otur" yapmak sahibin davet yolunu
  götürürdü.

  **Odadan seansa geçerken tema bağlamı kopuyordu.** "Bu masada çalışmaya başla" →
  `/study-session?room=` sizi düz bir ekrana bırakıyordu, odanın adı bir çipe inmiş oluyordu —
  az önce seçtiğiniz yerden çıkmıştınız. Odak modu odayı zaten geri getiriyordu
  (`SessionFocusBackdrop`); eksik olan **tek parça aradaki idle ekranıydı**. Artık `?room=`
  varken idle ekranı da `RoomBackdrop` giyiyor. Veil oda sayfasındakinden ağır (%58): burada
  zeminin üstünde koltuk değil gerçek uygulama chrome'u var (kartlar, seçiciler, geçmiş rayı)
  ve onlar app token'larıyla okunuyor. **Seçilmeyen yol:** timer'ı tamamen odanın içine taşımak
  daha bütünlüklü his verirdi ama iki ekranın state'ini birleştirmek demek — zemin düzeldikten
  sonra ayrı iş.

  **"Masalarım" satırındaki tema göstergesi gerçek oda fotoğrafı oldu.** Token washı + bej bir
  hap şeklindeydi: "bir masa" çizimi, hangi oda olduğunu söylemiyordu — oysa gerçek fotoğraf iki
  bileşen ötede zaten kullanılıyordu. Token çizimi fallback olarak duruyor. Burada tek boolean
  yeterli (sahne ve karuselin aksine): bir satırın teması altından değişmiyor, dolayısıyla
  hata almış bir src tekrar görünür hale gelemiyor.

  İlgili: `room-seats.tsx`, `room-shell.tsx`, `study-session-shell.tsx`, `session-room-list.tsx`.

- **Seans ekranı odanın içine taşındı: tema switcher, sade görünüm, sahne geçişi (2026-08-28)** —

  **Tema switcher artık iki sayfanın ortak bileşeni** (`room-theme-switcher.tsx`). Oda
  sayfasında zaten vardı; seans ekranı da artık odanın *içi* olduğuna göre temayı oradan da
  değiştirebilmek gerekiyordu. Kopyalamak yerine çıkarıldı — "sonraki tema hangisi" mantığının
  iki kopyası tam olarak zamanla birbirinden ayrılan cinsten. `canChange` (yalnız sahip, API
  kuralıyla aynı) devre dışı ok yerine bileşeni düz etikete indiriyor: üyeye bir aksiyon
  yasaklanmıyor, orada onun için aksiyon yok.

  **"Sade görünüm" düğmesi.** Oda zemini kapanır, masada oturuyor olmanın geri kalanı (isim,
  ambient, timer, `?room=` ile başlayan seans) aynen kalır. Odak modu da bundan etkileniyor —
  yani düğme "eski sade hâl"in tamamını geri getiriyor. **Kasıtlı olarak state, ayar değil:**
  temalı oda kimi için atmosfer kimi için dikkat dağıtıcı ve bu oturumluk bir ruh hali;
  yönetilecek bir tercih daha eklemek yerine ziyaret bitince sıfırlanıyor.
  Switcher `--room-*` okuduğu için `room-stage` burada da scope'lanmak zorunda; zemin kapalıyken
  iki token app token'ına yeniden yönlendiriliyor — bej bir `--room-ink-soft` lamba ışığındaki
  zemin için seçilmişti, sade yüzeyde işi yok.

  **Sahne geçişi: karart, sonra aç.** "Bu masada çalışmaya başla" artık önce perdeyi indiriyor
  (280 ms siyaha fade), sonra `router.push` ediyor; seans ekranı da siyahtan açılıyor. Masaya
  oturmak bir sahne değişimi, sayfa yüklemesi değil — sert kesme insanı odadan atılmış gibi
  hissettiriyordu. Buton hâlâ gerçek bir `<a>`: orta tık / ctrl+tık / "yeni sekmede aç"
  doğrudan geçiyor, `prefers-reduced-motion` fade'i tamamen atlıyor (aksi halde sebepsiz bir
  siyah ekran olurdu). Süre `ROOM_CURTAIN_MS` olarak **`study-room-theme.ts`'de**: iki ekrandan
  birinden diğerine import etmek, tek bir tam sayı için o sayfanın tüm bundle'ını ötekine
  taşıyordu.

  **Koltuktaki avatar sandalyeyle birlikte büyüyor** (`AVATAR_PX`: 34 / 44 / 60px, sandalye
  64 / 80 / 112'ye karşılık). Avatarı uygulama genelindeki 40px'e sabitlemek hataydı — burada
  bir yazar künyesi değil, bir insan; sandalye büyüdükçe yüz döşemenin içinde kaybolan bir
  minyatüre dönüşmüştü. Yarısı civarı: daha küçüğü tanınmıyor, daha büyüğü sandalyeyi mobilya
  olmaktan çıkarıyor.

  İlgili: `room-theme-switcher.tsx` (yeni), `room-shell.tsx`, `study-session-shell.tsx`,
  `room-seats.tsx`, `study-room-theme.ts`, `messages/{tr,en}.json` (`plain_view_on/off`).

- **Tema artık masalara özel değil: solo seansın da bir odası var (2026-08-28)** —
  Tek başına çalışmak da bir yerde çalışmaktır; düz koyu ekran ancak bekleme odası anlamında
  bir "yer"di. Seans ekranı artık `?room=` olmasa da temalı: masadaysan **masanın teması**
  kazanıyor (o odanın misafirisin, dekoratörü değil), değilsen kendi kaydettiğin sahne.
  Tema switcher her durumda görünüyor — solo iken oklar herkeste açık, masadayken yalnızca
  sahipte (API kuralının aynası).

  **"Sade görünüm" opt-out olarak kaldı** ve artık o da kalıcı: tema varsayılan hale gelince
  ikisi de gerçek birer tercih oldu, tercihler de reload'dan sağ çıkmak zorunda.
  `mentor_session_scene` altında **cihaz-yerel** tutuluyor: hangi odada çalışmayı sevdiğin şu an
  nerede oturduğunun özelliği, hesabının değil — ve her ok basışına bir API yazması değmez.

  **`useSyncExternalStore`, "effect içinde oku" değil** (`session-scene.ts`). Sunucuda
  `localStorage` yok, dolayısıyla kayıtlı değer ilk render olamaz; React'in server-snapshot
  el sıkışması bunu söylemenin desteklenen yolu. Effect'ten state'e okumak aynı şeyi fazladan
  bir render ve bir lint hatasıyla yapıyordu (`react-hooks/set-state-in-effect`). Snapshot
  referansla karşılaştırıldığı için depodan bir kez okunup önbelleğe alınıyor — her çağrıda
  yeni nesne döndürmek sonsuz render demek. Depodaki değer ayrıca **doğrulanıyor**: kullanıcı
  yazabildiği bir alan ve eski bir build'den kalma tema id'si asset haritalarını `undefined`
  ile indeksler.

  **Dokunulmayan:** ambient sesin tema önerisi hâlâ yalnızca gerçek masalara bağlı
  (`STUDY_ROOM_AMBIENT`). Solo temaya da bağlamak tutarlı olurdu ama ambient'e hiç dokunmamış
  mevcut kullanıcıların varsayılan sesini sessizce değiştirirdi — ayrı bir karar.

  İlgili: `session-scene.ts` (yeni), `study-session-shell.tsx`.

- **Tema çubuğu en üste, geri gelmeyen zemin, "sade görünüm" ikonu (2026-08-28)** —

  **Bug: temalar arasında gezip kütüphaneye dönünce zemin gelmiyordu.** Aynı `onError`
  tuzağının son kopyası `RoomBackdrop`'ta duruyordu — tek bir `visualFailed` boolean'ı.
  Asset'i olmayan bir temaya adım atmak onu `true` yapıyor, geri dönmek **geri almıyordu**.
  `RoomSeats` ve karusel için daha önce düzeltilmişti, üçüncüsü gözden kaçmıştı; artık üçü de
  kaynak bazında (`failedSrc`). **Ders:** `onError` ile beslenen bir "başarısız" bayrağı, o
  bileşenin ömrü boyunca kaynağı değişebiliyorsa neredeyse her zaman yanlıştır.

  **Alttaki siyah şerit: `main` masaüstünde viewport'tan 4rem kısaydı.** Seans kabuğu
  `lg:h-[calc(100dvh-4rem)]` kullanıyordu; o 4rem **mobil üst bar** için ve kabuk zaten
  `pt-16 lg:pt-0` ile onu hallediyor — masaüstünde üst bar yok. Reponun kendi sabiti de bunu
  söylüyor (`MOBILE_BELOW_APP_CHROME_HEIGHT_CLASS` → `lg:h-[100dvh]`). Hata baştan beri
  vardı, sadece sayfa zemini `--color-bg` iken görünmüyordu; fotoğraf gelince ortaya çıktı.
  `lg:h-[100dvh]` yapıldı.

  **Tema çubuğu artık kolonun en üstünde**, "Ders seç / Sessiz" satırının da üstünde — nerede
  olduğun, neyi zamanladığından önce gelir. Hem idle hem odak ekranında.

  **"Sade görünüm" ikonu değişti: `ImageOff` → `Focus` / `Wallpaper`.** Eskisi üstü çizili bir
  görsel simgesiydi, yani evrensel "bu resim yüklenemedi" işareti — çalışan bir arka planın
  yanına konulabilecek en yanlış şey, ekran görüntüsünde de bozuk görünmesinin sebebi buydu.
  Yeni ikonlar **ne alacağını** söylüyor: `Focus` odayı kaldırır, `Wallpaper` geri getirir.
  Buton 44px'e çıkarıldı (şeffaf daire — yalnız glif görünür, dokunma hedefi dürüst olur).

  İlgili: `room-backdrop.tsx`, `study-session-shell.tsx`.

- **Seans ekranı UI turu: tema çubuğu, dakika adımlayıcı, geçmiş rayı, özet paneli
  (2026-08-28)** —

  **Tema çubuğu gerçekten en üstte.** Önceki turda "kolonun ilk çocuğu" yapmıştım ama o kolon
  `justify-center` — dikey ortalanmış bir düzende ilk çocuk ekranın ortasıdır. Artık ortalanan
  bloğun **dışında**: idle'da içerik kolonunun üstünde, odak modunda overlay'in üst kenarına
  `absolute` ile sabit.

  **Butonları belirginleştirdik ama ağırlaştırmadık.** Bu bir sahne kontrolü, birincil aksiyon
  değil — bu ekranda bağıracak tek şey "Başla". Çıplak 24px oklar bir fotoğrafın üstünde
  dekorasyon gibi okunuyordu; eksik olan **okunabilirlik ve dokunma alanıydı, ağırlık değil.**
  Çözüm: `--room-scrim` hapı (okları tek ve açıkça tıklanabilir bir nesnede toplar) + oklar
  36px. Sade görünümde `--room-scrim` de app token'ına yeniden yönlendiriliyor.

  **Dakika +/− butonları kalıyor.** Halka bir sürükleme hedefi; bunlar aynı sayıya giden hassas
  ve **sürüklemesiz** tek yol. Kaldırmak dakikayı yalnız-sürükleme yapardı ki bu herkes için
  kullanılabilir bir kontrol değil. **Ortalama sorunu ise gerçekti:** `−` (U+2212) ile `+`
  farklı dikey metriklerde oturuyor ve `text-xl`'in satır kutusunu miras alıyorlardı — metin
  butonu birini ortalayıp diğerini asla ortalayamaz. Lucide `Minus`/`Plus` ile değiştirildi:
  kendi viewBox'ında ortalı, uygulamanın geri kalanıyla aynı çizgi kalınlığı.
  (`packages/ui/circular-timer-ring.tsx` — tek tüketicisi seans halkası, API değişmedi.)

  **"Son seanslar" günlere bölündü.** Ray her satırda tarihi tekrarlıyordu; aynı öğleden sonra
  yarım kalmış dört adet 0 dakikalık seans, tek bir satırın dört kopyası gibi görünüyordu.
  Tarih **güne** ait, her denemeye değil: başlığa çıkarıldı, satır artık **saati** gösteriyor —
  denemeleri birbirinden ayıran şey o. Gruplama **yerel takvim gününe** göre (`toDateString`),
  UTC dilimine göre değil: 01:30'daki bir seans, oturup çalışan kişi için hâlâ dün gece.
  Başlıklar "Bugün / Dün / 28 Ağustos" (yıl yalnızca farklıysa). Satırlara hover yüzeyi
  eklendi — tarihler yukarı çıkınca satırların ayrı birer öğe olarak okunması için bir kenara
  ihtiyaç kalmıştı.

  **Odak/Mola/Tahmini bitiş paneli artık `Card`.** Chip washı (`--color-chip` %18) oda fotoğrafı
  arkasına gelince görünmez oluyordu; ayrıca burası bir sayı paneli, chip değil. Sağdaki "Yol
  arkadaşın" ve odak hedefi kartlarıyla aynı yüzey — kenarlık, radius ve tek gölge token'ı
  bileşenin kendisinden geliyor.

  İlgili: `study-session-shell.tsx`, `room-theme-switcher.tsx`, `session-history.tsx`,
  `session-history-row.tsx`, `packages/ui/src/components/circular-timer-ring.tsx`,
  `messages/{tr,en}.json` (`history_day_yesterday`).

- **Üç temanın da görselleri geldi — `/img/seans-theme/` (2026-08-28)** —
  Dokuz dosya (`room-{library,cafe,home}-{bg,table,seat}.webp`) eklendi ve yollar bağlandı.
  Üç dosyanın adı şemadan sapıyordu (`cafe-bg`, `cafe-seat`, `library-seat`), hizalandı —
  şema `study-room-theme.ts`'in üç haritasının tamamının dayandığı şey; yeni bir tema **üç
  dosya, sıfır kod** demek olsun diye.

  **Klasör bilinçli bir istisna.** `public/visuals/README.md` düz klasör istiyor ("no domain
  subfolders"), ama burası yalnızca **set olarak anlamlı** dokuz dosya: bir tema zemin VE masa
  VE sandalyedir, dördüncü tema üç dosya daha getirir. README'ye not düşüldü. Eski v1
  kütüphane kopyaları `/visuals/` altından silindi — aynı asset'in iki yolda durması tam olarak
  sürüklenmeye davetiye.

  **Ölçümle doğrulandı (`git`e değil, dosyalara bakarak):**
  - Altı masa/sandalye dosyası da **1254×1254 kare** ve alfa sınır kutusu kareyi dolduruyor
    (%99–100 genişlik). Kütüphane masasının haftalarca "oyuncak gibi" görünmesine yol açan
    şeffaf kenar boşluğu **gitti** — `object-contain` artık kutunun tamamını kullanıyor.
  - Kütüphane masası %68 yükseklikte dolu; bu doğru, oval doğal olarak enden kısa.
  - Zeminlerin merkez parlaklığı: kafe 31/255, kütüphane 94/255, ev 124/255.

  **Token doğrulaması — üçü de tutuyor, değişiklik gerekmedi.** Kafe ve kütüphane koyu zemin +
  açık mürekkep; ev açık zemin + koyu mürekkep ve görseli de açık-orta çıkmış. (Ev için prompt
  "loş akşam lambası" istemişti, gelen görsel daha aydınlık — ama HOME token seti zaten açık
  zemin varsaydığı için tutarlı.) Bu eşleşme bir kez kaçtığında koltuk etiketleri okunmaz
  oluyor; kütüphanede tam olarak bu yaşanmıştı.

  İlgili: `study-room-theme.ts`, `public/img/seans-theme/*`, `public/visuals/README.md`.

- **Tema geçişi artık kayarak — çapraz solma değil (2026-08-28)** —
  Çapraz solma "bu resim değiştirildi" der; kayma "sonraki odaya döndün" der ve okların
  gerçekte söylediği şey bu. Zaten oluşturma modalindeki tema karuseli böyle davranıyordu, üç
  yüzey artık aynı dili konuşuyor.

  **Yön kontrolden gelir, liste sırasından değil.** `RoomThemeSwitcher` artık `onChange(next,
  direction)` veriyor; "ileri" HOME'dan LIBRARY'ye sararken de aynı yöne seyahat ediyor —
  indeks farkına baksaydık sarma anında yön ters dönerdi.

  Tek bileşen (`room-backdrop-slide.tsx`) üç yerde: oda sayfası, seans idle ekranı ve odak modu
  (tema çubuğu orada da var). `initial={false}` — odaya varmak zemini hiçbir yerden kaydırmaz,
  ilk tema sadece bulunduğun yerdir; yalnızca **değişim** seyahat eder.
  `prefers-reduced-motion` çapraz solmaya düşüyor: değişim görünür kalmalı, sadece yol
  almamalı.

  Seans idle ekranındaki sarmalayıcıya `overflow-hidden` eklendi — çıkan oda kenarın dışına
  kayıyor ve kırpma olmadan animasyon boyunca sayfaya yatay kaydırma çubuğu düşürüyordu.

  **Kapsam dışı bırakılan:** masa ve sandalye görselleri hâlâ anında değişiyor, yalnızca zemin
  kayıyor. Sahnenin tamamını kaydırmak koltuk yerleşimini de taşımak demek; siluetler temalar
  arası neredeyse aynı olduğu için takas göze çarpmıyor. Rahatsız ederse ayrı iş.

  İlgili: `room-backdrop-slide.tsx` (yeni), `room-theme-switcher.tsx`, `room-shell.tsx`,
  `study-session-shell.tsx`, `session-focus-backdrop.tsx`.

- **Seans/oda UI turu 3: tek üst çubuk, sabit tema genişliği, geçmiş filtreleri, davet
  sayfası, ev temasının solukluğu (2026-08-28)** —

  **Bug (benim hatam): ev teması soluk görünüyordu, bilinçli değildi.** `RoomBackdrop`'un
  peçesi `--room-ground-to`'yu `veilPercent` oranında karıştırıyordu. O token aynı zamanda
  yedek zemin ve koltuk etiketlerinin halosu, dolayısıyla **açık bir odada açık olmak
  zorunda** — ve karanlık odayı atmosferik yapan aynı %58, açık odayı ağartıyordu. Peçe
  kütüphane (koyu) tek temayken ayarlanmıştı. Artık her temanın **kendi `--room-veil`
  rengi ve alfası** var; `veilPercent` bir karışım oranı değil, o alfanın çarpanı. Ev'inki
  diğerlerinin yarısı (0.5'e karşı 0.95): açık zemin + koyu mürekkepli bir oda okunabilirlik
  için soluklaştırılmak zorunda değil, etiket halosu o işi zaten yapıyor.

  **Ders seçici, tema ve ses tek üst çubukta.** Üçü de "nerede ve nasıl çalışıyorum"un
  cevabı; ayrı satırlardaydılar çünkü tema kontrolü sonradan geldi ve kendi satırını aldı.
  `TimerChrome` bileşeni tamamen kalktı — var oluş sebebi bu iki kontrolü ayrı tutmaktı.
  Daralınca **sarıyor, sıkışmıyor**: telefonda üç kontrol yan yana sığmaz ve ezilmiş bir
  seçici ikinci satırdan kötüdür.

  **Tema etiketi sabit genişlikte (`w-[6.5rem]`).** "Ev" 2, "Kütüphane" 9 karakter; otomatik
  genişlikte kontrolün tamamı imlecin altında yeniden boyutlanıyordu — basmak üzere olduğun
  ok yer değiştiriyordu.

  **Geçmiş filtreleri iki chip satırından iki `<select>`'e indi.** 288px'lik rayda chip'ler
  tek bir seans görünmeden önce dört satır yiyordu; filtre, filtrelenen şeyden büyüktü.
  Native `<select>` tek satır, platformun kendi seçicisini açıyor (klavye ve ekran okuyucu
  zaten doğru, telefonda düzgün bir sheet) ve ders sayısı arttıkça bedavaya büyüyor — chip
  satırının kötüleştiği yer tam olarak orasıydı. `appearance-none` platform okunu da
  götürdüğü için ok geri çizildi (`pointer-events-none`).

  **"Daha fazla göster" sessizleşti.** Kenar çubuğunun dibindeki tam genişlikte dolu buton,
  sayfanın karşısındaki "Başla" ile aynı dikkati talep ediyordu; oysa yaptığı şey sekiz satır
  daha açmak. Artık chevron'lu, ortalanmış, sessiz bir devam kontrolü.

  **Davet sayfası: kopyala kodun üstünde, ikon olarak.** Altındaki tam genişlikte birincil
  buton kopyalamayı diyaloğun ana olayı gibi gösteriyor, **kodu** — birine sesli okuyacağın
  şeyi — onun alt yazısı durumuna düşürüyordu. Tek satır: kod ve onu alan ikon.
  **Yenile butonu kaldı ama rütbesi indi.** Bir grup sohbetine sızmış bağlantıyı iptal etmenin
  **tek yolu** o; kaldırmak bir butonu değil bir yeteneği silmek olurdu. Ama nadir ve hafif
  yıkıcı bir aksiyon, kopyalamayla aynı ağırlıkta durmasının anlamı yoktu. Artık etiketli bir
  metin butonu — çıplak bir yenile glifi "herkesin eski bağlantısı çalışmayı bırakacak"
  demiyor.

  İlgili: `packages/ui/src/theme.css` (`--room-veil`), `room-backdrop.tsx`,
  `room-theme-switcher.tsx`, `study-session-shell.tsx`, `session-history.tsx`,
  `room-shell.tsx`.
