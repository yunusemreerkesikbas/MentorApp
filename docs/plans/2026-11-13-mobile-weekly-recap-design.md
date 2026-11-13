# Mobile weekly recap story — design

Date: 2026-11-13 · Branch: `feature/APP-142-mobile-core-qa` · App: `apps/mobile` (Expo SDK 58)
Reference: the web recap at phone width (`apps/web/src/app/[locale]/(app)/analysis/recap/`,
`apps/web/src/lib/weekly-recap.ts`, `apps/web/src/components/weekly-recap-teaser.tsx`).

## Intent

The mobile app's student-core release reaches web parity screen by screen. The reward scenes
(Coin, achievement, level, streak, weekly chest) are done. This stop brings over the **weekly recap
story**. Last week's effort is told as a full-screen, story-style deck that ends with the week's
nickname (lakap) and its character video. It is the web's most "shareable-feeling" moment and the
reason a student opens the panel on Monday. Without it, the mobile panel has nothing to say about
the week that just ended.

## Goals

1. **Panel card.** The coral "Haftanın hikâyesi" card on the panel when
   `TodayPanelResponse.weeklyRecapPeriod` is set and its status is **`READY`**. The owner ruled this
   on 2026-11-13: while `coaching.weekly_recap.access_enabled` is on, the access policy refuses a
   PARTIAL week, so the web's card leads to a dead-end notice. Mobile shows no card for it. The card
   has two states: **new** (not opened on this device) and **replay** (opened). It sits after the
   countdown card and before the goal card, the same place as the web's phone-width order.
2. **Access card.** It is the first thing the card opens. It has a cover with the free teaser numbers
   (active days, focus minutes, top subject, date range) and Puhu, then one way in:
   - **gift** (`EARNED`): open for free.
   - **member** (`PREMIUM`): open as a member.
   - **owned**: watch again.
   - **Coin**: arm, then a confirm step that shows the balance before and after; or "Coin'in yetmiyor"
     with progress; or the window limit with the next date.
   - **retry**: a passing outage (`AI_BUDGET_EXCEEDED`, `AI_DISABLED`, `WEEKLY_RECAP_PROCESSING`).
   - **notice**: the server's own message.
3. **Story.** Same slides, order, durations, colours, copy, decor and videos as the web's READY deck:
   - welcome 10 s · week_map · focus · weekly_run · weekly_best · performance · weekly_title 8 s
     (character video) · final. Every slide not given a time here is 7 s.
   - The final slide's content includes the web's share-card preview (`WeeklyRecapShareCardPreview`)
     as a picture. Only the share action is out of scope.
   - Controls: progress bars, a play/pause/replay control and a close control. A tap on the left or
     right half moves back or forward (the web's tap zones are halves). A press of 300 ms or longer
     pauses. A 56 px horizontal swipe moves back or forward.
4. **Completion.** Call `PUT /v1/coaching/weekly-review/completion {examId, weekStart}` (the web's
   `completeWeeklyReview`) once, when the final slide's actions become visible. It feeds quests and
   rewards. When the story screen closes, ask the celebration queue for unseen rewards and refresh the
   panel and economy queries. "My calls" says why this differs from the web's timer end.
5. **Opened mark.** When a story loads, mark the week opened on the device. The panel card then shows
   its replay state.

## Non-goals (this stop)

- Share (share card image plus the system share sheet).
- Puhu note sheet (narration).
- Deep analysis.
- Archive.
- "Plana ekle" from the suggested task: the mobile plan has no prefilled add yet.

All five belong to the next recap stop.

- **The PARTIAL deck** (spark, partial_unlocks, partial_final and the PARTIAL ordering). No card
  leads to it on mobile (Goal 1). A PARTIAL or EMPTY review reached any other way shows the empty
  state described under "Free path".

- **No Premium purchase or upsell on mobile** (standing owner decision): call the access view with
  `purchases = false`.
- **No music or sound effects** (standing owner decision for scenes: haptics only). The web's
  sound toggle is not shown.
- **No analytics events:** the web's `trackWeeklyRecapEvent` has no mobile counterpart yet.
- **No new entry points.** The web reaches the recap only from the panel card; mobile does the same.

## Anti-goals

- Showing the web page in a WebView.
- A second copy of the slide logic that can drift from the web's.
- Spending Coin twice. The idempotency key is made once per confirm and reused on a retry of that
  same confirm.
- A celebration modal popping over the story while it plays.
- UI copy that explains gating, limits or legal details beyond what the web card already says.

## Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **Native port, shared logic in `@mentor/core`** | Most code to write, but native gestures, video and offline. Both apps compute the same slides. | **Picked** |
| WebView of `/analysis/recap` | Fastest to "have", but needs the auth session in a web view, carries the Next shell, breaks offline, and feels foreign. | Rejected |
| Native port with stills instead of videos, or videos streamed | Smaller app (~5 MB vs ~33 MB). Stills drop the lakap reveal; streaming needs a web base URL on mobile and fails offline. | Owner chose bundling ("1 · Hepsi uygulamada"). Streaming stays the fallback if app size becomes a problem; it would not change the screens. |

## Decided

### By the owner

- **Scope A, "Yalnız hikâye":** panel card, access card, story. The final slide offers
  **"Bitti"** (close) and **"Tekrar izle"** (replay) instead of the web's dock (Plana ekle / Paylaş /
  Puhu notu).
