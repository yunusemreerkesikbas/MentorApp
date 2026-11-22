# Mobile Standards (Expo / React Native — Phase 2)

> **Status:** Phase 2.0–2.6 active (`apps/mobile`).
> Canonical context: [`../../AGENTS.md`](../../AGENTS.md) · Reference skills: `mobile-design`, `appllama-app-design-skill`, `senior-architect`.

## Architecture
- [x] **Expo Router (file-based).** ⚠️ **Do NOT use API routes** (`+api.ts`) — single API = NestJS `/v1` (§8). A second
  backend breaks the single-API decision.
- [x] Data from the **single API**: `@mentor/api-client`. Types & validation: `@mentor/types` +
  `@mentor/validation` + pure presentation/navigation helpers in `@mentor/core` (shared with web).
- [x] **No business logic/calculations on mobile** (§principles) — backend computes, mobile shapes/displays.
  **User-facing messages come localized from the backend** and are shown directly (same contract as web).
- [x] Design: an **RN adaptation** of `@mentor/ui/tokens` (same color/spacing/radius/ledge/typography source; no magic numbers).

## Platform & UX
- [x] Respect platform conventions (iOS/Android navigation, one-way door `router.replace` on auth/onboarding, safe-area).
- [x] Touch targets ≥44px (`touchTargets.min = 44`); gestures/animations native-feeling (Reanimated); haptics in moderation (`src/lib/haptics.ts`).
- [x] Long lists virtualized (FlashList/FlatList); heavy work off the main thread.
- [x] **Latency tolerance:** TanStack Query v5 with `AppState` focus revalidation + offline banner and cached query fallback.

## Versioning & release
- [x] Mobile **can't be force-updated** → API `/v1` must be backward-compatible; the client tolerates old versions.
- [ ] Native push in Phase 2 (web bridges with web-push + email). Fast patches via OTA/EAS Update; store
  release for breaking changes.
- [x] Build/release via **EAS** (`apps/mobile/eas.json`); pipeline with `expo-cicd-workflows`.

## Don't
- ❌ Expo Router API routes (backend) · ❌ copying types/schemas between web and mobile · ❌ off-DESIGN values ·
  ❌ synchronous heavy work · ❌ importing `@mentor/ui` root in RN (always import `@mentor/ui/tokens`).

## Design parity with the web
- [x] **The web at phone width is the reference** for every screen: same layout, colours, Nunito, Puhu art
  and copy. Diverge only where the platform demands it (bottom tab bar, bottom sheets instead of popovers,
  keyboard handling, 44dp touch targets).
- [x] **Art comes straight from `apps/web/public`** through `apps/mobile/src/lib/art.ts`; do not copy images
  into the mobile app. Icons are Solar via `@solar-icons/react-native` (same import paths as the web).
- [x] **No Premium upsell on mobile until in-app purchase exists** (PREMIUM badges, trial card, locked
  nudges stay hidden). A user who subscribed on the web still gets the hero mask, masked Puhu and the daily note.

- [x] **Reward scenes keep the web's art, copy, order and rules; only the motion is simpler.** One
  `SceneShell` stage (`src/components/celebrations/`) built on `Animated` with the native driver, a haptic
  where the web plays a sound. The queue rules are shared code in `@mentor/core`, never re-implemented.

## Geliştirmeler (timeline)

- **2026-11-21 — Cross-screen student-core consistency, Streak Rescue & Weekly Chest, live OpenAI QA, native push wiring & store readiness audit (`apps/mobile`, `apps/api`, `@mentor/*`):**
  - **What was done:**
    - *Consistency & navigation:* Aligned `modules/content` `todayIso` to `Europe/Istanbul` (`31/31` unit tests) so Panel and Sınav Rehberi share exact countdowns; added `numberOfLines={1}` on Android Fabric single-line CTAs/links (`knowledge-hub`, `article-cards`, `quests-card`, `streak-rescue-sheet`, `chest-scene`, `ui/chip`, `ui/button`, `analysis-*`); added `maxHeight: "88%"` on `BottomSheet`; added `router.dismissAll()` before `router.replace` on tab switches (`role-tab-bar`, `app-header`) and `Deftere dön` inside `NotebookAddForm`; hardened Puhu chat states (`coach.tsx`, `coach-{chat-chrome,profile-memory-card,message-bubble}.tsx`) and deferred `StreakRescueSheet` behind active celebrations (`dashboard.tsx`).
    - *Native Push:* Added `mobile_push_tokens` (`0143_mobile_push_tokens.sql` with `FORCE ROW LEVEL SECURITY`), `ExpoPushAdapter`, `POST/DELETE /v1/notifications/mobile-push-tokens`, Web+Expo `SendPushHandler` fanout, KVKK erasure, and mobile `expo-notifications` (`PushNotificationsProvider`, Notification Center permission/registration toggle with graceful Expo Go fallback, logout unregister, and tap deep-link routing).
  - **Verified on Android emulator (`Puhu_Pixel`, `411 dp TR Light` & `360 dp EN Dark`):** Cross-screen countdown parity (`KPSS 39 gün`, `ALES 8 gün`), single-line links, Analysis Back stack (sub-sheets, Notifications bell, tab switch), unseen Puhu states + live OpenAI (`gpt-4o-mini`) official card / Companion turn (`50 -> 0 Coin`) / action confirmation / memory consent toggle / API-offline retry recovery, Streak Rescue (`canAfford: false/true` + `QuestsSheet`), Ready Weekly Chest (`ChestScene` video + Caveat note + `+100 Coin`), live `/v1/notifications/mobile-push-tokens` API checks, and Android 13 OS notification permission dialog + crash-free Expo Go push toggle. Temporary DB test state cleaned to baseline (`50 Coin`, `0 mobile_push_tokens`).
  - **Remaining unverified / pre-store gaps (explicitly separate):** (1) Remote push delivery via FCM v1 / APNs on an installed dev/preview/production build on a physical device; (2) iOS Simulator & physical iOS device QA (host is Windows, no local Xcode); (3) Production environment verification; (4) Pre-store prerequisites currently missing in repo/env: `apps/mobile/assets/` (app icon, adaptive icon, splash icon, notification icon), `EXPO_PUBLIC_EAS_PROJECT_ID`, Firebase `google-services.json`, Apple Developer/APNs key & signing credentials, Android upload keystore / Play Console service account, empty `eas.json` `submit.production`, and `eas-cli`. `STUDENT_CORE_ONLY = true` remains enforced with Community, Human Coach, and Premium purchase CTAs hidden.
  - **Related files:** `apps/mobile/src/**`, `apps/api/src/{database/schema-mobile-push,shared/adapters/push/expo-push.adapter*,modules/notifications/*,modules/content/*}`, `packages/{types,validation}/src/notifications.ts`.

