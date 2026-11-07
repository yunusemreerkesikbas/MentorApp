# Coaching (`modules/coaching` · W2)

> Core student study ritual: Onboarding, Daily Panel (`/panel`), Weekly Plan & `Puhu’yla planla`
> (`/plan`), Focus Sessions (`/seans`), Study Notebooks (`/defter`), Mock Exam Analysis (`/analiz`),
> Weekly Recap (`Wrapped`), and Vision Board (`/hedef`).

---

## 1. Overview & Architecture

`CoachingModule` owns the student's personal study loop and behavioral records. All tables enforce
`FORCE ROW LEVEL SECURITY` (`withUserContext`) and explicit `userId` repository predicates.

- **Boundary discipline:**
  - Imports `[ContentModule, IdentityModule]` for verified exam taxonomy/calendar and user profile context.
  - Exports public aggregate services (`CoachEvidenceService`, `StreakService`, `PlanService`, `StudentCoachingSummaryService`) consumed by `AIModule`, `PaymentsModule`/`PromotionsModule`, `EconomyModule`, `CommunityModule`, and `MentorshipModule`.
  - **Never calls the LLM directly:** AI narrations, greetings, and `Puhu’yla planla` previews live in [`AIModule`](./ai.md); Coaching owns the deterministic rule engine, net/streak math, and atomic state mutations.
- **Timezone rule:** Daily plans, past-date edit locks, mood check-in windows, and weekly review boundaries use **`Europe/Istanbul`** calendar dates (`YYYY-MM-DD`, Monday week start).

---

## 2. Core Subsystems & Current Rules

### 2.1 Daily Ritual & Mood (`/panel`, `GET /v1/coaching/today`)
- **Single-request dashboard payload:** Returns today's tasks, streak status, `focusGoal { goalMinutes, focusMinutesToday }`, anonymous `focusingNow` count (hidden below `coaching.public_pulse.min_people`), `weeklyRecapPeriod` (resolved independently of whether the exam date has passed), and `canLightenPlan` (true when today has `>=1` pending non-`MENTORSHIP` task).
- **Mood Check-in (`POST /v1/coaching/mood-checkins`):** 5 states (`GREAT`, `GOOD`, `OKAY`, `LOW`, `EXHAUSTED`) + optional struggle note. Rule engine returns an immediate Companion-register acknowledgement; Premium/unlocked students also receive an adaptive Puhu reflection (`POST /v1/coach/mood-reflection`) and, on `LOW`/`EXHAUSTED` with `canLightenPlan`, a one-tap `"Puhu’yla planı hafiflet"` action.
- **Public Pulse (`GET /v1/coaching/public/pulse`):** Anonymous, throttled count of distinct people who studied in the last 24h (`null` below threshold), powering the landing page's live companionship line.

### 2.2 Weekly Plan & `Puhu’yla planla` (`/plan`, `/v1/plan-tasks/*`)
- **Task lifecycle:** `PENDING` ↔ `DONE`. Tasks carry `taskDate` (`YYYY-MM-DD`), `title`, optional taxonomy-verified `subject`/`topic`, optional `durationMinutes` (`5–200`), and `origin` (`null` | `AI_ADAPTATION` | `MENTORSHIP` | `COMMUNITY_COACH` | `ANALYSIS` | `WEEKLY_RECAP`).
- **Human Coach Tasks (`origin: 'MENTORSHIP'`):** Carry `assignedByCoach: true` and `coachNote`. Protected from AI plan-adaptation moves/deletes; student deletions are recorded in `mentorship_dropped_assignments` so the human coach sees transparent feedback.
- **`Puhu’yla planla` (Adaptive Planning):**
  - Wizard seeded by `GET /v1/coach/plan-adaptation/brief` (or Coin-funded `/v1/coach/plan-previews/brief`), showing verified 28-day study evidence and suggested weekdays/minutes/subjects.
  - While the model builds the 7-day `MOVE`/`ADD` preview, the UI renders the **"Şehrin üstünde" (`.plan-coach-night`) waiting stage**: masked Puhu flying over the night city (`puhu-magic-loop.mp4`) as verified evidence items drop onto rooftops as taped Caveat paper notes.
  - Applying selected changes (`POST /v1/plan-tasks/adapt`) is **atomic** under an opaque `planRevision` optimistic-concurrency guard (`409 PLAN_REVISION_CONFLICT` if stale).

