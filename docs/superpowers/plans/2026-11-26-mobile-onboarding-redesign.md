# Mobile Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the mobile welcome screen and post-signup onboarding to the web's redesigned Puhu play flow (look, art, copy, avatar upload, push ask).

**Architecture:** Pure helpers (slide flow, welcome-seen flag, summary rows, asset map) live in `apps/mobile/src/lib/` with `node:test` specs. A new `components/onboarding-play/` kit mirrors the web's `components/onboarding-play/`; each step component is rewritten on that kit while the screen wiring in `app/(onboarding)/index.tsx` and the `@mentor/core` step machine stay as they are. Art and clips are `require`d from `apps/web/public` like the rest of the app.

**Tech Stack:** Expo SDK 58, RN 0.88, expo-router, TanStack Query, expo-video, expo-secure-store, expo-image-picker / existing `DevicePhoto` helpers, `@mentor/ui` tokens.

**Spec:** `docs/superpowers/specs/2026-11-26-mobile-onboarding-redesign-design.md`

## Global Constraints

- Branch `feature/APP-142-notebook-entry-manage`, no worktree, no branch switch; commit only when the owner says so (each task's "Commit" step = stage + propose message, owner commits).
- No API changes; no new art. Clips: `apps/web/public/visuals/onboarding/welcome-scene-{1..4}.mp4` + `-start.webp` / `-end.webp`. Puhu poses: `apps/web/public/mascot/puhu/motion/*.png`. Career art: `apps/web/public/mascot/career-3d/<group>.webp`.
- Play CTA: fill `#55ACEE`, ink `#0F2233`, 4dp ledge `#3B8FD0`, radius 16, headings weight 800. Surfaces follow the phone's light/dark; frost/scrim/window colours fixed (`--play-frost` `rgba(255,255,255,0.72)`, `--play-scrim` `rgba(17,17,17,0.6)`, window frame `#2C3D56`, light `#FFF3D1`, lamp `#FFD15C`).
- Copy: the web's strings word for word, TR + EN (`apps/web/messages/{tr,en}.json`: `welcome.*`, `onboarding.*`); the only new string is the slide-4 coach link "Koç musun?" / "Are you a coach?". No "Adım n / 7" text.
- Touch targets ≥ 44dp; every control has an accessibility label; reduced motion shows end stills and skips enter motion.
- No Premium sales anywhere in the flow. Components split before ~300 lines.
- Gates per task: `pnpm --filter @mentor/mobile typecheck`, `lint`, `test`.

## Review Focus

1. **Welcome clip refused / not ready** (low-power, slow decode): the poster must show and every button must work. → Task 3, `welcome-scene` falls back to `start` poster; QA step in Task 8.
2. **Returning logged-out user** (logout, failed restore, `(onboarding)` redirect with no user) must land on slide 4 with login one tap away, never on signup. → Task 1 test `welcomeStartStep(true) === 3`.
3. **Push permission already decided or unsupported** (denied before, Expo Go, no project id): no layer, "Devam" just saves and moves on; "Şimdilik geç" never waits on the OS prompt. → Task 6 test on `shouldAskPush`.
4. **Avatar upload fails or is too big** on the profile step: the step still saves name/username and moves on, with the error shown; one upload at a time. → Task 7 step.
5. **Coach on shared steps**: intro/exam/kpss/profile/complete render in the new look with coach copy; "Yolun hazır" shows no field Puhu and coach rows. → Task 1 test on `readySummaryRows` coach case, Task 8 QA.

---

### Task 1: Pure helpers — welcome flow, seen flag, summary rows, asset map

**Files:**
- Create: `apps/mobile/src/lib/welcome-flow.ts`, `apps/mobile/src/lib/welcome-flow.spec.ts`
- Create: `apps/mobile/src/lib/onboarding-summary.ts`, `apps/mobile/src/lib/onboarding-summary.spec.ts`
- Create: `apps/mobile/src/lib/onboarding-assets.ts` (requires only; no spec — `require` of images does not run under node:test)
- Modify: `apps/mobile/src/lib/session-store.ts` is NOT touched; the seen flag goes in `welcome-flow.ts`'s sibling `apps/mobile/src/lib/welcome-seen.ts` (SecureStore, like `session-store.ts`)

**Interfaces:**
- Produces (`welcome-flow.ts`, ported verbatim from `apps/web/src/app/[locale]/_components/welcome/welcome-flow.ts`): `WELCOME_SLIDES`, `type WelcomeStep = 0|1|2|3`, `nextWelcomeStep`, `previousWelcomeStep`, `welcomeSkipStep`, `isFinalWelcomeStep`, plus `welcomeStartStep(seen: boolean): WelcomeStep`.
- Produces (`welcome-seen.ts`): `loadWelcomeSeen(): boolean` (sync `SecureStore.getItem("mentor.welcome.seen.v1") === "1"`, false on throw), `markWelcomeSeen(): void`.
- Produces (`onboarding-summary.ts`): `type ReadyRow = { kind: "goal" | "field" | "reminder" | "exam" | "coach"; value?: string | number }`, `readySummaryRows(s: { role: "student" | "coach"; dailyGoalMinutes: number | null; careerGroup: CareerGroup | null; reminder: boolean; examType: ExamType | null }): ReadyRow[]` — order and coach rows copied from web `complete-step.tsx`; `shouldAskPush(status: "granted" | "denied" | "undetermined" | "unsupported"): boolean` (true only for `undetermined`).
- Produces (`onboarding-assets.ts`): `WELCOME_SCENES: readonly { video: number; start: number; end: number; tint: string }[]` (tints `#be9baa`, `#96a0bc`, `#d28e64`, `#14284e`), `PUHU_MOTION_FRAMES: Record<"default"|"gazeLeft"|"gazeRight"|"blink"|"wave"|"talkClosed"|"lookDown", number>`, `careerPuhu3d(group: CareerGroup): number`.

- [ ] **Step 1: Write failing specs**

```ts
test("welcomeStartStep: first open starts at slide 1, a returning user at slide 4", () => {
  assert.equal(welcomeStartStep(false), 0);
  assert.equal(welcomeStartStep(true), 3);
});
test("next/previous clamp and skip lands on the last slide", () => {
  assert.equal(nextWelcomeStep(3), 3); assert.equal(previousWelcomeStep(0), 0);
  assert.equal(welcomeSkipStep(), 3); assert.equal(isFinalWelcomeStep(3), true);
});
test("readySummaryRows: student with reminder lists goal, field, reminder", () => {
  assert.deepEqual(readySummaryRows({ role: "student", dailyGoalMinutes: 30, careerGroup: "SAGLIK", reminder: true, examType: "YKS" }).map(r => r.kind), ["goal", "field", "reminder"]);
});
test("readySummaryRows: coach never gets a field row", () => {
  assert.ok(!readySummaryRows({ role: "coach", dailyGoalMinutes: null, careerGroup: "SAGLIK", reminder: false, examType: "KPSS" }).some(r => r.kind === "field"));
});
test("shouldAskPush only when undecided", () => {
  assert.equal(shouldAskPush("undetermined"), true);
  for (const s of ["granted", "denied", "unsupported"] as const) assert.equal(shouldAskPush(s), false);
});
```
(Exact coach row kinds: copy from web `complete-step.tsx` and assert them.)

- [ ] **Step 2: Run `pnpm --filter @mentor/mobile test` — expect FAIL (modules missing).** Add the two spec globs if `src/lib/*.spec.ts` doesn't already cover them (it does).
- [ ] **Step 3: Implement the three modules + `welcome-seen.ts` + `onboarding-assets.ts`.** Check `career-3d` webps exist for every `CareerGroup`; `require` paths are relative like the existing `mascot/career` requires.
- [ ] **Step 4: Run gates — expect PASS.**
- [ ] **Step 5: Stage; propose `feat(mobile): onboarding play helpers and asset map`.**

### Task 2: Play kit — `components/onboarding-play/`

**Files:**
- Create: `apps/mobile/src/components/onboarding-play/{puhu-bubble.tsx, play-progress.tsx, play-choice.tsx, play-footer.tsx, play-button.tsx, minute-entry-card.tsx, play-step-layout.tsx, index.ts}`
- Delete after Tasks 4–7 migrate: `apps/mobile/src/components/onboarding/step-shell.tsx` (removed in Task 7's last step)

**Interfaces (mirror web names and props):**
- `PuhuBubble({ title: string; sub?: string; pose?: keyof typeof PUHU_MOTION_FRAMES })` — Puhu image left, bubble right, `accessibilityRole="header"` on title.
- `PlayTitle({ title: string; sub?: string; center?: boolean })`.
- `PlayProgress({ value: number /*0..1*/; onBack?: () => void; onSkip?: () => void; skipLabel?: string; backLabel: string })` — bar only, no step text.
- `PlayIconWell({ well: "blue"|"peri"|"violet"|"coral"|"pink"; children })`, `PlayOptionRow({ label; sub?; icon?; well?; selected; onPress })`, `PlayGridCard({ label; image?: number; icon?; well?; selected; onPress })` — `accessibilityState={{ selected }}`, ≥ 44dp.
- `PlayButton({ label; onPress; disabled?; loading?; variant?: "primary" | "ghost" })` — ledge via bottom border/offset view, pressed state drops the ledge.
- `PlayFooter({ error?: string | null; children })`.
- `MinuteEntryCard` — props as web `minute-entry-card.tsx`.
- `PlayStepLayout({ progress: PlayProgressProps; heading: ReactNode; children; footer: ReactNode; scroll?: boolean })` — safe-area aware; replaces `OnboardingStepShell`.

- [ ] **Step 1:** Build the kit against `@mentor/ui` tokens (`playSelected`, `playLine`, `playTrack`, wells) + the CTA constants from Global Constraints (add them to `@mentor/ui` tokens as `playCta`, `playCtaInk`, `playCtaLedge` if absent — new tokens are allowed).
- [ ] **Step 2:** Gates pass (no consumers yet).
- [ ] **Step 3:** Stage; propose `feat(mobile): onboarding play kit`.

### Task 3: Welcome — four scenes, seen flag, coach link

**Files:**
- Modify: `apps/mobile/src/app/(auth)/welcome.tsx` (becomes a thin screen)
- Create: `apps/mobile/src/components/welcome/{welcome-scene.tsx, welcome-carousel.tsx, welcome-sheet.tsx}`
- Modify: `apps/mobile/src/i18n/{tr,en}.ts` `welcome.*` (web strings; add `coach_link`)

**Interfaces:**
- Consumes: Task 1 `WELCOME_SCENES`, flow helpers, `loadWelcomeSeen`/`markWelcomeSeen`; Task 2 `PlayButton`.
- `WelcomeScene({ scene; active: boolean; still: boolean })` — `expo-video` `useVideoPlayer`, muted, no loop; on `active` seek 0 + play; inactive pause; poster `start` until first frame; `still` (reduced motion) renders `end` image. Pattern: `components/recap/recap-character-video.tsx`.
- Carousel: horizontal paged list, initial index `welcomeStartStep(loadWelcomeSeen())`; mark seen when slide 4 is reached or "Atla" is tapped.
- Sheet: slides 1–3 "Devam et" + "Atla"; slide 4 "Başlayalım" → signup (or waitlist when `isWaitlistOn`), "Zaten hesabım var" → login, small "Koç musun?" link → `/(auth)/signup?role=coach` or `/(auth)/waitlist?role=coach`.

- [ ] **Step 1:** Port web copy for `welcome.*` (TR/EN); `i18n.spec.ts` must stay green.
- [ ] **Step 2:** Build the three components; keep `STUDENT_CORE_ONLY` and waitlist routing exactly as today.
- [ ] **Step 3:** Gates pass.
- [ ] **Step 4:** Emulator: cold start shows slide 1 playing; swipe/“Devam et”/“Atla” move; logout → slide 4; TalkBack reads each slide. Screens to `apps/mobile/.expo/qa/<date>-onboarding-redesign/`.
- [ ] **Step 5:** Stage; propose `feat(mobile): welcome scenes like the web`.

### Task 4: Intro, exam, KPSS level

**Files:** Modify `apps/mobile/src/components/onboarding/exam-steps.tsx` (split into `intro-step.tsx`, `exam-step.tsx`, `kpss-level-step.tsx`); `app/(onboarding)/index.tsx` imports only; `i18n` `onboarding.*` keys for these steps from web `onboarding.welcome|exam|kpss_level`.

- [ ] **Step 1:** Rebuild each on `PlayStepLayout` + `PuhuBubble`: intro uses the `wave` pose and button "Devam"; exam uses `PlayOptionRow` with icon wells like web `exam-step.tsx` (drop the mobile "Net: D - Y/4" line and extra subtitle); KPSS level as web. Coach titles unchanged in meaning (web coach keys).
- [ ] **Step 2:** Saves unchanged (same API calls, same `setUserFromServer`).
- [ ] **Step 3:** Gates; stage; propose `feat(mobile): play look for intro, exam and KPSS level`.

### Task 5: Why and field

**Files:** Modify `apps/mobile/src/components/onboarding/vision-steps.tsx` (split `why-step.tsx`, `field-step.tsx`; keep `saveOnboardingVision`).

- [ ] **Step 1:** Why: 2-column `PlayGridCard` with icon wells from web `MOTIVATIONS`; bubble `sub` switches to `reactions.<selected>` like web.
- [ ] **Step 2:** Field: 3-column `PlayGridCard` with `careerPuhu3d(group)`; in dark theme show the art on a rounded light tile (web behaviour).
- [ ] **Step 3:** Gates; stage; propose `feat(mobile): play look for why and field`.

### Task 6: Daily goal and push ask

**Files:** Split `goal-profile-steps.tsx` → `daily-goal-step.tsx`; create `apps/mobile/src/components/onboarding/push-permission-layer.tsx`.

**Interfaces:** Consumes `shouldAskPush` (Task 1), `registerDeviceForPushNotifications({ requestPermission: true })` from `lib/push-notifications.ts`; current status from `Notifications.getPermissionsAsync()` (map to the four statuses; Expo Go / missing project id → `unsupported`). Produces `onContinue(minutes, reminder: boolean)` so the screen passes `reminder` into the complete step's summary.

- [ ] **Step 1:** 2-column cards with Puhu poses (15/30/60/90), note "İstediğin zaman değiştirebilirsin"; keep `MinuteEntryCard` only if web keeps a custom entry (web has `minute-entry-card.tsx` → keep).
- [ ] **Step 2:** "Devam" handler: save goal; if `shouldAskPush` → show Puhu layer (`--play-scrim`, `PuhuBubble`, "Şimdilik geç") and race the registration against skip, like web `usePushPermissionAsk`; `reminder = result.status === "registered"`.
- [ ] **Step 3:** Gates; emulator: first run shows the layer and the Android prompt; deny → moves on with no reminder row; second account with permission granted → no layer.
- [ ] **Step 4:** Stage; propose `feat(mobile): daily goal cards and push ask`.

### Task 7: Profile (avatar) and coach profile

**Files:** Create `apps/mobile/src/lib/avatar-upload.ts`; split `goal-profile-steps.tsx` → `profile-step.tsx`, `coach-profile-step.tsx`; modify `components/settings/profile-edit-sheet.tsx` to use the helper; delete `step-shell.tsx` and `goal-profile-steps.tsx` once nothing imports them.

**Interfaces:** `uploadAvatar(photo: DevicePhoto): Promise<string /*storage key*/>` — moved from `profile-edit-sheet.tsx` (`/v1/users/me/avatar-upload-url`, size check against `upload.maxBytes`, `putDevicePhoto`); throws `Error` with the existing `edit_avatar_*` messages' keys left to the caller. Type/size pre-checks (`image/jpeg|png`, 2 MB) stay with the caller.

- [ ] **Step 1:** Extract `uploadAvatar`; settings sheet behaviour unchanged (re-test avatar change once).
- [ ] **Step 2:** Profile step: optional round avatar picker (gallery) above name/username like web `profile-step.tsx`; the save sends `avatarStorageKey` only when a photo uploaded; an upload error shows under the picker and does not block saving the rest; Continue disabled while uploading.
- [ ] **Step 3:** Coach profile restyled on the kit, same fields and save.
- [ ] **Step 4:** Gates; stage; propose `feat(mobile): profile photo in onboarding, coach profile play look`.

### Task 8: Complete ("Yolun hazır") + full-flow QA

**Files:** Create `apps/mobile/src/components/onboarding/{complete-step.tsx, ready-window.tsx}`; modify `app/(onboarding)/index.tsx` to pass `reminder` and role into the summary.

- [ ] **Step 1:** `ReadyWindow({ career: CareerGroup | null })` — lit window colours from Global Constraints, `careerPuhu3d(career)` or `PUHU_MOTION_FRAMES.default`; coach gets no field Puhu (default pose).
- [ ] **Step 2:** Summary from `readySummaryRows` with web icons/wells; title "Yolun hazır." (web punctuation); CTA replaces to the panel (no cloud animation).
- [ ] **Step 3:** Gates.
- [ ] **Step 4:** Emulator QA with a fresh student test account (never write the password) and, if available, a coach signup via "Koç musun?": every step saves, back works, skip works, dark + light theme, font scale 1.3, TalkBack spot check, reduced motion. Record in the ledger (`.superpowers/parity/2026-11-25-mobile-dev/ledger.md`, O-1/O-2/O-3 → fixed) with screenshots.
- [ ] **Step 5:** Stage; propose `feat(mobile): Yolun hazır window and summary`.