- **2026-11-21. Notification Center and Exam Guide parity.** Notification Center now mirrors the phone-width web drawer (`All`/`Unread` underline `SlidingTabs`, `Bugün`/`Bu hafta`/`Daha eski` recency groups, unread tint/dot styling, `< 7d` relative timestamps, 44×44 row `ActionSheet`, Puhu empty state, and `BİLDİRİM AYARLARI` switches). Exam Guide mirrors `/bilgi` across all 5 exam families (`KPSS · YKS · LGS · ALES · DGS`) with `ExamDayCard`, featured/row cards with R2 covers, pagination, responsive Markdown tables (`<=3` cols fit full-width; `>=4` cols scroll), provenance trust row, and `Puhu’ya sor` composer bridge. See `apps/mobile/src/app/(app)/{notifications,knowledge}.tsx`, `apps/mobile/src/components/{notifications,knowledge,ui/sliding-tabs}.*`, and `apps/mobile/src/lib/{notifications-view,knowledge-view,content-api}.ts`.
  - **Android QA.** Compared loaded screens against phone-width `apps/web` captures for the same isolated student at 411 dp TR/light and 360 dp EN/dark (`720x1520 @ 320dpi`). Verified Notification Center switch toggle + rollback path, `Okunmadı/Okundu/Sil`, `Tümünü okundu işaretle` empty state, Settings entry, `/plan` and `/bilgi/<slug>` deep links + Back stack, Exam Guide `KPSS`, `ALES` (4-date official timeline, empty topic, fixed 3-col table, `Puhu’ya sor`), `LGS` (pending calendar + empty exam), `DGS` offline error + retry recovery, and clean zero-clipping fit at 360 dp EN/dark. Emulator R2 cover loading required `-dns-server 8.8.8.8,1.1.1.1`; temporary QA fixtures & captures remain gitignored under `apps/mobile/.expo/qa-nk-*`.
- **2026-11-20. Settings and identity visuals.** Settings uses the web profile’s centred identity and grouped action rows. Theme and language live in native sheets. Login, signup and password recovery use one scrollable, safe-area-aware panel with the existing theme gradients. Login and signup reuse the web’s Puhu sprites; the password sprite is selected by focus alone. See `apps/mobile/src/components/auth/auth-form-screen.tsx`, `apps/mobile/src/components/ui/ambient-backdrop.tsx` and `apps/mobile/src/app/(app)/(tabs)/settings.tsx`.
  - **Android QA.** Compared the same local student at 411 dp in Turkish/light and 360 dp in English/dark. Checked preference selection and sheet dismissal, notification navigation and return, sign-out, sign-in, recovery for an unknown address, and the signup consent gate. On the small screen the password field brings up the cover-eyes sprite and the keyboard leaves the primary action visible. Captures are gitignored under `apps/mobile/.expo/qa-identity-parity-*`.

- **2026-11-19 — Analysis content on mobile.** Progress uses the phone web’s report, improvement path, net and subject cards. Mistakes uses the API’s reason and location signals, review history, and filtered notebook. The mock exam flow adds a calendar and a saved result card. Open a history row to see its recorded sections and actions. Android Back dismisses an open sheet first. The entry’s Back listener remains scoped to the focused Analysis screen. See `apps/mobile/src/components/analysis/` and `apps/mobile/src/app/(app)/(tabs)/analysis.tsx`.
  - **Android QA.** Compared loaded screens for the same local student at 411 dp in Turkish/light and 360 dp in English/dark. At 411 dp the exam form applied the selected date and saved 8 correct, 2 wrong and 20 blanks as one subject and 7.50 net. The entry remained open when leaving to Settings and returning via Android Back. At 360 dp the populated trend and reason filter loaded, a focus task reached Plan, and a solved early review was recorded. The numeric keyboard was checked at 360 dp in Turkish/light. A cold app launch and entry navigation reproduced zero duplicate-key warnings after separating the form and history keys. Captures are gitignored under `apps/mobile/.expo/`.

- **2026-11-18 — Analysis header and entry navigation (`apps/mobile`):** Matched the phone-web header's title/exam caption, two-view sliding control and separate entry action. Entry returns to its source view through Analize dön or Android Back; both were verified on the isolated student account. This is a header/navigation slice; the progress and mistake cards still await visual parity. Related files: `src/app/(app)/(tabs)/analysis.tsx`, `src/components/analysis/analysis-header.tsx`, `src/i18n/{tr,en}.ts`.

- **2026-11-18 — Puhu chat layout at the web reference (`apps/mobile`):**
  - **What changed:** Same-account, Turkish/light, 411 dp web/Android comparison replaced stacked
    chat cards with the web's greeting, pastel scene, open calibration, history sheet and fixed
    composer. Replies use the plain transcript treatment; feedback has accessible Solar buttons.
    Existing preferences, consent, message/context handling and action APIs remain in use.
  - **Usage:** Open Puhu, answer or skip the first-chat card, or open history for New chat and
    memory controls. Suggested starters populate the input without sending. Privacy details open
    the existing policy in the app language; returning retains the draft.
  - **Android verification:** Offline preference save retains all three selections; reconnecting
    saves the exact values. Skip preserves saved preferences and memory decline. History, New chat,
    offline draft retention and one persisted real-provider reply were checked. At 360 dp in dark
    mode the send control clears the open keyboard and tabs hide; notices return after Back.
  - **Limits:** The real-provider check used the configured `gpt-4o-mini` model and one reply.
    Broader response-quality checks, the remaining screen comparisons, native push and iOS remain
    open. No provider setting or account role was changed.
  - **Related files:** `src/components/coach/coach-{chat-chrome,calibration-card,message-bubble}.tsx`,
    `src/app/(app)/(tabs)/coach.tsx`, `src/lib/signup-legal{,.spec}.ts`.

- **2026-11-17 — Android password recovery and Metro QA (`apps/mobile`):**
  - **Verified:** Empty/invalid email, enumeration-safe success for known/unknown addresses, offline
    error with the email retained, reconnect/retry, TR/EN email paths and password changes in Android
    Chrome, old-password rejection and new-password native login. Reuse of each link returns 400;
    both prior access/refresh session pairs return 401. A previously signed-in native session
    returns to Welcome on cold start. At 360 dp both buttons clear the keyboard; Android back
    closes the keyboard first, then returns to login. Only a dedicated local student was reset.
    Its current credentials and QA helpers stay gitignored under `.expo/qa-reset-*`.
  - **Development setup:** Removed pre-SDK-52 manual Metro workspace overrides. SDK 58's
    `getDefaultConfig` watches the imported workspaces without crawling the whole repository root.
    Keep the relative `.js` → TypeScript resolver. Restart Metro with `--clear` once after the change.
    The web reset page uses the existing browser flow; return to Expo Go manually.
  - **Related files:** `metro.config.js`, `src/app/(auth)/{login,forgot-password}.tsx`;
    see `docs/features/identity.md` for the session and password checks.

- **2026-11-17 — Android network recovery QA (`apps/mobile`)**
  - **Verified** With Wi-Fi and mobile data disabled on Puhu_Pixel, saving first-chat preferences
    shows the Turkish error, retains all three choices and re-enables Save. Reconnecting and saving
    again persists the exact support, tone and memory choices through the shared API.
  - **Session recovery** A cold app start and another retry while disconnected show the recoverable
    session screen. After reconnecting, the same student returns without entering credentials and
    both saved conversation pairs remain readable. The isolated QA profile and network settings
    were restored after the test.
  - **Related files** `src/components/coach/coach-profile-memory-card.tsx`,
    `src/providers/auth-provider.tsx`, `src/app/_layout.tsx`. Verified on the Android emulator.