- **All media bundled in the app:**
  - 7 character videos (`apps/web/public/video/character/*.mp4`, without `puhu-streak-kept`)
  - `puhu-fire.mp4`
  - the 7 character stills (`img/character/*.png`, used as posters and as the fallback when a
    video fails)
  - the 9 decor PNGs in `visuals/weekly-recap-2023/`

  That is about 33 MB, imported through `apps/mobile/src/lib/art.ts` like the chest clip.
- **Standing rulings:** same scene, simpler motion; haptics instead of sound; Premium upsell hidden.
- **Access card copy is ported as-is** (owner, 2026-11-13). That includes the lines that promise
  the Puhu note, the deep analysis and the archive. Mobile does not go live until every recap stop
  is done, so the next stop keeps those promises; they are not trimmed now.
- **Panel card only for READY weeks**, and the PARTIAL deck waits (owner, 2026-11-13).

### My calls (correct me)

- **Shared logic moves to `@mentor/core`.** The pure parts of `apps/web/src/lib/weekly-recap.ts`
  move:
  - `composeWeeklyRecapSlides`
  - the playback reducer (`createWeeklyRecapPlayback`, `advanceWeeklyRecapPlayback`,
    `navigateWeeklyRecapPlayback`, `replayWeeklyRecap`, `shouldWeeklyRecapAdvance`,
    `shouldNavigateAfterWeeklyRecapPress`)
  - the text beat and week-map phase helpers
  - the story-mode selectors
  - `getWeeklyRecapPeakDayStory`
  - the teaser state helpers

  `recapAccessView` moves with them. In core, a slide names its media by **key**: the character id
  plus the cue times, and the audio key plus its start second. Each app maps keys to its own sources:
  web to public URLs, mobile to bundled `require`s. The web file becomes a thin adapter that keeps
  today's slide shape (`audioSrc`, `characterVideo.src/posterSrc`), so **no web component changes**.
  The web specs for the moved functions move to core.
- **Opened mark storage.** It goes in SecureStore, the only key-value store installed, and already
  used for preferences. SecureStore keys allow only `[A-Za-z0-9._-]`, so the key is
  `mentor.weekly-recap.opened.v2.<startDate>`, a dot instead of the web's colon. Core exports the key
  builder per app, or takes the separator. The builder picks.
- **Where the exam id comes from.** The panel's `weeklyRecapPeriod.examId` is passed to the screen,
  so the web's `me` → calendar lookup is not needed.
- **Free path.** When `offer.enabled` is false (economy off), the web plays the story straight from
  `GET /v1/coaching/weekly-review?examId=`; mobile does the same. The existing mobile
  `fetchWeeklyReview()` gains the `examId` parameter. An `EMPTY` review shows the web's empty state:
  Puhu (encouraging), the server's closing message, "Oturum başlat" and close. The web's "add task"
  link becomes "Plana git", because the plan has no prefilled add.
- **Screen.** One route, `apps/mobile/src/app/(app)/weekly-recap.tsx`, presented full screen with
  no header. Its state machine is loading → access card (themed like the app, scrolls) → story
  (full-bleed) → close. Close and Android back return to the panel. Inside the story, back closes the
  story; it does not step through slides.
