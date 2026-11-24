# Mobile Weekly Recap Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mobile panel shows the coral weekly recap card for a READY last week. It opens an
access card (gift / member / owned / Coin / retry / notice) and then the web's eight-slide READY
story, natively.

**Architecture:**
- The recap's pure logic moves from `apps/web/src/lib/weekly-recap.ts` (and the access view and
  share-card rows) to `@mentor/core`. Slides name their media by key; the web lib becomes an adapter
  that maps keys to public URLs, so no web component changes.
- Mobile adds one full-screen route, a `components/recap/` folder and bundled media in `art.ts`.
- **Commits:** none. The owner commits when they ask.

**Tech Stack:** TypeScript, `@mentor/core` (node:test), Next.js web (Vitest), Expo SDK 58 / RN 0.88 /
Expo Router / Reanimated 4 / expo-video / expo-image / expo-secure-store.

**Spec:** `docs/plans/2026-11-13-mobile-weekly-recap-design.md`

## Global Constraints

- **Card:** the panel card shows only when `weeklyRecapPeriod?.status === "READY"`. No PARTIAL deck
  on mobile.
- **Access view:** call it with `purchases = false`. No Premium purchase or upsell, no music or sound
  toggle, no analytics.
- **Copy:** access card copy is ported from web `analysis.recap.*` as-is (owner). The mobile
  formatter does `{name}` only. ICU plurals become plain strings, and EN stays count-neutral.
- **Voice checks:** `i18n.spec.ts` enforces TR/EN key parity and the voice.md bans: no em-dash, no
  "lütfen", no "AI" in TR strings. Any ported web string that breaks them is rewritten in the same
  voice.
- **Media:** 7 character mp4s and `puhu-fire.mp4` are bundled. Character PNG stills are the posters
  and the fallbacks. The 9 decor PNGs come from `visuals/weekly-recap-2023/`.
- **Colours:** coral `#ff5b49`, lavender `#afb1ff`, mint `#16d0a6`, sky `#e3ecef`, ink `#000000`.
  They are scene colours, not theme tokens.
- **Timing:**
  - Durations: welcome 10 000 ms, weekly_title 8 000 ms, every other slide 7 000 ms.
  - Text beat: support begins at 45 % of the slide.
  - Week map: active days show at 2 200 ms.
  - Hold: 300 ms. Swipe: 56 px.
  - Slide change: 420 ms opacity plus 24 px x; reduced motion fades in 120 ms.
- **Completion:** fires once when the final actions become visible.
- **Celebrations:** held while the route is open.
- **SecureStore key:** `mentor.weekly-recap.opened.v2.<startDate>`.
- **Files:** each new mobile file stays at ≤ ~300 lines. After editing core, run
  `pnpm --filter @mentor/core build`.

## Review Focus

1. **Video fails to load or decode.** The story keeps its timer. A character video falls back to its
   still, and the fire video falls back to Puhu proud. (Task 7: a forced error shows the still.)
2. **App sent to the background mid-story.** The timer pauses and does not jump slides on return.
   (Task 6: `pageVisible` from `AppState` gates advance.)
3. **Coin confirm tapped twice, or the network drops after the POST.** One request per confirm, and
   the offer is fetched again on error. The server keeps one report per week. (Task 5:
   `busy`-guarded confirm.)
4. **Reduced motion.** The story starts paused, and the final actions show at once on the final
   slide, so completion still fires. (Task 1: `weeklyRecapFinalActionsVisible` spec.)
5. **Android back on any state.** Access card goes back to the panel; the story goes back to the
   panel; no slide stepping. (Task 6: the `BackHandler` returns true and calls `onExit`.)

---

### Task 1: Recap logic in `@mentor/core`

**Files:**
- Create: `packages/core/src/weekly-recap.ts`
- Create: `packages/core/src/weekly-recap.spec.ts`
- Modify: `packages/core/src/index.ts` (export `./weekly-recap.js`)