- **2026-11-15 — Plan tab, Takvim (stop B2a) (`apps/mobile`, `@mentor/core`, `@mentor/ui`)**
  - **What was done** Takvim adds Ajanda and Ay, a shared 42-day board, a subject legend, public
    holidays and the event details sheet. The screen persists the view and scale in SecureStore.
    Ajanda follows its visible date while keeping the board month stable across spill days. Direct
    picks and the navigation buttons update the month according to their own rules. In Ay, the
    arrows step from the visible board month and retain the selected day-of-month across short months.
  - **Implementation** The app-root `GestureHandlerRootView` wraps `src/app/_layout.tsx`. A root
    around the board alone never started the pan on Android, reporting `didn't get starting ACTION_DOWN`.
    PanResponder stalled for 1.3 s in the spike. The gesture-handler pan and Reanimated worklets
    update the board height and row shift together on the UI thread.
  - **Gotchas** Remount the agenda on month changes so Fabric layout measurements belong to one
    visit. Wait for the end spacer to enter the native scroll range before pinning the last date.
    Preserve the native visible day when a late meeting changes earlier row heights. Disable task
    deletion in Takvim during another shared write so the second confirmation cannot be dropped.
    Use UTC for date-only week and month arithmetic so the device timezone cannot shift a date.
    At 360 dp, the day cell needs compact line heights to fit a holiday, two chips and the overflow
    count inside 84 dp. Scroll the outer page to reach the handle and legend when the tab bar covers
    the bottom of the expanded board. After a density change or force-stop, Expo Go may need the
    local deep link reopened before the Plan tab is available.
  - **Related files** `apps/mobile/src/components/plan/calendar/`, `apps/mobile/src/lib/plan-calendar.ts`,
    `apps/mobile/src/app/(app)/(tabs)/plan.tsx`, `packages/core/src/plan-calendar.ts`.