### 2.3 Focus Sessions (`/seans`, `/v1/study-sessions/*`)
- **Timer modes:** Pomodoro presets (`25/5`, `50/10`), custom duration (`5–200` min), and open-ended `stopwatch` (`focusMinutes: null`, records actual elapsed seconds on completion up to 24h ceiling).
- **Stage & Rooms ("Işıklar kısılır"):** Full-bleed `.room-stage` with top-down illustrated rooms (`LIBRARY`, `CAFE`, `HOME`), ambient audio tracks (`session_ambient`), optional shared study table (`MASA-` code from `CommunityModule`), and "Sade görünüm" distraction-free toggle.
- **Completion & Polaroid Share Card:** Finishing a qualifying session credits `daily_activity` + streak, opens the session reflection check-in (with masked Puhu for Premium AI reflection), and offers a downloadable **Polaroid share card**.

### 2.4 Study Notebooks (`/defter`, `/v1/coaching/notebooks/*`)
- **Two notebook kinds:**
  1. **System Mistake Notebook (`MISTAKE`):** Automatically provisioned per user for question photos, error types (`KNOWLEDGE_GAP`, `CARELESS`, `TIME_PRESSURE`, `MISREAD`), and spaced-repetition review.
  2. **Custom Notebooks (`CUSTOM`):** Free-form lined/grid/dotted/blank notebooks with ink strokes, stickers, and photo cards, optionally bound to an exam subject. Free tier includes a base slot count; permanent extra slots can be unlocked with Coin (`POST /v1/economy/notebook-slots`) or unlimited with Premium.
- **Desk ("Masa"), Table of Contents ("İçindekiler"), and Review Fan ("Yelpaze"):**
  - `/defter` displays notebooks as tactile bound covers on a wooden shelf.
  - Opening a notebook shows `GET /v1/coaching/notebooks/:id/contents` (one row per non-empty page with student-authored title, topic, entry/due/sticker/ink counts — 2 DB queries total regardless of size).
  - Mistake entries follow a **2 / 7 / 21-day spaced review ladder** (`POST /v1/coaching/notebook/entries/:id/review` with idempotent `reviewId` UUID) and fan out as interactive flashcards (`Yelpaze`).

### 2.5 Mock Exams, Net Engine & Deep Analysis (`/analiz`, `/v1/mock-exams/*`)
- **Server-only Net Calculation:** `correct - wrong / penaltyRatio` per exam family rule (`@mentor/core`), stored immutably with per-subject breakdowns and topic-level wrong maps.
- **Ghost ("Geçmiş-Ben") Comparison:** Compares the latest mock exam against the student's own historical baseline — **never** against other students.
- **Analysis → Plan Loop (`POST /v1/coaching/analysis/plan-task`):** Creates or reuses an `ANALYSIS`-origin study task pinned to the highest-impact focus subject, guarded against stale baselines (`409 ANALYSIS_FOCUS_CHANGED`).