- **Coin confirm.** It follows the web: arm, then confirm, then `POST coach/weekly-recaps` with
  `Idempotency-Key = clientRequestId`. Lift the UUID helper in `analysis-api.ts` into a shared
  `lib/request-id.ts`. On success, invalidate the economy balance. On an error, show the message
  and fetch the offer again. When the app returns to the foreground, fetch the offer again (the web
  does this on `visibilitychange`). Use the existing `AppState` pattern.
- **Motion.** Slide change: 420 ms opacity plus a 24 px x-slide. Text beats and progress bars use
  the web's numbers. Decor drift (`STORY_ASSET_DRIFT`) becomes a simple Reanimated translate or
  rotate loop, or a still where the web's motion is fiddly ("same scene, simpler motion").
  **Reduced motion:** the story starts paused, as on the web (`createWeeklyRecapPlayback(true)`).
  Slide changes fade in 120 ms and decor stays still.
- **Haptics.** `haptics.success()` once, when the weekly_title character video starts (the lakap
  reveal), and after a successful Coin open. No haptic on each tap.
- **Video.** One `useVideoPlayer` per video slide, muted, `contentFit="cover"`,
  `nativeControls={false}`. If the story is ever wrapped in an RN `Modal`, use
  `surfaceType="textureView"` at full opacity. The story timer stays the source of truth: a video
  that fails falls back to its still (character) or to Puhu proud (fire), as on the web. The
  null-source `playToEnd` gotcha from the chest scene applies.
- **When the story counts as finished.** The web completes when the last slide's timer ends.
  Mobile adds "Bitti", which closes the story before that, and reduced motion starts paused, so the
  timer rule would lose completions. Mobile completes once, when the final slide's actions become
  visible: at the support beat while playing, or as soon as the final slide is reached when paused
  or in reduced motion (the actions show at once then). The server keeps one completion per week, so
  tapping through cannot farm rewards.
- **No celebration over the story.** The celebration queue holds while the recap screen is open
  (the provider already has an `isHeld` hook). The screen asks for unseen rewards when it closes.
- **Idempotency.** The server already allows one report per user, exam and week, so a double tap
  cannot spend Coin twice. A key per confirm is still sent, because the API requires it.
- **Copy.** It goes in a new `recap` namespace in `apps/mobile/src/i18n/{tr,en}.ts`, ported from
  the web's `analysis.recap` keys used by the teaser, the access card, the story and the empty or
  error states (about 120 of the web's 184). The mobile formatter substitutes `{name}` only, so ICU
  plurals become plain `{count}` strings, with the EN phrasing kept count-neutral. Remove the stale
  `dashboard.weekly_recap_title/summary` keys.

## Constraints

- **Stack:** Expo SDK 58, RN 0.88, React 19.3, Expo Router, Reanimated 4, expo-video, expo-image,
  react-native-svg, `@solar-icons/react-native`, Nunito. `@mentor/core` is consumed from dist, so
  rebuild it after edits.
- **Colours:** the web's story colours are `--recap-coral #ff5b49`, `--recap-lavender #afb1ff`,
  `--recap-mint #16d0a6`, `--recap-sky #e3ecef`, `--recap-ink #000000` and `--recap-purple #400073`.
  These are scene colours like the chest scene's; they are not app theme tokens.
- **File size:** components stay under about 250–300 lines (mobile and frontend standards). The
  web's 1712-line story is not the model for file size. Expect a `components/recap/` folder: the
  player shell (progress, controls, tap zones, swipe), one file per slide group, decor, the video
  layer, the access card and the panel card.
- **Platform:** Android emulator verification only (iOS untested, as with the earlier parts).

## Left to the builder

- The exact component split and Reanimated details.
- How core's media keys are typed.
- Whether the access card reuses pieces of existing mobile sheets (streak rescue has a Coin
  confirm) or gets its own small rows.
- **Test data:**
  - a user with a READY last week
  - a user with a PARTIAL last week (to check that the panel card stays hidden)
  - a Coin-mode offer with enough Coin and with too little
  - an EARNED (gift) offer
  - an owned report

  Build them from SQL or API calls the way the chest QA did (`chest-ready.cjs`).
- **Checks:**
  - node:test for the moved core logic (moved web specs plus anything new)
  - web `test` and `typecheck` still green after the adapter change
  - mobile `tsc`, `eslint` and tests
  - an emulator pass: every access state, the READY deck, no card for a PARTIAL week, tap, hold, swipe, the replay and
    close controls, Android back, reduced motion, the lakap video and its haptic, and the completion
    call followed by the celebration on close
