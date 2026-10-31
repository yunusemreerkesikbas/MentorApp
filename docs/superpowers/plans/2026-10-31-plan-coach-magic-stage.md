# Koçla planla · "Şehrin üstünde" bekleme sahnesi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coloured-block waiting scene with Puhu's magic video over the landing's night city, the coach's evidence dropping in as taped paper notes.

**Architecture:** The stage keeps its wiring (`plan-coach-adaptation-action.tsx`, `<dialog>`, `OnboardingStepLayout`, `caption`). The board goes; a pure helper decides which note shows and how deep the pile is; two presentational pieces draw the sky (gradient, city, video) and the notes. A scoped CSS file owns the night palette, as the landing's `city-stage.css` does.

**Tech Stack:** Next.js 16 / React 19, Tailwind v4, next-intl, lucide-react 1.21.0, `@fontsource-variable/caveat`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-plan-coach-magic-stage-design.md` (the "Güncelleme" section at the top wins over the older text below it).

## Global Constraints
- Every line on screen is the backend's evidence `summary` or `groundingLine`; no invented counts or progress.
- Sky `linear-gradient(to bottom, #08113A 0%, #09133D 52%, #132552 74%, #1B3563 100%)`; video ground is `#08113A`–`#0C123E`.
- Paper `#FFFDF6`, ink `#0F2233`, label blue `#1A5FA3`, tape `#FFE08A`, slow line `#FFD15C`, on-night text `#FFFFFF` / soft `#C9D6EA`.
- One clock: `lineMs 3600`; `slowAfterMs 12000`; `arrivalMs 1200`. At most 6 notes (`PLAN_EVIDENCE_MAX` on the API is 6 too).
- The Puhu video never overlaps the city skyline at 375×667, 390×844 and 1280×800.
- Copy voice: `docs/copy/voice.md` (sen, no em dash, no "lütfen").
- The scene never follows `html.dark`.
- No commit: the user commits.

## Review Focus
- A brief with 0 evidence but a `groundingLine` → no notes, the line still shows (Task 1 test `stageNotes` + Task 4 mood e2e covers null).
- An evidence `type` the client does not know → `Sparkles` glyph and the `OTHER` label, no crash (Task 2 step).
- Reduced motion → no `<video>`, poster shown, notes still change without the drop (Task 5 e2e).
- Video fails to load → poster stays (Task 2: `onError` swaps to the poster `<img>`).
- Short phone (375×667) → video stays above the skyline (Task 6 screenshot check).

---

### Task 1: Video asset + poster

**Files:**
- Create: `apps/web/public/mascot/puhu/motion/puhu-magic-loop.mp4`, `apps/web/public/mascot/puhu/motion/puhu-magic.webp`

- [ ] **Step 1:** Crop the Kling export (`C:\Users\emreerkesikbas\Downloads\kling_20261031_VIDEO_Bouncy__sn_5354_0.mp4`, 940×940) with WinRT `MediaTranscoder` + `VideoTransformEffectDefinition` from Windows PowerShell 5.1: `CropRectangle` x=30 y=0 w=880 h=880, `OutputSize` 720×720, H.264, bitrate 3 500 000. Write to the `.mp4` path above.
- [ ] **Step 2:** Extract frame 0 with OpenCV (read only), crop the same rectangle, resize to 720×720, write `puhu-magic.webp` (quality 88).
- [ ] **Step 3: Verify** with OpenCV: output 720×720, ~5 s, bottom-right 160×60 region has no bright text pixels (max luminance in that region < 120); sample the corner colour and note it (the sky gradient's first stop must match it within ±3 per channel; adjust the stop if not).

### Task 2: Scene helper + notes + sky

**Files:**
- Modify (rewrite): `apps/web/src/app/[locale]/(app)/plan/_components/plan-coach-stage-scene.ts`
- Modify (rewrite): `apps/web/src/app/[locale]/(app)/plan/_components/plan-coach-stage-scene.spec.ts`
- Create: `.../plan/_components/plan-coach-stage-notes.tsx`, `.../plan/_components/plan-coach-stage-sky.tsx`, `.../plan/_components/plan-coach-stage.css`
- Delete: `.../plan/_components/plan-coach-stage-board.tsx`

**Interfaces:**
- Produces (scene.ts):
  - `STAGE_TIMING = { lineMs: 3600, slowAfterMs: 12000, arrivalMs: 1200 } as const`
  - `STAGE_MAX_NOTES = 6`
  - `stageNotes(brief: CoachPlanAdaptationBriefDto | null): CoachUsedEvidenceDto[]` — first 6 evidence items, `[]` for null
  - `stageNoteIndex(elapsedMs: number, count: number): number` — `Math.floor(elapsedMs / lineMs) % count`, 0 when count is 0
  - `stagePileDepth(elapsedMs: number): 0 | 1 | 2` — sheets under the top note, `min(2, floor(elapsed / lineMs))`
- Produces (components):
  - `PlanCoachStageSky({ reduceMotion }: { reduceMotion: boolean })` → the city layers (absolute, bottom) only; the gradient is on the dialog via CSS.
  - `PlanCoachStageVideo({ reduceMotion }: { reduceMotion: boolean })` (same file) → masked `<video autoPlay muted loop playsInline aria-hidden poster>`; reduced motion or `onError` renders the poster `<img alt="">`.
  - `PlanCoachStageNotes({ notes, index, depth, arrived }: { notes: CoachUsedEvidenceDto[]; index: number; depth: 0|1|2; arrived: boolean })` → `null` when `notes` is empty; otherwise `aria-hidden` pile with the top note marked `data-stage-note` and keyed by `index` (so the drop animation replays).

- [ ] **Step 1: Write the failing tests** in `plan-coach-stage-scene.spec.ts`:
  - `stageNotes(null)` → `[]`; a brief with 8 evidence → length 6, same order.
  - `stageNoteIndex(0, 2)` → 0; `(3600, 2)` → 1; `(7200, 2)` → 0; `(9999, 0)` → 0.
  - `stagePileDepth(0)` → 0; `(3600)` → 1; `(50_000)` → 2.
- [ ] **Step 2: Run** `pnpm --filter @mentor/web exec vitest run plan-coach-stage-scene` → FAIL (exports missing).
- [ ] **Step 3: Implement** the helper (drop `buildStageScene`, `stageBeat`, `stageGaze`, `STAGE_MAX_ROWS`, `beatMs`).
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Notes component.** Glyph map `Record<string, LucideIcon>` from the spec table (`ClipboardList, Target, BookOpen, Activity, ChartColumn, ListChecks, Flame, BatteryMedium, Compass, CalendarRange, CalendarCheck, Timer, Sparkles`), unknown → `Sparkles`. Label `t.has(\`coach_adaptation_evidence.${type}\`) ? t(...) : t("coach_adaptation_evidence.OTHER")`. Label in `font-family: "Caveat Variable"` 26px 700 `#1A5FA3`, sentence Nunito 16/23 700 ink; paper radius `4px 4px 7px 7px`, shadow as the landing note (`0 2px 4px rgba(3,10,24,.18), 0 28px 46px -20px rgba(3,10,24,.72)`), tape strip 78×22 rotated −3°. Under-sheets `#F9F5EA` rotate −3°, `#F4EFE2` rotate 3.2°. Fixed height (`h-[168px]` mobile, `lg:h-[150px]`, `lg:max-w-[460px]`) so the layout never moves. Import `@fontsource-variable/caveat/wght.css`.
- [ ] **Step 6: Sky component.** City layers via `SceneImg` (`@/app/[locale]/_components/landing/scene-img`) from `/visuals/landing/city-{far,mid,front}.webp`. Below `lg`: height `min(400px, 42dvh)`, width auto, centred (`left-1/2 -translate-x-1/2`, `max-w-none`), offsets 0 / −26px (mid shifted `-46%`) / −40px. From `lg`: `w-full h-auto`, bottoms `-18vw / -19.5vw / -21vw`. A bottom shade `linear-gradient(to bottom, rgba(5,12,30,0), rgba(5,12,30,.78))`, 120px. Video size `clamp(200px, 34dvh, 320px)`, `lg:` 350px.
- [ ] **Step 7: CSS** (`plan-coach-stage.css`, imported by the stage): `.plan-coach-night` sets the sky gradient as `background`, and remaps `--color-bg: transparent; --blob-pink: transparent; --blob-blue: transparent; --color-main: #FFFFFF; --color-secondary: #C9D6EA; --play-track: rgba(255,255,255,.14); --play-line: rgba(255,255,255,.28); --color-focus-ring: #FFD15C`. `.pcs-video` radial mask `circle at 50% 48%, #000 50%, transparent 69%`. `@keyframes pcs-note-drop` (from `translateY(-150px) rotate(-10deg) scale(.9)` opacity 0 → land with a 8px overshoot at ~0.47 s → settle `rotate(-1.5deg)` by ~0.86 s), 0.9 s `cubic-bezier(.3,.7,.3,1)`, plays once per mount. `.pcs-leave` (arrival): `translateY(40px)` + fade over 1200 ms. `@media (prefers-reduced-motion: reduce)`: no drop, no leave travel.

### Task 3: Stage rewrite + copy

**Files:**
- Modify: `.../plan/_components/plan-coach-adaptation-stage.tsx`
- Modify: `apps/web/messages/tr.json`, `apps/web/messages/en.json` (`plan` namespace)
- Modify: `apps/web/src/components/onboarding-play/play-heading.tsx` (drop the now-unused `idleFrame` prop)

**Interfaces:** Consumes everything Task 2 produces. Props of `PlanCoachAdaptationStage` do not change.

- [ ] **Step 1: Copy.** tr: `coach_adaptation_stage_ready` "Haftan hazır.", `coach_adaptation_stage_ready_lighten` "Planın hazır.", `coach_adaptation_evidence` object with the spec table's tr labels plus `OTHER` "Koçun notu". en: "Your week is ready.", "Your plan is ready.", the table's en labels, `OTHER` "Coach note".
- [ ] **Step 2: Stage.** `<dialog className="plan-coach-night …">`; `<PlanCoachStageSky>` as the dialog's first child (`absolute inset-0 pointer-events-none`), the layout after it (`relative`). Heading: `<h2>` title (28px / `lg:` 32px, 900; becomes the ready copy when `arrived`) and the sub line (`groundingLine` → `coach_adaptation_stage_sub` when pending > 0 → none; from 12 s `coach_adaptation_stage_slow` in `#FFD15C`), sub keeps `aria-live="polite"`. Body: video, notes, caption. Below the notes an `sr-only` `<ul>` lists every note once (`label: summary`). Tick every `lineMs` until `arrived`; reduced motion keeps ticking (lines change, no travel). Arrival: notes get `.pcs-leave`, `onDone` after `arrivalMs` (immediately with reduced motion). Remove `PuhuBubble`, `PUHU_MOTION_FRAMES`, `GAZE_FRAME`, `planWindowToday` usage.
- [ ] **Step 3: Run** `pnpm --filter @mentor/web exec tsc --noEmit -p .` and eslint on the changed files (pass file paths, not a `[locale]` glob) → clean.

### Task 4: e2e

**Files:**
- Modify: `apps/web/e2e/plan.spec.ts`

- [ ] **Step 1:** Rewrite the wizard-board test (~line 255): after `Önizlemeyi hazırla`, the stage contains `"5 gün · günde 60 dk · 4 ders"`; `stage.locator("[data-stage-note]")` contains `weakLine`, then (poll) `rhythmLine`; `stage.locator("video")` count 1; `stage.getByRole("list")` has 2 items.
- [ ] **Step 2:** Rewrite the reduced-motion test (~line 285): `video` count 0, `img[src*="puhu-magic"]` visible, the note still moves from `weakLine` to `rhythmLine`.
- [ ] **Step 3:** Mood test (~line 475): replace the block-count assertion with `[data-stage-note]` count 0; keep `"bu hafta 1 bekleyen görev"`.
- [ ] **Step 4:** `pnpm --filter @mentor/web build`, then `pnpm --filter @mentor/web exec playwright test e2e/plan.spec.ts` → all green.

### Task 5: Docs

**Files:** `DESIGN.md` (§2 "Does not follow theme" + §9.1 "the loop decision"), `docs/features/coaching.md` (timeline entry, mandatory).

- [ ] **Step 1:** §2: add `.plan-coach-night` (Koçla planla bekleme sahnesi: always night, landing city art, paper notes). §9.1: rename to "Şehrin üstünde"; beats table = Note (3.6 s, drop 0.9 s) · Long wait (12 s, slow line) · Arrival (1200 ms, ready title, pile leaves) · reduced motion (poster, no travel).
- [ ] **Step 2:** coaching.md entry: what changed, assets and their crop numbers, the "video must stay above the skyline" gotcha, files.

### Task 6: Visual check

- [ ] **Step 1:** In the e2e run, screenshot the stage at 375×667, 390×844 and 1280×800; confirm the video's disc sits fully above the city and the note never covers the title. Fix sizes in Task 2's sky rules if not.