### 2.6 Weekly Recap (`Wrapped` & Deep Analysis, `/v1/coaching/weekly-recaps/*`)
- **Status thresholds:** `EMPTY` → `PARTIAL` (returns `nextStorySignals[]` guiding how to unlock) → `READY`.
- **Owned Immutable Reports:** Acquired via Premium, earned quest right, or Coin (`POST /v1/coaching/weekly-recaps` with `Idempotency-Key`). Freezes the week's rhythm (`longestSessionMinutes`, `focusTimeBand`, `peakFocusDay`, `subjectBreakdown`, `highlights[]`), assigns an energetic **Puhu weekly nickname** (`weeklyTitle`), generates Puhu's narrative story, and includes `deepAnalysis` (completed-week deltas + taxonomy subject averages) and a one-click follow-up plan task (`POST /v1/coach/weekly-recaps/:id/plan-task`).

### 2.7 Vision Board (`/hedef`, `/v1/coaching/vision/*`)
- Stores the student's target university/department/score goal (`POST /v1/coaching/vision`) and a separate tactile collage board (`PUT /v1/coaching/vision/board` with presigned R2 photos, taped notes, and `HungBoard` physics). Updating the collage never invalidates the cached Premium Puhu vision note.

---

## 3. API Surface

| Method & Path | Purpose |
|---|---|
| `GET /v1/coaching/today` | Daily dashboard state, tasks, streak, focus goal, `weeklyRecapPeriod`, `canLightenPlan` |
| `GET /v1/coaching/public/pulse` | Public anonymous 24h active study count |
| `GET\|POST /v1/plan-tasks`, `PATCH\|DELETE /v1/plan-tasks/:id` | CRUD for daily/weekly plan tasks (`?date=` or `?from=&to=`) |
| `GET /v1/plan-tasks/calendar` | Distinct task dates in a range (calendar dots) |
| `POST /v1/plan-tasks/adapt` | Atomic application of `Puhu’yla planla` `MOVE`/`ADD` changes under `planRevision` |
| `POST\|GET /v1/study-sessions`, `PATCH /v1/study-sessions/:id` | Start, heartbeat, pause, complete, or abandon focus sessions |
| `GET\|POST /v1/mock-exams`, `PUT\|DELETE /v1/mock-exams/:id` | Log, recompute, or delete mock exam results |
| `GET /v1/coaching/analysis`, `POST /v1/coaching/analysis/plan-task` | Subject trends, Ghost comparison, mistake signals, and 1-click focus task |
| `GET\|POST /v1/coaching/notebooks`, `GET\|PATCH\|DELETE .../:id` | List/create/manage `MISTAKE` and `CUSTOM` notebooks |
| `GET /v1/coaching/notebooks/:id/contents`, `GET\|PUT .../:id/pages/:index` | Notebook table of contents and per-page ink/notes/stickers |
| `GET\|POST /v1/coaching/notebook/entries/*`, `.../review-summary`, `.../review-history` | Mistake card CRUD, 2/7/21d spaced review, and progress stats |
| `GET /v1/coaching/weekly-review` | Live completed-week rule summary & `Wrapped` highlights |
| `GET /v1/coach/weekly-recaps/access`, `GET\|POST /v1/coach/weekly-recaps/*` | Owned immutable Weekly Recap & Deep Analysis archive + follow-up task |
| `GET\|POST /v1/coaching/vision`, `PUT /v1/coaching/vision/board` | Target goal & Vision Board collage |

---

## 4. Gotchas & Invariants

1. **Never mutate `plan_tasks` outside `PlanService`:** AI, Mentorship, Analysis, and Weekly Recap all create tasks through `PlanService` seams so revision counters, Istanbul date validation, and `origin` provenance stay consistent.
2. **Collage vs. Goal separation:** `PUT /v1/coaching/vision/board` replaces only the visual collage JSON and must not touch the goal columns or bust the cached `vision-note` AI prompt.
3. **Expired exam calendar fail-safe:** When an official `examDate` passes, `countdown` becomes `null` (never negative), while `weeklyRecapPeriod` continues resolving the user's exam family so weekly reviews and study sessions keep working.
4. **Notebook upload capabilities:** Never pass raw R2 URLs from the client; every notebook or vision-board image goes through a single-use `/v1/storage/uploads/:ticket` capability.