**Interfaces — Produces:**
```ts
export type WeeklyRecapSlideKind = "welcome" | "week_map" | "focus" | "weekly_run" | "weekly_best"
  | "performance" | "spark" | "weekly_title" | "partial_unlocks" | "partial_final" | "final";
export type WeeklyRecapCharacterKey = "cosmicMaestro" | "dimensionExplorer" | "nebulaDiver"
  | "novaTraveler" | "phoenixPilot" | "routeArchitect" | "timeBender";
export type WeeklyRecapAudioKey = "characterReveal" | "digitalClouds" | "discover"
  | "funkeeMonkeee" | "gimmeThatGroove" | "popTrack03";
export interface WeeklyRecapStorySlide {
  kind: WeeklyRecapSlideKind; durationMs: number;
  audio: { key: WeeklyRecapAudioKey; startSeconds: number };
  character: { key: WeeklyRecapCharacterKey; headlineAtMs: number; supportAtMs: number } | null;
}
export const WEEKLY_RECAP_CHARACTER_BY_TITLE: Record<WeeklyRecapTitleId, WeeklyRecapCharacterKey>;
export function composeWeeklyRecapStory(review: WeeklyReviewDto): WeeklyRecapStorySlide[];
// moved unchanged from web (playback generic over `readonly { durationMs: number }[]`):
export interface WeeklyRecapPlaybackState { index; elapsedMs; playing; completed }
createWeeklyRecapPlayback, advanceWeeklyRecapPlayback, navigateWeeklyRecapPlayback,
replayWeeklyRecap, shouldWeeklyRecapAdvance, shouldNavigateAfterWeeklyRecapPress,
getWeeklyRecapTextBeat, getWeeklyRecapWeekMapPhase, getFocusStoryMode, getPerformanceStoryMode,
getWeeklyBestStorySource, getWeeklyRecapFocusTimeMessage, getWeeklyRecapPeakDayStory
// + their exported types (WeeklyRecapTextBeat, WeeklyRecapFocusStoryMode, ...)
export function weeklyRecapFinalActionsVisible(
  slide: { kind: WeeklyRecapSlideKind; durationMs: number }, state: WeeklyRecapPlaybackState): boolean;
export interface WeeklyRecapShareCardFacts { /* web WeeklyRecapShareCardModel with
  characterKey: WeeklyRecapCharacterKey | null in place of characterImageSrc */ }
export function buildWeeklyRecapShareCardFacts(review: WeeklyReviewDto): WeeklyRecapShareCardFacts;
export type { WeeklyRecapShareCardRow, WeeklyRecapShareCardRowCopy }; // moved from web share-card
export function buildWeeklyRecapShareCardRows(model: { focusMinutes; activeDays;
  qualifyingSessionCount; completedTaskCount; longestSessionMinutes; longestActiveRun;
  topSubject }, copy: WeeklyRecapShareCardRowCopy): WeeklyRecapShareCardRow[];
export type RecapAccessView = /* moved unchanged from web weekly-recap-access-view.ts */;
export function recapAccessView(offer: WeeklyRecapOfferDto, purchases: boolean): RecapAccessView;
```