- **2026-11-14 — Plan tab, view switcher and Timeline (stop B1) (`apps/mobile`):**
  - **What was done:** The Plan tab gained the web's Liste / Timeline switcher (`SlidingTabs`, a reusable
    sliding pill in `components/ui`) and the Timeline view at phone width. The week sits on a rail inside
    its own scroller; the day nearest the top is active (springing date badge, rail fill) and drives the
    week card's selection, and a day picked on the strip, a rail dot or the date sheet scrolls into place.
    Each week opens pinned (today on entry, the week card's day after an arrow or the sheet) under a
    skeleton; the card stays mounted while an uncached week loads, so it never blinks. Rows are the dense `PlanTaskRow` (tick, menu and "Seans başlat" kept); done rows go last.
    In Timeline the week card hides its day progress and the past-day notice is not shown, so nothing above
    the card moves while scrolling. The view is saved in SecureStore (`mentor.plan.view.v1`; `calendar`
    and anything unknown open Liste). Tick and delete moved into `usePlanTaskActions`, shared by both views.
    Coach meetings are not on the Timeline (as on the web). Takvim is stop B2.
  - **Usage:** `pnpm --filter @mentor/mobile test | typecheck | lint`; the rules (pin target, active day,
    order, rail fill, snap stops, scroll sync, end space) are in `src/lib/plan-timeline.ts` with specs.
  - **Gotchas:** Snap stops are each day's top plus stops inside a day taller than the scroller, or its
    last rows are unreachable; inner stops are half a screen apart so any row up to half the scroller
    tall rests whole at one. RN treats the content's end as a snap stop (`snapToEnd={false}` instead
    scrolls freely past the last stop), so the end space is sized to the last day: it rests at the top and
    no further. Size that space from the scroller's set height, not its measured one: Fabric runs the pin's
    `scrollTo` before a taller content lands and clamps it (on a Sunday the entry pin stopped short).
    The timeline's own selection changes can render after the scroller has moved on, so never infer
    "picked outside" from a selection change (a timing-based queue went stale under batched renders).
    Picks from the strip, a dot, the date sheet or a saved task bump a `scrollRequest` counter; the
    scroller's own changes go through `onActiveDayChange` and bump nothing (`timelineSync`). The pin
    waits for the week's tasks and fresh measurements on every visit, and the badge only springs once the
    cover has lifted (otherwise it travels from the previous day on reveal). During our own `scrollTo`, `onScroll` must not update the active day (passing
    days flipped it). Active and idle day headers share one height (the web's idle one is 4px shorter),
    otherwise every later day re-measures on each change. Animate the badge and fill with
    `translateY`/`scaleY`: animated `top`/`height` lagged seconds behind on Fabric. Reanimated 4's spring
    defaults to `mass: 4`; pass `mass: 1` for framer-motion's feel. The day sections are `memo`ised so the
    first measurement pass does not redraw the week seven times. In Expo Go dev mode on the emulator a Plan
    screen render takes ~0.5–1 s (Liste too), so taps feel slow there; judge timing in a release build.
    A short `adb input swipe` that started on a row once opened its session; in QA, swipe in the card's
    right gutter.
  - **Related files:** `apps/mobile/src/components/plan/{plan-timeline,plan-timeline-day,plan-timeline-skeleton}.tsx`,
    `apps/mobile/src/components/plan/use-plan-task-actions.ts`, `apps/mobile/src/components/plan/{plan-task-row,plan-week-card}.tsx`,
    `apps/mobile/src/components/ui/sliding-tabs.tsx`, `apps/mobile/src/lib/{plan-timeline,plan-view-store}.ts`,
    `apps/mobile/src/app/(app)/(tabs)/plan.tsx`.

- **2026-11-14 — Plan tab, Puhu'yla planla at web parity (stop C) (`apps/mobile`, `@mentor/core`):**
  - **What was done:** "Puhu'yla planla" on the Plan tab follows the web's `PlanCoachAdaptationAction`:
    the Coin choice sheet (confirm block, allowance pips, "{n} Coin daha", retry clock, saved draft link),
    the four-step wizard (days, minutes, subjects, note) seeded from Puhu's brief, the "Şehrin üstünde"
    waiting scene (night sky, city layers, masked hero loop, dropping paper notes, progress bar, Vazgeç),
    and the draft preview (evidence list, day headings, tick boxes, apply, 409 regenerate). The panel's
    "Bugünü hafiflet" opens the MOOD flow through `/plan?coach=adapt&source=mood` for students who have
    `plan.ai`; everyone else lands on the plan as before. Access, brief seeding, stage notes and change
    selection come from `@mentor/core` (`planAccessView`, `seedBriefSubjects`, `stageNotes`,
    `flattenPlanAdaptationChanges`, `parsePlanAdaptationQuery`, `isPremiumFeatureAvailable`).
  - **Usage:** `pnpm --filter @mentor/mobile test | typecheck | lint`. The Coin path needs
    `ai.plan.coin_enabled` and `economy.enabled`; with the Coin path off the sheet says "Puhu’yla planlama
    şu an telefonda açık değil." and never shows the server's Premium line (purchases stay off on mobile).
  - **Gotchas:** iOS drops a modal presented while another is closing, so every sheet → host → preview
    hand-off goes through `createDismissQueue` (flushed by the closing modal's `onDismiss`; Android runs at
    once). Inside a `Modal`, Android back reaches `onRequestClose`, not `BackHandler`: the host routes it to
    the stage's Vazgeç or the wizard's Back (`backRef`). The host covers the app's toast, so errors while
    the wizard is up are said in the wizard. `VideoView` in a Modal needs `surfaceType="textureView"`. A
    rounded tick box whose fill changes in place stays square on Android: remount it with a `key`.
    Edge-to-edge Android does not resize for the keyboard, so `KeyboardAvoidingView` uses `"padding"` on
    both platforms. Touches follow the React tree, not the native one: a Modal rendered inside a
    `ScrollView` with the default `keyboardShouldPersistTaps="never"` loses its first tap to closing the
    keyboard, so the Plan `ScrollView` is `"handled"`. A video player started before its texture view has a
    surface (the modal still opening, the keyboard still closing) moves to it mid-play, and the emulator's
    `c2.goldfish.h264` decoder then draws black (logcat: "remote graphic buffer migration N/N"); the stage
    loads its clip 600 ms after mount and keeps the clip's first frame on top until `onFirstFrameRender`.
  - **Related files:** `apps/mobile/src/components/plan/puhu/*`, `apps/mobile/src/components/unlock/unlock-rows.tsx`,
    `apps/mobile/src/lib/{plan-puhu,plan-previews-api}.ts`, `apps/mobile/src/app/(app)/(tabs)/{plan,dashboard}.tsx`,
    `packages/core/src/{plan-access,plan-adaptation}.ts`.

- **2026-11-14 — Plan tab, Liste view at web parity (stop A) (`apps/mobile`, `@mentor/core`):**
  - **What was done:** The Plan tab was rebuilt as the web's `PlanShell` Liste view at phone width: week
    card (week arrows, "Tarih seç" month sheet, day circles with dots, progress), task card (rows with
    checkbox, subject, duration, "Koçundan" badge, coach note, "Seans başlat →", "⋯" menu), coach meetings
    as read-only rows with a details sheet, add/edit task sheet (all-day, start/end time sheet, taxonomy
    chips, duration, description), delete through `ConfirmDialog`, past days read-only. The view switcher
    and the Puhu planning button stay hidden until stops C and B. Grouping, time and form rules moved to
    `@mentor/core` (`plan-items.ts`, `plan-task-form.ts`) and the web imports them from there
    (`endTimeAfterStart`, `planTaskLockedFocus`, …). An analysis or weekly-report task keeps its subject
    in the edit sheet (read-only box, as on the web). Failed writes show the API's message or the
    Turkish fallback, never a raw `TypeError`.
  - **Usage:** `pnpm --filter @mentor/core build` after touching the core files; specs in
    `packages/core/src/plan-{items,task-form}.spec.ts` and `apps/mobile/src/lib/plan-view.spec.ts`.
  - **Gotchas (Android, density 2.625):** fit-content text in a wrapping row measures a pixel short and
    wraps or clips ("TYT Matematik" → "TYT"): give such labels `numberOfLines={1}`. A rounded view whose
    background changes after mount draws a square: remount it with a `key` per colour. A 1/7-width
    flex-wrap grid fits six cells: lay a month out as explicit week rows. Pull to refresh must invalidate
    `["plan-events"]` as well, or a new coach meeting stays hidden while the tab stays mounted. A second
    tap can land before the re-render: derive the next week from the previous state (`shiftPlanWeek`),
    and guard writes with a ref, not state. Keep the week card up while a week loads or fails.
  - **Related files:** `apps/mobile/src/app/(app)/(tabs)/plan.tsx`, `apps/mobile/src/components/plan/*`,
    `apps/mobile/src/components/ui/confirm-dialog.tsx`, `apps/mobile/src/lib/plan-view.ts`,
    `packages/core/src/plan-{items,task-form}.ts`, `docs/plans/2026-11-13-mobile-plan-list-{design,plan}.md`.

- **2026-11-13 — Expired access token after the app sat in the background (`apps/mobile`, `@mentor/api-client`):**
  - **What was done:** Android stops JS timers while the app is in the background, so the refresh timer
    never ran and the first queries after return went out with an expired token: every one got
    401 `AUTH_TOKEN_EXPIRED`, the late refresh then succeeded, but 4xx is not retried and the screen showed
    an error until "Tekrar dene". `httpRaw` now takes an optional `refreshAccessToken` hook: on a 401
    `AUTH_TOKEN_EXPIRED` for a request that carried a token, it renews the session once (or just resends
    if another request already renewed it) and sends the request again. The mobile `AuthProvider` passes
    its single-flight `silentRefresh`, so a burst of 401s costs one `/v1/auth/refresh`. The web passes no
    hook and is unchanged.
  - **Usage:** nothing to call; `pnpm --filter @mentor/api-client test` runs `src/http.spec.ts` against `dist`
    (build first).
  - **Gotchas:** to reproduce quickly, run the local API with `JWT_ACCESS_TTL=120`, send the app home for
    over two minutes and bring it back from recents (not a fresh `am start`).
  - **Related files:** `packages/api-client/src/{http,http.spec}.ts`, `apps/mobile/src/providers/auth-provider.tsx`.

- **2026-11-13 — Weekly recap story ("Haftanın hikâyesi") at web parity, story only (`apps/mobile`):**
  - **What was done:** A READY last week puts the coral `RecapTeaserCard` under the countdown on the panel
    (a PARTIAL week shows nothing); once opened it turns to its "tekrar izle" face (a secure-store flag per
    week). `/(app)/weekly-recap` shows the web's access card: gift, member, owned, the Coin choice (ready,
    short with a progress line, limit) with the inline "Onaylarsan bakiyen" confirm, and retry/notice
    states; the copy is the web's. A Coin open is one `POST /v1/coach/weekly-recaps` with an
    Idempotency-Key and a success haptic. The story plays the web's eight slides with the same clock,
    beats, colours, decor, Puhu art and bundled clips (`expo-video`, muted, following the story clock;
    the still is the poster and the fallback): progress bars, play/pause/replay and close, tap halves, a
    press held past 300 ms pauses, a sideways swipe, background pauses it, Android back closes it. The
    last slide shows the share card and "Tekrar izle" / "Bitti"; when they show, the week is marked
    reviewed once (`PUT /v1/coaching/weekly-review/completion`), then the app asks for unseen
    celebrations so the "week_reflected" achievement is waiting. The lakap reveal gives one haptic. Reward
    scenes wait while the story is open and play after it closes. Headlines shrink with the window below a
    411 dp width, so a long Turkish word keeps its line (`headlineScale`). Story composition, playback, share
    facts and the access view moved to `@mentor/core` (`weekly-recap.ts`); the web re-exports them.
  - **Reduced motion:** the story starts paused, slides and beats fade in 120 ms, decor stands still; the
    last slide's actions show as soon as it is reached.
  - **Follow-up:** the mobile story now supports sharing the PNG card, viewing Puhu's note and deep
    analysis, adding a suggested task to Plan and opening past reports from the archive. The Coin
    limit, retry and notice states are checked by the web's
    `weekly-recap-access-view.spec.ts` (it runs the core function), not on a device. Checked on Android
    only, at 411×914 and 360×760 dp.
  - **Gotchas:** `Pressable` holds `onPressOut` back for a tap shorter than 130 ms (`minPressDuration`), so
    a tap that changes the slide never calls it: time a press with `event.nativeEvent.timestamp` and let go
    in `onPress`. Keep the tap zones outside the keyed slide, or a tap queued on a busy JS thread lands on
    the zone the last tap unmounted. `PanResponder` zeroes `dx` at the grant, and a busy JS thread grants
    late: measure a swipe from the touch-down `pageX`. Read a player's status from `player.status` when
    subscribing too (`useEvent` from `expo` is missing at runtime in Expo Go). expo-video's Android
    `currentTime` getter blocks on the UI thread: never read it on every clock tick (the clips check drift
    once a second, and only when `readyToPlay`).
  - **QA gotchas:** a video URL the emulator cannot reach stays "loading" (ExoPlayer retries); test the
    fallback with a URL that answers text, such as Metro's `/status`. `uiautomator dump` cannot finish
    while the story or a scene animates and `qa.sh ui` then reads the previous dump: trust screenshots.
    `useReducedMotion` is read once at app start: restart the app after changing the animation scale.
    Expo Go's dev gear sits over the story's close button. The API only lets the last week be newly
    opened; an older week opens to `NOT_FOUND`. On the local dev DB a READY week is three completed
    `study_sessions` on two or more days (plus `daily_activity`), PARTIAL is one; the Coin choice needs the
    earned allowance used (move the user's `EARNED` row in `ai_weekly_recaps` to another `week_start`);
    Coin is a `ledger_entries` row (`unit = 'COIN'`).
  - **Related files:** `apps/mobile/src/app/(app)/weekly-recap.tsx`,
    `apps/mobile/src/components/recap/*` (the panel card is `recap-teaser-card.tsx`; the pure steps,
    tested by `src/lib/recap-flow.spec.ts`, are `recap-flow.ts`),
    `apps/mobile/src/app/(app)/(tabs)/dashboard.tsx`, `apps/mobile/src/lib/{coaching-api,recap-opened,request-id,art}.ts`,
    `packages/core/src/weekly-recap.ts`, `docs/plans/2026-11-13-mobile-weekly-recap-{design,plan}.md`.

- **2026-11-13 — Reward scenes, part 1: Coin, achievement and level (`apps/mobile`):**
  - **What was done:** `CelebrationProvider` (`src/providers/celebration-provider.tsx`) asks the server what
    is still unseen on entry, on every screen change and when the app returns to the front, then plays one
    scene at a time and acknowledges it: Coin first, achievements in the order earned, level-ups last. Everyday
    XP and the daily Coin are a toast (`ToastProvider`), never a scene. Nothing plays over a running study
    session. The queue and receipt rules moved to `@mentor/core` (`celebration-queue.ts`, `reward-sync.ts`);
    the web files re-export them.
  - **Gotchas:** A glow must be a radial gradient (`react-native-svg`); a flat tinted disc reads as a grey
    plate on the night sky. Level art is square with a white ground: cut it round under the progress tint
    like the web's `JourneyLevelMedallion`. Turkish upper-casing dots the I of "Coin" (`COİN`); the Coin
    eyebrow restores `COIN`.
  - **Part 2 (same day): streak celebration + Puhu's thought cloud.** `StreakScene` is the web's
    `StreakCelebration` (peaked orange sheet, flame with the day count, seven-day row, "Devam ediyorum");
    the provider reads it off the `["coaching","today"]` query: the first value after sign-in is the
    baseline, any later growth (`didStreakCreditToday`, now in `@mentor/core`) plays it, so screens need
    no wiring. It goes before Coin and the server queue, but never replaces a scene already on screen.
    The web's animated `fire-anime.svg` cannot play in React Native, so the flame is drawn with
    `react-native-svg`. The mood reply moved from an inline card into `PuhuSpeechModal`
    (`components/panel/`): the web's cloud outline, the two-dot trail, Puhu's speaking frames (masked for
    Premium), letter-by-letter words; Premium gets `POST /v1/coach/mood-reflection` with Puhu "writing"
    until it lands, everyone else the rule-based line. The cloud waits while a reward scene is on screen
    (`useCelebrations().active`). The Plan screen now asks for unseen rewards after every change.
  - **Part 3 (same day): the weekly chest's opening scene.** `ChestScene` (`components/celebrations/`) is
    the web's `ChestScene` upright set: the 9:16 desk covers the screen from the desk up, one lamp per
    target day on the brass strip (lit ones twinkle), the title over the shelves and "Sandığı aç" /
    "Sonra" on the desk. Opening: the lamps flow into the lock, `chest-open-tall.mp4` plays (`expo-video`,
    muted, tap to skip, a clip that cannot play skips to the note), then the open still dims and blurs
    under the taped note (Caveat handwriting, `@expo-google-fonts/caveat`, glasses or mask signature) and
    the reward: Coin or XP, the cap-held message, or Puhu's "Pazartesi" bubble. One haptic where the
    web plays the Coin chime. A ready or opened chest on the panel opens the scene (an opened one goes
    straight to the note); a chest still filling does nothing yet. The chest's Coin receipt is held from
    the reward queue again (`isHeldChestReceipt`); `POST /v1/economy/weekly-chest/open` acknowledges it.
  - **Reduced motion:** every scene and the cloud read Reanimated's `useReducedMotion`: everything stands
    in place, no loops, words appear at once; the haptic stays. The chest skips the clip and crossfades the
    two stills.
  - **Not yet:** the weekly recap story; the chest's info sheet for a chest still filling and the app's
    "chest is ready" notice. Toasts replace each other instead of stacking. After a study session the
    streak scene plays once the student leaves the session screen (the web shows it on the session's
    done screen); not yet checked on a device. The chest scene is checked on Android only.
  - **Gotchas (chest):** `VideoView` inside a `Modal` must be `surfaceType="textureView"` and stay at full
    opacity: Android's default surface view, or a texture view set to opacity 0, punches a hole through
    the Modal's window and the panel shows through. A player with no source (reduced motion, revisit)
    reports `playToEnd` at once, so only the flow/clip phases react to it. Caveat leans right: the note's
    text keeps 4dp of right padding or Android clips the last letter.
  - **QA gotchas:** start Expo without `CI=1` (CI mode turns file watching off and the phone keeps an old
    bundle). `uiautomator dump` hangs while the streak scene's loops run; take a screenshot instead. A ready
    chest needs five active days: on the local dev DB, `daily_activity` rows (`has_session = true`) for the
    week's earlier days do it, and clearing `user_quest_progress.revealed_at` for
    `weekly.effort-allowance` puts an opened chest back to ready.
  - **Related files:** `apps/mobile/src/components/celebrations/{scene-shell,scenes,streak-scene,chest-scene}.tsx`,
    `apps/mobile/src/components/panel/{mood-row,puhu-speech-modal,chest}.tsx`,
    `apps/mobile/src/providers/{celebration,toast}-provider.tsx`,
    `apps/mobile/src/lib/{rewards-api,premium,art,fonts}.ts`, `apps/mobile/src/lib/chest-note.spec.ts`,
    `packages/core/src/{celebration-queue,reward-sync,streak-celebration}.ts`.

- **2026-11-21 — Faz 1: Full-Scope Mobile Topluluk Web-Parity & Android QA (`apps/mobile`):**
  - **What was done:** Enabled full student community scope (`STUDENT_CORE_ONLY = false` in `src/lib/release-scope.ts`, restoring the 5-tab `RoleTabBar` with `Topluluk` and moving `Ayarlar` behind the top-left avatar). Extended `resolveMobileNotificationDestination` (`src/lib/notifications-view.ts`) for `/community/{member,question,message,saved}` routes and forwarded `roomId` into `startStudySession` (`study-session.tsx`). Added `src/lib/{forum-api,forum-api-types,community-view}.ts`, upgraded `src/lib/community-api.ts` (`fetchPublicProfile`, `fetchProfileAchievements`, `followUser`, `unfollowUser`, `fetchFocusingNow`), built modular Community components (`src/components/community/{community-avatar,moderation-sheets,forum-poll-card,feed-post-card,community-composer-sheet,community-reply-card,community-hub-view,community-feed-view,forum-zones-view,study-rooms-view,leaderboard-view}.tsx`), rebuilt `(tabs)/community.tsx` (5-tab underline `SlidingTabs`: `Keşfet`, `Akış`, `Odalar`, `Masalar`, `Lig`), and added 4 Stack screens (`community-{thread,member,search,saved}.tsx`).
  - **Usage:** `pnpm --config.verify-deps-before-run=false --filter @mentor/mobile test | typecheck | lint`. Community tab opens Hub/Feed/Zones/Study Tables/League; Search & Saved open from the top header icons; threads, Q&A answers, comments, and member profiles push cleanly onto the `(app)` Stack with Android back unwinding.
  - **Gotchas:** (1) `(tabs)/_layout.tsx` already mounts `<AppHeader />`, so tab screens like `(tabs)/community.tsx` must NOT add `paddingTop: insets.top`. (2) `ForumQaService.getQuestion` omits `capabilities` on `question`/`answers`, so `FeedPostCard`/`CommunityReplyCard` combine `capabilities?.canDelete` with `user?.id === authorId` to display author Delete (and suppress self-Report). (3) On narrow `360 dp` screens inside a `20 dp`-padded `PanelCard`, `community-hub-view.tsx` stacks `heroActions` vertically (`useWindowDimensions().width < 390`) so `"Share something"` never truncates. (4) `SlidingTabs` accepts `items` (`{ id, label }`) + required `accessibilityLabel`, and `AppText` uses `variant="micro"` (no `"eyebrow"` variant).
  - **Verified on `Puhu_Pixel`:** `411 dp TR Light` (5-tab bar, Hub, Feed tabs/filters, Zones join/leave, Composer post creation + `Selam Topluluk!` celebration trigger, Q&A thread reply + emoji reaction + coach bridge + bookmark + Saved + delete + back navigation, Study Table create/invite/seats/close, All-Time & Weekly League + reset countdown, Search, Member Profile tabs/stats, Settings via avatar) and `360 dp EN Dark` (`Discover`, `Feed`, `Rooms`, `League`, `Chat` detail). Note: first-time `first_hello` achievement modal showed a transient dismiss error on device before succeeding (`204`) on direct API check.
  - **Related files:** `apps/mobile/src/lib/{release-scope,notifications-view,forum-api,forum-api-types,community-api,community-view}.ts`, `apps/mobile/src/i18n/{tr,en}.ts`, `apps/mobile/src/components/community/*`, `apps/mobile/src/app/(app)/(tabs)/community.tsx`, `apps/mobile/src/app/(app)/community-{thread,member,search,saved}.tsx`, `apps/mobile/src/app/(app)/study-session.tsx`.

- **2026-11-12 — Expo SDK 58, device function tour, design foundation & the Panel ("Bugün") at web parity (`apps/mobile`):**
  - **What was done:** Upgraded Expo SDK 53 → 58 (React Native 0.88, React 19.3, Reanimated 4) and taught Metro
    to resolve the monorepo's `./x.js` imports; the app had never booted before. Added the `STUDENT_CORE_ONLY`
    release flag (`src/lib/release-scope.ts`: community and the coach workspace hidden, coach accounts see
    `coach-on-web-screen.tsx`). Walked the student core loop on the Android emulator and fixed the blockers
    (signup payload, session restore on network errors, keyboard avoidance, reminder body, paginated memories,
    persisted theme/language, query cache cleared on account switch). Built the design foundation (Nunito in
    `src/lib/fonts.ts`, `AppHeader` + `ThemeLamp` + icon-only floating `RoleTabBar` in `src/components/navigation/`)
    and rebuilt the Panel from the web's phone layout in `src/components/panel/` (mood row, "Bugünün yolu" path
    card, week band, daily quests + weekly chest row, countdown, goal, journey, quest sheet, streak-rescue sheet,
    card-shaped skeleton). The path model moved to `@mentor/core` (`today-path.ts`) and the web re-exports it.
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`. After editing `packages/ui/src/tokens.ts`
    or `packages/core`, rebuild them (`pnpm --filter @mentor/ui build`, `pnpm --filter @mentor/core build`):
    the mobile app consumes both from `dist`.
  - **Gotchas:** The API's `AuthOriginGuard` lets the native app through only for non-admin paths with
    `X-Client-Platform: mobile`, no `Origin` and no `Cookie`. Mobile copy has no ICU plurals (the formatter only
    substitutes `{name}`). On Android, remount a rounded view whose fill changes from transparent to a colour
    (`key`), or it stays square. Restart Expo with `--clear` after installing packages.
  - **Not yet on mobile:** reward scenes (coin, achievement, streak, chest opening, weekly recap), notebooks,
    vision board editor, push notifications, in-app purchase; iOS is untested.
  - **Related files:** `apps/mobile/src/components/{navigation,panel}/*`, `apps/mobile/src/lib/{art,fonts,layout,premium,release-scope}.ts`,
    `apps/mobile/src/app/(app)/(tabs)/dashboard.tsx`, `packages/core/src/today-path.ts`, `packages/ui/src/tokens.ts`,
    `apps/api/src/common/auth/auth-origin.guard.ts`.

- **2026-11-09 — Phase 2.6 Friend Invites (`PUHU-XXXXXXXX`), Coin Notebook Slot Unlocks, Puhu Memory Preferences, Weekly Rhythm Recap & EAS Build Profiles (`apps/mobile`):**
  - **What was done:** Added mobile Friend Invite card (`apps/mobile/src/components/settings/friend-invite-card.tsx` in `settings.tsx` calling `GET /v1/economy/invite` and `POST /v1/economy/invite/redeem` with `normalizeInviteCode` from `@mentor/validation` and native `Share.share`), `+1` Custom Notebook Slot Coin unlock in `apps/mobile/src/components/dashboard/economy-quests-card.tsx` (`GET/POST /v1/economy/notebook-slots` with `Idempotency-Key`), Puhu communication style & consent memory card (`apps/mobile/src/components/coach/coach-profile-memory-card.tsx` in `coach.tsx` calling `GET/PATCH /v1/coach/profile` and `GET/DELETE /v1/coach/memories`), Weekly Rhythm Recap (`Mentor Wrapped` in `weekly-ritual-and-vision-card.tsx` calling `GET /v1/coaching/weekly-review`), virtualized `FlatList` in `notifications.tsx`, and EAS build/release profiles (`apps/mobile/eas.json` for `development`, `preview`, and `production`).
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`.
  - **Gotchas:** Coach accounts are excluded from `FriendInviteCard` (`!isCoach(user)`), matching backend invite eligibility rules. Notebook slot purchases must include both `Idempotency-Key` header and `{ expectedCost, expectedPurchasedSlots }` body.
  - **Related files:** `apps/mobile/eas.json`, `apps/mobile/src/lib/{coaching-api,coach-api}.ts`, `apps/mobile/src/components/settings/friend-invite-card.tsx`, `apps/mobile/src/components/coach/coach-profile-memory-card.tsx`, `apps/mobile/src/components/dashboard/{economy-quests-card,weekly-ritual-and-vision-card}.tsx`, `apps/mobile/src/app/(app)/notifications.tsx`.

- **2026-11-09 — Phase 2.5 Notification Center (`linkUrl` Deep-Link Router), Weekly Effort Chest, Vision Board & `Puhu’yla Planla` (`apps/mobile`):**
  - **What was done:** Extracted notification deep-link router (`resolveNotificationMobileRoute` in `packages/core/src/notifications.ts`) to map web/server notification `linkUrl`s (`/tr/panel`, `/koc/sohbet`, `/topluluk/oda/...`, `/plan`, `/analiz`, `/kocum`) to internal mobile routes while rejecting external URLs. Implemented `apps/mobile/src/lib/notifications-api.ts`, the mobile Notification Center & Channel Preferences screen (`apps/mobile/src/app/(app)/notifications.tsx`), the Dashboard Weekly Effort Chest & Goal/Vision Board card (`apps/mobile/src/components/dashboard/weekly-ritual-and-vision-card.tsx`), and the `Puhu’yla Haftalık Planı Uyarla` card (`apps/mobile/src/components/plan/puhu-plan-adapt-card.tsx` in `plan.tsx`).
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`. Open Notification Center from Dashboard header chip or Settings (`/(app)/notifications`).
  - **Gotchas:** Always resolve notification `linkUrl`s through `resolveNotificationMobileRoute` (`@mentor/core`) so external URLs cannot hijack in-app routing. `applyCoachPlanAdaptation` requires strict `MOVE`/`ADD` payloads with `planRevision` hash.
  - **Related files:** `packages/core/src/{notifications,core.spec}.ts`, `apps/mobile/src/lib/{notifications-api,coaching-api,coach-api}.ts`, `apps/mobile/src/app/(app)/notifications.tsx`, `apps/mobile/src/components/dashboard/weekly-ritual-and-vision-card.tsx`, `apps/mobile/src/components/plan/puhu-plan-adapt-card.tsx`, `apps/mobile/src/app/(app)/(tabs)/{dashboard,plan,settings}.tsx`.

- **2026-11-09 — Phase 2.4 Community (Study Tables, Forum & Effort League) & Human Coach (`Mentorship`) Workspace (`apps/mobile`):**
  - **What was done:** Extracted study-room error classification and invite code normalization helpers (`classifyStudyRoomJoinErrorCode`, `normalizeStudyRoomCode`, `STUDY_ROOM_THEMES`, `STUDY_ROOM_CAPACITIES`) into `@mentor/core` (`packages/core/src/community.ts`, re-exported in `apps/web/src/lib/study-rooms.ts`). Implemented `apps/mobile/src/lib/{community-api,mentorship-api}.ts`, the 3-tab mobile Community screen (`apps/mobile/src/app/(app)/(tabs)/community.tsx` + `src/components/community/{study-rooms-view,forum-zones-view,leaderboard-view}.tsx` covering `MASA-XXXXXX` study tables, exam-scoped Forum zones/threads/comments/positive emoji reactions, and effort-only XP Weekly League), the Human Coach mobile workspace (`apps/mobile/src/app/(app)/(tabs)/{students,coach-profile}.tsx` + `src/components/mentorship/{coach-overview-header,student-report-panel}.tsx` covering seat usage, rotating invite codes, cohort/student AI briefs, risk-sorted student roster, attention marks, standing notes, and homework assignment), and the Student's `"İnsan Koçum"` card (`apps/mobile/src/components/settings/my-coach-card.tsx` in `settings.tsx` with transparent KVKK data-scope preview & double opt-in accept).
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`.
  - **Gotchas:** Effort League ranks strictly XP (`Guardrail §0`); Forum carries zero Coin UI (`Guardrail §4 #3`); Human Coach views never receive raw Puhu chat, mood struggle notes, or notebook text (`Guardrail §4 #5`).
  - **Related files:** `packages/core/src/{community,core.spec}.ts`, `apps/mobile/src/lib/{community-api,mentorship-api}.ts`, `apps/mobile/src/components/{community,mentorship}/*`, `apps/mobile/src/components/settings/my-coach-card.tsx`, `apps/mobile/src/app/(app)/(tabs)/{community,students,coach-profile,settings}.tsx`.

- **2026-11-09 — Phase 2.3 Mock Exam Analysis, Mistake Notebook (`2/7/21` Days) & Puhu AI Coach Chat (`apps/mobile`):**
  - **What was done:** Extracted pure mock exam analysis & taxonomy helpers (`withScore`, `parseAnalysisTab`, `shouldNavigateAnalysisTab`, `paperSubjects`, `emptyScores`, `scoresFromMockExam`, `formatTrendDate`, `formatShortDate`, `trendForSparkline`, `subjectTotal`, `validateSubjectCounts`, `groupTopicsBySubjectName`) into `@mentor/core` (re-exported in `apps/web`). Implemented `apps/mobile/src/lib/{analysis-api,coach-api}.ts`, the 3-tab mobile Analysis & Mistake Notebook screen (`apps/mobile/src/app/(app)/(tabs)/analysis.tsx` + `src/components/analysis/{analysis-progress-view,mock-exam-entry-view,mistake-notebook-view}.tsx` covering Personal Record & Ghost comparison, Next Study Focus 1-click plan task, subject net averages, mock exam entry with auto-calculated blanks, and the `2/7/21`-day Mistake Notebook spaced review loop), and the mobile Puhu AI Coach Chat (`apps/mobile/src/app/(app)/(tabs)/coach.tsx` + `src/components/coach/coach-message-bubble.tsx` with conversation threads, starter & follow-up chips, verbatim `officialCountdown` data card, confirmable `ACCEPT`/`CANCEL` plan/session actions, RAG source badges, and `👍`/`👎` feedback).
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`. From recent mock exam cards in Analysis, tapping `"Puhu ile değerlendir"` navigates to `/(app)/(tabs)/coach` with a prefilled prompt.
  - **Gotchas:** Zero Coin UI in the Puhu chat zone (`Guardrail §4 #3`). Official exam countdowns inside chat replies always render as verbatim data cards (`Guardrail §4 #1`). Net scores are computed exclusively by the backend (`POST /v1/mock-exams`); mobile only auto-calculates `blank = total - correct - wrong` on input rows via `withScore` from `@mentor/core`.
  - **Related files:** `packages/core/src/{analysis,core.spec}.ts`, `apps/mobile/src/lib/{analysis-api,coach-api}.ts`, `apps/mobile/src/components/{analysis,coach}/*`, `apps/mobile/src/app/(app)/(tabs)/{analysis,coach}.tsx`.

- **2026-11-09 — Phase 2.2 Daily Ritual (Dashboard), Weekly Plan, Study Session (Pomodoro) & Streak Rescue (`apps/mobile`):**
  - **What was done:** Extracted pure `Europe/Istanbul` plan calendar helpers (`todayInIstanbul`, `todayIso`, `isPastDate`, `shiftDate`, `weekStart`, `weekDates`, `monthIsoBounds`, `formatDateLabel`, `formatWeekdayShort`, `formatDayNumber`, `formatMonthDayShort`, `formatWeekRangeLabel`, `monthStart`, `shiftMonth`, `stepMonth`, `formatMonthTitle`, `formatTimeRange`, `taskStats`, `weekCompletionStats`, `groupPlanTasksByDate`) and Pomodoro session helpers (`DEFAULT_SESSION_PRESETS`, `parseInitialMinutes`, `parseInitialBreakMinutes`, `parseInitialPreset`, `parseInitialSelectedPresetId`, `formatTimerDisplay`) into `@mentor/core` (re-exported in `apps/web`). Implemented `apps/mobile/src/lib/coaching-api.ts` and modular mobile screens for Dashboard (`mood-checkin-card.tsx`, `streak-and-countdown-row.tsx` with verbatim official countdown data card and Coin-based Streak Rescue, `today-tasks-card.tsx`, `economy-quests-card.tsx`), Weekly Plan (`week-strip.tsx`, `plan-task-composer.tsx`, `plan-task-list.tsx` with origin badges and past-date read-only guard), and Study Session (`use-mobile-session-timer.ts` with `AppState` foreground timestamp sync across `25_5`, `50_10`, `custom`, and `stopwatch` modes, `session-done-card.tsx` micro-reflection, and `study-session.tsx`).
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`. Tasks on Dashboard and Weekly Plan deep-link directly into `/(app)/study-session` with task ID, title, subject, and focus minutes pre-populated.
  - **Gotchas:** Official exam countdown is strictly rendered from server `CountdownDto` (`Guardrail §4 #1`). Timer calculation uses wall-clock `Date.now()` deltas + `AppState` active listeners so backgrounding never causes countdown drift.
  - **Related files:** `packages/core/src/{plan-dates,session,core.spec}.ts`, `apps/mobile/src/lib/coaching-api.ts`, `apps/mobile/src/components/{dashboard,plan,session}/*`, `apps/mobile/src/app/(app)/(tabs)/{dashboard,plan}.tsx`, `apps/mobile/src/app/(app)/study-session.tsx`.

- **2026-11-09 — Phase 2.1 Auth, Pilot Waitlist, 5-Exam Onboarding & SMS OTP Phone Verification (`apps/mobile`):**
  - **What was done:** Extracted onboarding step state machine (`nextOnboardingStep`, `previousOnboardingStep`, `onboardingProgress`, `ONBOARDING_MOTIVATION_KEYS`, `ONBOARDING_DAILY_GOALS`) and auth/waitlist flow helpers (`hasCompletedOnboarding`, `safeNextPath`, `postAuthDestination`, `isWaitlistOn`, `opensWaitlist`, `isWaitlistEmail`) into `@mentor/core` (re-exported in `apps/web`). Implemented full mobile `(auth)` screens (`welcome.tsx` 4-slide Puhu carousel, `login.tsx`, `signup.tsx` for Student & Coach with KVKK/terms consent, `forgot-password.tsx`, `waitlist.tsx`), the multi-step exam-agnostic Onboarding Wizard (`apps/mobile/src/app/(onboarding)/index.tsx` + `src/components/onboarding/*` across `KPSS · YKS · LGS · ALES · DGS`, KPSS variants, goal vision board upsert, daily focus goal, coach self-service registration, and `@username` setup), and Settings live 5-Exam switcher + Turkey SMS OTP verification (`src/components/settings/{exam-switcher-card,phone-verification-card}.tsx`).
  - **Usage:** `pnpm --filter @mentor/mobile dev | test | typecheck | lint`. Both Student and Coach accounts without `username && examType` are automatically routed to `/(onboarding)` via `hasCompletedOnboarding`.
  - **Gotchas:** Keep onboarding step files decomposed under `src/components/onboarding/*` (<250 lines per file). Never duplicate onboarding step order or waitlist admission checks outside `@mentor/core`.
  - **Related files:** `packages/core/src/{onboarding,auth-flow,core.spec}.ts`, `apps/mobile/src/app/(auth)/*`, `apps/mobile/src/app/(onboarding)/index.tsx`, `apps/mobile/src/components/onboarding/*`, `apps/mobile/src/components/settings/*`.

- **2026-11-09 — Phase 2.0 Shared Core & Mobile Foundation (`apps/mobile`):**
  - **What was done:** Extracted pure platform-agnostic navigation (`APP_NAV_ITEMS`, `filterVisibleNavItems`, `getMobileTabItemsForRole`, `isNavActive`), role surface routing (`isCoach`, `homePathForUser`, `isStudentOnlyPath`), feature availability gating (`blockedAppFeature`, `availableAppDestination`), and Turkish formatting (`greetingKeyForHour`, `firstName`, `dativeOf`, `genitiveOf`, `toLocaleUpper`) into `@mentor/core` (re-exported in `apps/web`). Added DOM-free `@mentor/ui/tokens` subpath export with `DESIGN.md` light/dark/scene tokens, radii, 3D play-ledge tokens, touch targets, and typography scale. Scaffolded `apps/mobile` (Expo SDK 58 + React Native 0.88 + Expo Router; upgraded from SDK 53 on 2026-11-11) with hardware-backed `expo-secure-store` refresh token rotation (`X-Client-Platform: mobile`), TanStack Query v5 (`AppState` focus sync), Zustand preferences, TR/EN voice-checked i18n catalog, base UI primitives (`AppText`, `Button`, `Card`, `Chip`, `TextField`, `Skeleton`, `StateView`), and role-aware `STUDENT` + `COACH` tab shell (`RoleTabBar`).
  - **Usage:** `pnpm --filter @mentor/mobile dev | typecheck | lint | test`. Configure `EXPO_PUBLIC_API_URL` for physical device testing.
  - **Gotchas:** Never import `@mentor/ui` root in `apps/mobile` (it depends on `react-dom` and `framer-motion`); always import `@mentor/ui/tokens`. Never create `+api.ts` routes in `apps/mobile/src/app`.
  - **Related files:** `packages/core/src/*`, `packages/ui/src/tokens.ts`, `packages/api-client/src/http.ts`, `apps/api/src/modules/identity/presentation/auth.controller.ts`, `apps/mobile/*`.