---

## 5. Geliştirmeler (Condensed Milestone Timeline)

- **2026-11-07. Plan calendar regression fixtures.** Plan and mentorship tests now use Istanbul calendar dates or the API's default date. Browser duration and calendar cases pin the clock at 00:30 Istanbul while UTC is still on the previous day. The economy integration case restores its feature flag after failures and aligns its test clock for UTC quest progress. Run the affected API suites with a dedicated `TEST_DATABASE_URL` and `pnpm --filter @mentor/web test:e2e plan.spec.ts` for browser coverage. Related files include `apps/api/test/{coaching,mentorship,economy-quests,account-erasure,core-trial-social-boundary}.e2e-spec.ts`, `plan-mentorship.service.spec.ts`, and `apps/web/e2e/plan.spec.ts`.
- **2026-11-04 — Weekly Deep Analysis & Recommendation Follow-Up (`APP-135`):** Extended owned `weekly-recaps` snapshots with `deepAnalysis` (week-over-week study deltas, taxonomy subject averages, sample counts) and added `GET .../follow-up` + `POST .../plan-task` so students can turn a recap recommendation into a tracked plan task and see next week's outcome. Named AI coach **Puhu** (`Puhu’yla planla`) across all coaching surfaces and updatedweekly nicknames (`weekly-nickname.ts`) and achievements to the energetic Puhu register.
- **2026-11-03 — `canLightenPlan` & Istanbul Midnight Alignment:** Server-computed `today.canLightenPlan` gates the low-mood plan-lightening CTA; aligned plan defaults, past-date locks, mood, and adaptation on `Europe/Istanbul` midnight.
- **2026-11-01 — Owned Weekly Recap (`Wrapped`) Archive & Coin Access:** Added immutable `weekly_recap_reports` ownership (`GET/POST /v1/coach/weekly-recaps`), separating durable report ownership from rolling AI generation quotas.
- **2026-10-31 — `Puhu’yla planla` Night Waiting Stage ("Şehrin üstünde"):** Replaced the block loader with `.plan-coach-night` (`puhu-magic-loop.mp4` over the 3-layer night skyline + falling Caveat evidence notes).
- **2026-10-03 — Notebook Table of Contents ("İçindekiler") & Stopwatch Sessions:** Added `GET /v1/coaching/notebooks/:id/contents` (2-query summary of non-empty pages), task `durationMinutes` (`5–200`), and `preset: 'stopwatch'` open-ended study sessions.
- **2026-09-23..30 — Adaptive Planning Wizard & Brief:** Added `GET /v1/coach/plan-adaptation/brief` with 28-day weekday habits, custom `studyWeekdays`, and `source: 'PLAN'` capacity rules.
- **2026-09-08 — Notebook Review Progress & Analysis → Plan Loop:** Added `/v1/coaching/notebook/review-summary` & `review-history`, idempotent `reviewId` on card reviews, and `POST /v1/coaching/analysis/plan-task`.
- **2026-08-25..28 — Multi-Notebook Shelf ("Masa"), Review Fan ("Yelpaze") & Study Room Stage:** Shipped `CUSTOM` + `MISTAKE` notebook collection, spiral page editor (ink/stickers/notes), and top-down illustrated `/seans` room themes (`LIBRARY`/`CAFE`/`HOME`) with Polaroid share card.
- **2026-07-26..29 — Mentor Wrapped V1–V1.3:** Shipped weekly story deck (`recap`, `rhythm`, `highlights[]`, `focusTimeBand`, `peakFocusDay`, `nextStorySignals[]`).
- **2026-07-15..22 — W2 MVP Foundation (`0009–0042`):** Shipped onboarding, `/panel` daily loop, `/plan` calendar, `/seans` Pomodoro timer, `/analiz` net calculator + Ghost comparison, `/hedef` Vision Board, and `/defter` 2/7/21d mistake ladder.