- [ ] **Step 1: Write the failing spec** `packages/core/src/weekly-recap.spec.ts` (node:test plus
  `node:assert/strict`, with a `review(overrides)` fixture builder like the web spec's):
  - `composes the eight READY slides with timing and the title's character`
    - kinds equal `["welcome","week_map","focus","weekly_run","weekly_best","performance","weekly_title","final"]`
    - durations equal `[10000,7000,7000,7000,7000,7000,8000,7000]`
    - with weeklyTitle `FOCUS_DIVER`, the `weekly_title` character equals
      `{ key: "nebulaDiver", headlineAtMs: 4000, supportAtMs: 6000 }`; every other slide's
      character is `null`
    - welcome audio equals `{ key: "popTrack03", startSeconds: 0 }`
  - `returns no slides for EMPTY`: the result is `[]`.
  - `keeps the PARTIAL ordering`: with sessions > 0 and longestActiveRun 3, the kinds are
    welcome, week_map, focus, weekly_run, spark, partial_unlocks, partial_final.
  - `shows the final actions at the support beat or whenever paused`, with a final slide of
    7000 ms:
    - `{playing:true, elapsedMs:3000}` → false
    - `{playing:true, elapsedMs:3200}` → true
    - `{playing:false, elapsedMs:0}` → true
    - for a `focus` slide, `{playing:false}` → false
  - `never leads with Premium when purchases are off`: an offer with mode COIN and reason
    `INSUFFICIENT_COIN` and `premiumAvailable: true` → `recapAccessView(offer, false)` equals
    `{ kind:"choice", lead:null, coin:"short", premium:false, missing: cost - coinConfirmed }`.
- [ ] **Step 2:** Run `pnpm --filter @mentor/core test`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `weekly-recap.ts`.
  - Move the bodies from the web lib and `weekly-recap-access-view.ts`. The character map and the
    audio cue table come from the web's `WEEKLY_RECAP_CHARACTER_VIDEO_BY_TITLE` and
    `WEEKLY_RECAP_SLIDE_AUDIO`, rewritten as keys.
  - `weeklyRecapFinalActionsVisible` returns
    `slide.kind === "final" && (!state.playing || getWeeklyRecapTextBeat(state.elapsedMs, slide.durationMs) === "support")`.
  - Export it from `index.ts`.
- [ ] **Step 4:** Run `pnpm --filter @mentor/core test && pnpm --filter @mentor/core build`.
  Expected: PASS, and the build emits `dist/weekly-recap.js`.

### Task 2: Web becomes an adapter (no component changes)

**Files:**
- Modify: `apps/web/src/lib/weekly-recap.ts`
- Modify: `apps/web/src/lib/weekly-recap-share-card.ts`
- Modify: `apps/web/src/app/[locale]/(app)/analysis/recap/_components/weekly-recap-access-view.ts`

**Interfaces:**
- **Consumes:** Task 1.
- **Produces:** every name the web exports today, with the same types. Web components and specs
  stay untouched.

- [ ] **Step 1:** Rewrite the web lib.
  - **What stays:** the URL tables (`WEEKLY_RECAP_FIGMA_ASSETS`, `_VIDEO_ASSETS`,
    `_CHARACTER_IMAGE_ASSETS`, `_AUDIO_ASSETS`), the web `WeeklyRecapSlide` and
    `WeeklyRecapCharacterVideo` types, the storage and teaser helpers, `buildWeeklyRecapTeaserHref`,
    `buildWeeklyRecapShareText`, `weeklyRecapExitHref`, and the `WeeklyRecapShareCardModel` type.
  - **What changes:** `composeWeeklyRecapSlides(review)` maps `composeWeeklyRecapStory(review)` to
    the web shape:
    - `audioSrc = WEEKLY_RECAP_AUDIO_ASSETS[audio.key]`
    - `characterVideo = { src: VIDEO[key], posterSrc: IMAGE[key], headlineAtMs, supportAtMs }`

    `buildWeeklyRecapShareCardModel` maps the facts, with `characterImageSrc` set from the key.
  - **What is re-exported from `@mentor/core`:** every pure function from Task 1.
  - The share-card file re-exports the rows builder and types from core. The access-view file
    re-exports `recapAccessView` and `RecapAccessView`.
- [ ] **Step 2:** Run
  `pnpm --filter @mentor/web test -- weekly-recap && pnpm --filter @mentor/web typecheck`.
  Expected: `weekly-recap.spec.ts` and `weekly-recap-access-view.spec.ts` all PASS unchanged, and
  0 type errors.

  `ponytail:` the web specs stay in web. They exercise the moved code through the re-exports, so
  moving 855 lines of Vitest buys nothing.

### Task 3: Mobile data, media and copy

**Files:**
- Modify: `apps/mobile/src/lib/coaching-api.ts:274` (replace `fetchWeeklyReview`; add the recap
  calls)
- Create: `apps/mobile/src/lib/request-id.ts`
- Modify: `apps/mobile/src/lib/analysis-api.ts` (use `newRequestId()`)
- Create: `apps/mobile/src/lib/recap-opened.ts`
- Modify: `apps/mobile/src/lib/art.ts` (add `recapArt`)
- Modify: `apps/mobile/src/i18n/tr.ts`, `apps/mobile/src/i18n/en.ts` (add a `recap` namespace;
  delete `dashboard.weekly_recap_title/summary`)
- Modify: `apps/mobile/src/providers/celebration-provider.tsx:192`

**Interfaces — Produces:**
```ts
// coaching-api.ts (http from @mentor/api-client, like the chest calls)
fetchWeeklyReview(examId: string): Promise<WeeklyReviewDto>           // GET /v1/coaching/weekly-review?examId=
completeWeeklyReview(examId: string, weekStart: string): Promise<WeeklyReviewCompletionDto> // PUT /v1/coaching/weekly-review/completion
fetchWeeklyRecapOffer(examId: string, weekStart?: string): Promise<WeeklyRecapOfferDto> // GET /v1/coach/weekly-recaps/access
openWeeklyRecap(input: { examId; weekStart; source: WeeklyRecapSource; expectedCost: number; clientRequestId: string }): Promise<WeeklyRecapReportDto> // POST /v1/coach/weekly-recaps, header Idempotency-Key = clientRequestId
fetchOwnedWeeklyRecap(id: string): Promise<WeeklyRecapReportDto>     // GET /v1/coach/weekly-recaps/:id
// request-id.ts
newRequestId(): string   // crypto.randomUUID() with the v4 fallback lifted from analysis-api.ts
// recap-opened.ts (SecureStore sync API)
isRecapOpened(startDate: string): boolean
markRecapOpened(startDate: string): void   // key `mentor.weekly-recap.opened.v2.${startDate}`; try/catch → no-op
// art.ts
recapArt: { characters: Record<WeeklyRecapCharacterKey, { video: number; still: number }>;
  fire: number; decor: Record<RecapDecorKey, number> }
export type RecapDecorKey = "floral" | "graphics" | "greenShape" | "greenWiggle" | "lavenderPixel"
  | "lavenderShape" | "redPixel" | "silverWiggle" | "worldMap";
```

- [ ] **Step 1:** Write the API functions, `request-id.ts`, `recap-opened.ts` and the `recapArt`
  imports (`../../../web/public/video/character/<kebab>.mp4`, `/img/character/<kebab>.png`,
  `/video/puhu-fire.mp4`, `/visuals/weekly-recap-2023/<kebab>.png`).
- [ ] **Step 2:** Port the copy into `recap`.
  - Source keys: web `analysis.recap` → `teaser.*`, `ownership.*`, `cover.period`, `welcome.*`,
    `week_map.*`, `focus.*`, `weekly_run.*`, `weekly_best.*`, `bests.*`, `performance.*`,
    `weekly_title.*`, `final.title`, `share_card.*` (row and label keys only), `controls.*` (play,
    pause, replay), `empty.*`, `error.*`, `exit`, `previous`, `next`, `progress`.
  - Flatten each key with `_` (for example `ownership_coin_title`).
  - Add `final_done: "Bitti"` / `"Done"` and `final_replay: "Tekrar izle"` / `"Watch again"`.
  - Add `empty_plan: "Plana git"` / `"Open plan"`.
- [ ] **Step 3:** In the celebration provider, change `hold` to
  `pathname.includes("study-session") || pathname.includes("weekly-recap")`.
- [ ] **Step 4:** Run
  `pnpm --filter @mentor/mobile test && pnpm --filter @mentor/mobile typecheck`.
  Expected: `i18n.spec.ts` passes (tr and en keys match) and there are 0 type errors.

### Task 4: Panel card

**Files:**
- Create: `apps/mobile/src/components/recap/recap-teaser-card.tsx`
- Modify: `apps/mobile/src/app/(app)/(tabs)/dashboard.tsx` (render after `CountdownCard`)

**Interfaces:**
- **Consumes:** `isRecapOpened`, `recapArt.decor`, and the copy keys `recap.teaser_*`.
- **Produces:** `RecapTeaserCard({ period, onPress }: { period: NonNullable<TodayPanelResponse["weeklyRecapPeriod"]>; onPress: () => void })`

- [ ] **Step 1:** Build the card as the web teaser at phone width:
  - coral `#ff5b49` background, min height 176
  - decor: greenShape (-40, -112, w 208, −10°), silverWiggle (right −56, top −112, w 176, 70°),
    redPixel (right 48, top 8, w 80, 12°)
  - black title 24/900 and message 14/600 at 75 %
  - title and message come from `new` or `replay` according to `isRecapOpened(period.startDate)`,
    read again with `useFocusEffect`
  - the whole card is one `Pressable` with `accessibilityLabel = title + ". " + message`
- [ ] **Step 2:** In the dashboard, when `panel.weeklyRecapPeriod?.status === "READY"`, render it
  and push `{ pathname: "/(app)/weekly-recap", params: { examId, weekStart: startDate } }`.
- [ ] **Step 3:** Run `pnpm --filter @mentor/mobile typecheck && pnpm --filter @mentor/mobile lint`.
  Expected: clean.

### Task 5: Recap route and access card

**Files:**
- Create: `apps/mobile/src/app/(app)/weekly-recap.tsx`
- Create: `apps/mobile/src/components/recap/recap-access-card.tsx`
- Create: `apps/mobile/src/components/recap/recap-message-state.tsx` (empty and error)

**Interfaces:**
- **Consumes:** Task 1 (`recapAccessView`), Task 3 (the API calls, `newRequestId`,
  `markRecapOpened`).
- **Produces:**
  - Route state: `"loading" | { error: string } | { offer } | { review: WeeklyReviewDto; examId: string }`.
  - `RecapAccessCard({ offer, busy, armed, error, onOpen, onCancel, onRetry })`
  - `RecapMessageState({ title, message, actions, onExit })`

- [ ] **Step 1:** Write the route.
  - Read `examId` and `weekStart` with `useLocalSearchParams`.
  - Load the offer.
    - `!offer.enabled` → `fetchWeeklyReview(examId)` (the free path).
    - `offer.reportId` with the owned or replay mode → read it when the student taps.
  - `open()` mirrors the web's `weekly-recap-entry.tsx:81-97`:
    - COIN arms first.
    - Otherwise `openWeeklyRecap({ …, clientRequestId: newRequestId() })`.
    - On success: `haptics.success()`, invalidate `["economy"]`, then the story state.
    - On error: show the message and fetch the offer again.
  - When `AppState` turns `active`, fetch the offer again while the offer state is showing.
  - The story state shows the empty `RecapMessageState` when `review.recap.status !== "READY"`.
    Otherwise it calls `markRecapOpened(review.period.startDate)` and renders `RecapStory`
    (Task 6).
  - The exit is `router.back()`.
- [ ] **Step 2:** Write the access card, using the web's `weekly-recap-access-card.tsx` at phone
  width.
  - Cover: coral, 212 tall, the `graphics` decor at the top right, the days and minutes teaser,
    the date range and top subject, and Puhu happy at 112 (or premium at 150 for a member).
  - Body rows: gift, member, owned, retry, notice, and the Coin choice.
    - Coin ready: arm → confirm, showing `from` → `to`.
    - Coin short: progress `balance/cost` and a caption.
    - Coin limit: `next_available`.
    - The Premium row is never rendered.
  - Footer caption: `gift_saved`, `member_saved`, `archive_waiting` or `saved_detail`.
  - Use theme tokens for the body and the existing UI `Button`.
- [ ] **Step 3:** Run `pnpm --filter @mentor/mobile typecheck && pnpm --filter @mentor/mobile lint`.
  Expected: clean.

### Task 6: Story player (playback, controls, gestures, completion)

**Files:**
- Create: `apps/mobile/src/components/recap/use-recap-playback.ts`
- Create: `apps/mobile/src/components/recap/recap-story.tsx`

**Interfaces:**
- **Consumes:** Task 1 (the playback functions, `weeklyRecapFinalActionsVisible`,
  `composeWeeklyRecapStory`), Task 3 (`completeWeeklyReview`).
- **Produces:**
  - `useRecapPlayback(slides, reducedMotion)`, which returns the web's
    `UseWeeklyRecapPlaybackResult` shape. `pageVisible` comes from `AppState === "active"`. It uses
    the same 50 ms commit and the 250 ms frame cap on `requestAnimationFrame`.
  - `RecapStory({ review, examId, onExit })`, which renders slides from Task 7.

- [ ] **Step 1:** Port the hook from `use-weekly-recap-playback.ts`, swapping `document` visibility
  for `AppState`.
- [ ] **Step 2:** Write `RecapStory`.
  - **Layout:** full-bleed slide background from the colour table; progress bars (1 px gap, white at
    35 %, fill as scaleX).
  - **Controls:** two 44 px round controls at the top right: play, pause or replay; and close.
  - **Tap zones:** two `Pressable` halves. `onPressIn` sets `held(true)`; `onPressOut` measures the
    press time; navigate only if `shouldNavigateAfterWeeklyRecapPress(ms)`.
  - **Swipe:** a horizontal `PanResponder`, ±56 px.
  - **Back:** `BackHandler` calls `onExit` and returns true.
  - **Slide change:** keyed `Animated.View` entering with `FadeIn` plus a 24 px slide, 420 ms, or
    120 ms fade under `useReducedMotion()`.
  - **Final actions:** shown when `weeklyRecapFinalActionsVisible(slide, state)` is true. "Bitti"
    calls `onExit`; "Tekrar izle" calls `replayWeeklyRecap` through the hook's `togglePlaying`
    or `goTo(0)`.
  - **Completion:** the first time the actions become visible, call
    `completeWeeklyReview(examId, review.period.startDate)` once (a ref guard; reset on failure).
- [ ] **Step 3:** Run typecheck and lint. Expected: clean.

### Task 7: Slides, decor and video

**Files:**
- Create: `apps/mobile/src/components/recap/recap-slides.tsx` (welcome, focus, weekly_run,
  weekly_best, performance, weekly_title text, final; `TextBeat`, `Center`)
- Create: `apps/mobile/src/components/recap/recap-week-map.tsx` (fire video and active days)
- Create: `apps/mobile/src/components/recap/recap-character-video.tsx`
- Create: `apps/mobile/src/components/recap/recap-decor.tsx`
- Create: `apps/mobile/src/components/recap/recap-share-preview.tsx`

**Interfaces:**
- **Consumes:**
  - Task 1: the selectors, `buildWeeklyRecapShareCardFacts`, `buildWeeklyRecapShareCardRows`,
    `getWeeklyRecapPeakDayStory`
  - Task 3: `recapArt`
- **Produces:**
  - `RecapSlide({ slide, review, elapsedMs, playing, reducedMotion })`
  - `RecapDecor({ kind, reducedMotion })`

- [ ] **Step 1:** Port each slide case from `weekly-recap-story.tsx:475-1013` at phone width.
  - Same copy and order.
  - Text beats swap headline and support at `getWeeklyRecapTextBeat`.
  - Welcome switches at 4 000 ms.
  - weekly_title renders nothing before `headlineAtMs`, and moves up 200 over the video.
  - `highlightDisplayValue` and the date formatting move into the slide file, using
    `Intl.DateTimeFormat` (Hermes supports it).
- [ ] **Step 2:** Write the decor.
  - Port the `StoryDecor` table (`weekly-recap-story.tsx:1374-1599`) to percentage
    `left/right/top/bottom/width/height` plus `rotate`.
  - Drift is a Reanimated `withRepeat(withSequence(...))` translate and rotate loop, using
    `STORY_ASSET_DRIFT` values and duration.
  - Under reduced motion, show a still at opacity 1.
- [ ] **Step 3:** Write the video layers.
  - `useVideoPlayer(source, p => { p.muted = true })`.
  - Play while `playing && elapsedMs < duration`.
  - Seek when the drift is over 0.25 s.
  - On a `statusChange` error, switch to the fallback: the character still (`contentFit="cover"`)
    or Puhu proud.
  - The fire video plays only during the first 4 000 ms.
  - Fire `haptics.success()` once when the character video starts.
- [ ] **Step 4:** Run typecheck and lint, then do a short emulator smoke run of a READY week
  (Task 8 data).

### Task 8: Emulator verification, docs and memory

**Files:**
- Modify: `docs/standards/mobile.md` (add a 2026-11-13 recap entry next to the reward scenes)
- Create: scratchpad QA scripts only (no repo files)

- [ ] **Step 1: Make the test data** (by SQL or API, like `chest-ready.cjs`):
  - a READY last week (≥ 2 qualifying sessions on two days)
  - a PARTIAL week user
  - Coin offers with enough Coin and with too little
  - an EARNED offer
  - an owned report
- [ ] **Step 2: Run the emulator pass.** Expected for each:
  - card new → replay
  - a PARTIAL week shows no card
  - every access state renders
  - a Coin confirm opens the report and the balance drops once
  - all 8 slides play
  - tap, hold and swipe work
  - background pauses the story
  - a failed video falls back
  - the lakap video fires its haptic
  - completion PUT fires once
  - the celebration shows only after closing
  - Android back exits
  - with animation scale 0, the story starts paused and the final actions show
- [ ] **Step 3:** Run
  `pnpm --filter @mentor/core test && pnpm --filter @mentor/web test && pnpm --filter @mentor/mobile test && pnpm --filter @mentor/mobile typecheck && pnpm --filter @mentor/mobile lint`.
  Expected: all green, except the web reds already known on master, which must be listed.
- [ ] **Step 4:** Write the `mobile.md` entry (what shipped, the "Not yet" list, gotchas) and update
  the memory files `mobile-weekly-recap-direction.md` and `mobile-emulator-run-recipe.md`.
