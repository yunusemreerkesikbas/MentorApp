# Mobile Plan Tab, Stop C (Puhu'yla planla) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mobile Plan tab gets the web's "Puhu'yla planla": the entry row, the Coin choice
sheet, the four-step wizard, the "Şehrin üstünde" waiting stage, and the preview with apply. The
panel's "Bugünü hafiflet" runs the MOOD flow for students the web lets through.

**Architecture:**
- The web's pure helpers move to `@mentor/core` (two new modules); the web files become re-exports,
  so no web import site changes. Core gains a `@mentor/validation` dependency.
- Mobile gets a plan-previews API file, a pure `lib/plan-puhu.ts` (the flow's decisions, all
  unit-tested), shared Coin "açma" rows extracted from the recap card, and
  `components/plan/puhu/*`: a controller with an imperative `open(input)`, the sheet, the wizard,
  the stage and the preview.
- The wizard and the stage share one full-screen host `Modal`. The sheet and the preview are the
  existing `BottomSheet` / `FormSheet`. A hand-off between two modals goes through a dismiss queue
  (iOS waits for `onDismiss`; Android runs at once).
- **Commits:** none. The owner commits when they ask.

**Tech Stack:** TypeScript, `@mentor/core` (node:test against `dist`), Next.js web (Vitest),
Expo SDK 58 / RN 0.88 Fabric / Expo Router / TanStack Query v5 / Reanimated 4 / expo-video /
react-native-svg.

**Spec:** `docs/plans/2026-11-14-mobile-plan-puhu-design.md` (owner-approved 2026-11-14)

## Global Constraints

- **Branch and files:** branch `feature/APP-142-mobile-core-qa`. Touch only files this plan names.
  Other sessions' uncommitted work stays as it is: landing, SEO, consent, forum, community,
  `docs/standards/api.md`, `web-shell.md`, the promo doc, and the communityDiscovery keys in
  `apps/web/messages/*.json`. The web message files are read only.
- **Packages:**
  - After a `packages/core` change, run `pnpm --filter @mentor/core build`, because mobile and the
    core specs read `dist`.
  - After `package.json` dependency edits, run `pnpm install`.
  - Core specs import `../dist/index.js`. Mobile specs live in `apps/mobile/src/lib/*.spec.ts` and
    import `.ts` directly. They cannot import `@mentor/api-client`, so match the error by
    `error.name === "ApiClientError"`.
- **No Premium on the phone:**
  - `planAccessView(offer, false)`: purchases are always off. There is no Premium row, trial, link
    or paywall.
  - For `PAYMENT_PREMIUM_REQUIRED`, the phone shows `planCoin.phone_closed`, never the server's
    message:
    - TR "Puhu'yla planlama şu an telefonda açık değil."
    - EN "Planning with Puhu isn't open on the phone right now."
- **Copy:**
  - The web's TR/EN strings are copied verbatim. `plan.coach_adaptation_*` keep their names in
    mobile `plan`. `plan.coin_preview.*` go to a new flat namespace `planCoin` under the same key
    names. `plan.coach_adaptation_evidence.*` go to a new namespace `planEvidence`, keyed by
    evidence type, plus `OTHER`.
  - The Premium-only keys are left out: `trial`, `premium`, `premium_title`, `premium_detail`,
    `coin_how`.
  - The mobile formatter fills `{name}` only, so the ICU strings are split:
    - `planCoin.limit_title` is rewritten count-neutral, like the recap's `access_limit_title`:
      TR "Bugünkü taslak hakkını kullandın, süper!", EN "You've used today's drafts, nice!".
    - `planCoin.next_available` becomes `next_available_today` and `next_available_tomorrow`:
      TR "Sıradaki taslak hakkın bugün {time}'{suffix} geliyor." and the "yarın" twin;
      EN "Your next draft arrives today at {time}." and "…tomorrow at {time}.".
    - `plan.coach_adaptation_stage_days` and `_stage_subjects` become `_one` / `_other` pairs. TR
      `_one` equals `_other`; EN is "{count} day" / "{count} days", "{count} subject" /
      "{count} subjects".
  - `i18n.spec.ts` enforces TR/EN parity and bans the em dash, "lütfen" and "AI" in TR.
- **Theme:**
  - Sheet, wizard and preview colours come from `useThemeTokens().palette`.
  - The stage keeps its own night palette in one constant `STAGE_NIGHT` (web `plan-coach-stage.css`):
    - sky `#0d0e25` → `#132552` (74%) → `#1b3563`, video ground `#08113A`;
    - on-night text `#ffffff`, soft `#c9d6ea`, caption `#e4ecf8`, lamp `#ffd15c`;
    - paper `#fffdf6`, sheets `#f9f5ea` / `#f4efe2`, ink `#0f2233`, label `#1a5fa3`,
      tape `rgba(255,224,138,0.88)`.
- **Android at density 2.625:** single-line labels get `numberOfLines`; a rounded view whose fill
  changes gets a `key` remount; every write guards against a second tap with a ref.
- **Gate before done:**
  - `pnpm --filter @mentor/core test`;
  - `pnpm --filter @mentor/web test`;
  - `pnpm --filter @mentor/mobile test`, `typecheck` and `lint`.
  - The web typecheck's reds come only from `apps/web/test-results` (do not delete that folder).
- **Secrets:** never print the QA account email or password (`apps/mobile/.expo/qa-accounts.json`).

## Review Focus

1. **A second tap or a retry spends Coin twice.** One quote is one `clientRequestId`, a retry of the
   same quote reuses it, and a second confirm while busy does nothing. Test: Task 3
   `newCoinQuote` keeps its id; Task 9 `busyRef` guard plus an emulator double-tap on "Onayla ve
   devam et".
2. **"Vazgeç" or Android back on the stage after a Coin confirm.** The UI drops the late answer.
   The draft lands server-side, and "Kayıtlı taslağımı aç" opens it without a second charge. Test:
   Task 9 run counter; Task 11 scenario.
3. **The coach's brief lands after the student already changed an answer.** The student's choice
   wins; the seed only fills untouched answers. Test: Task 6 `planBriefAnswers` cases.
4. **"Next draft today/tomorrow" around midnight Istanbul.** The day word follows Istanbul dates,
   not the device clock zone. Test: Task 5 `nextAvailableParts` cases at 23:50 and 00:10.
5. **Apply on a plan that changed meanwhile (409).** The plan refetches, the error shows, "Yeniden
   hazırla" appears, and nothing is half-applied. Test: Task 11 scenario (edit a task on the web
   between preview and apply).

---

### Task 1: Access and entitlement helpers move to `@mentor/core`

**Files:**
- Create: `packages/core/src/plan-access.ts`, `packages/core/src/plan-access.spec.ts`
- Modify: `packages/core/src/index.ts` (`export * from "./plan-access.js";`)
- Modify: `apps/web/src/app/[locale]/(app)/plan/_components/plan-coin-view.ts` and
  `apps/web/src/lib/premium-feature.ts`: each becomes a re-export only.

**Interfaces:**
- Produces (bodies moved verbatim from `plan-coin-view.ts` and `premium-feature.ts`):
  - `type PlanAccessView`, as the web's union;
  - `planAccessView(offer: PlanPreviewAccessDto, purchases: boolean): PlanAccessView`;
  - `clockSuffix(time: string): string`;
  - `COIN_SHEET_ERRORS: Set<string>`;
  - `isPremiumFeatureAvailable(view: SubscriptionView | null | undefined, featureId: PremiumFeatureId): boolean`.

- [ ] **Step 1: Write the failing core spec.** Port the cases of web `plan-coin-view.spec.ts` to
  node:test, using the same `offer()` / `denied()` builders. Add:
  - `planAccessView(denied("PAYMENT_PREMIUM_REQUIRED", { mode: "NONE" }), false).kind === "paywall"`;
  - `planAccessView(denied("INSUFFICIENT_COIN"), false)` deep-equals
    `{ kind: "choice", lead: null, coin: "short", premium: false, missing: 0 }`, with
    `coinConfirmed: 150, cost: 200` giving `missing: 50`;
  - `clockSuffix("21:40") === "ta"`, `clockSuffix("09:15") === "te"`, `clockSuffix("21:00") === "de"`;
  - `isPremiumFeatureAvailable(null, "plan.ai") === false`;
  - an `isPremium: true` view gives true;
  - `{ isPremium: false, features: { "plan.ai": { freeEnabled: true } } }` gives true.
- [ ] **Step 2: Run it and see it fail.** Run `pnpm --filter @mentor/core build && pnpm --filter
  @mentor/core test`. Expected: FAIL, the exports are missing.
- [ ] **Step 3: Move the code.** Move both bodies into `plan-access.ts` (types from
  `@mentor/types`). The two web files become `export { … } from "@mentor/core";`.
- [ ] **Step 4: Run the tests and see them pass.** Run the core build and test, then `pnpm --filter
  @mentor/web test`. Expected: all PASS. Web `plan-coin-view.spec.ts` passes through the re-export.

### Task 2: Brief, stage and preview-row helpers move to `@mentor/core`

**Files:**
- Create: `packages/core/src/plan-adaptation.ts`, `packages/core/src/plan-adaptation.spec.ts`
- Modify: `packages/core/package.json`: add `"@mentor/validation": "workspace:*"` to
  `dependencies`, then run `pnpm install`.
- Modify: `packages/core/src/index.ts`
- Modify (re-export only):
  - `apps/web/src/app/[locale]/(app)/plan/_components/plan-coach-adaptation-brief-note.ts`;
  - `.../plan-coach-stage-scene.ts`;
  - `apps/web/src/lib/plan-coach-adaptation-utils.ts`.

**Interfaces:**
- Produces (bodies moved verbatim):
  - `PLAN_ADAPTATION_NOTE_MAX = 500`, `PLAN_ADAPTATION_MINUTE_CHOICES` (= validation's
    `PLAN_ADAPTATION_MINUTES`, `[60,120,240,360]`);
  - `interface PlanAdaptationKnownWeek { pendingCount: number; subjects: readonly string[] }`;
  - `summarizePendingWeek(weekTasks: Record<string, readonly { status: string; subject: string | null }[]>): PlanAdaptationKnownWeek`;
  - `seedBriefSubjects(options: readonly string[], known: readonly string[]): string[]`;
  - `isMinuteEntry(value: number | null): value is number` (10–600);
  - `interface PlanWindowDay { weekday: number; date: Date }`, `planWindowDays(today: Date): PlanWindowDay[]`,
    `planWindowToday(): PlanWindowDay[]`;
  - `formatKnownBrief(parts: { exam: string | null; goal: string | null; pending: string | null }): string | null`;
  - `STAGE_TIMING` (`lineMs: 3600`, `slowAfterMs: 12000`, `arrivalMs: 1200`), `STAGE_MAX_NOTES = 6`,
    `stageNotes(brief)`, `stageNoteIndex(elapsedMs, count)`, `stagePileDepth(elapsedMs, count): 0 | 1 | 2`;
  - `interface PlanAdaptationRow { key: string; date: string; change: CoachPlanAdaptationChangeDto }`,
    `flattenPlanAdaptationChanges(changes)`, `selectedPlanAdaptationChanges(rows, selected)`,
    `parsePlanAdaptationQuery(input: { coach: string | null; source: string | null; sessionId: string | null }): CoachPlanAdaptationInput | null`.

- [ ] **Step 1: Write the failing core spec.** Port the cases of the three web specs
  (`plan-coach-adaptation-brief-note.spec.ts`, `plan-coach-stage-scene.spec.ts`,
  `lib/plan-coach-adaptation-utils.spec.ts`) to node:test. Keep at least:
  - `summarizePendingWeek` counts only `PENDING` and de-duplicates subjects case-insensitively in TR;
  - `isMinuteEntry(9) === false`, `isMinuteEntry(10) === true`, `isMinuteEntry(600) === true`,
    `isMinuteEntry(12.5) === false`;
  - `planWindowDays(new Date(2026, 10, 14))[0].weekday === 6` (a Saturday), with 7 days;
  - `stageNoteIndex(7200, 3) === 2`, `stageNoteIndex(10800, 3) === 0`,
    `stagePileDepth(36000, 2) === 1`;
  - `parsePlanAdaptationQuery({ coach: "adapt", source: "mood", sessionId: null })` deep-equals
    `{ source: "MOOD" }`, and `coach: null` gives null;
  - flatten keys: `MOVE:<taskId>` and `ADD:<date>:<index>`.
- [ ] **Step 2: Run it and see it fail.** Run the core build and test. Expected: FAIL, the exports
  are missing.
- [ ] **Step 3: Move the code.** Move the three bodies into `plan-adaptation.ts`; they import from
  `@mentor/validation`. The web files become re-exports.
- [ ] **Step 4: Run the tests and see them pass.** Run the core build and test, the web test, and
  `pnpm --filter @mentor/mobile test`. Expected: all PASS. The mobile specs still load core `dist`
  with its new validation import.

### Task 3: Mobile API, copy and the flow's pure decisions

**Files:**
- Create: `apps/mobile/src/lib/plan-previews-api.ts`
- Create: `apps/mobile/src/lib/plan-puhu.ts`, `apps/mobile/src/lib/plan-puhu.spec.ts`
- Modify: `apps/mobile/src/lib/plan-view.ts` and its spec (`apiErrorCode`)
- Modify: `apps/mobile/src/lib/premium.ts` (`useSubscriptionView`)
- Modify: `apps/mobile/src/i18n/tr.ts`, `en.ts` (copy per Global Constraints)

**Interfaces:**
- Produces, `plan-previews-api.ts`, mirroring web `lib/plan-previews.ts` with the same headers:
  - `fetchPlanPreviewAccess(): Promise<PlanPreviewAccessDto>`
  - `fetchCoinPlanBrief(): Promise<CoachPlanAdaptationBriefDto | null>` (null on failure, like
    `fetchPlanAdaptationBrief`)
  - `fetchSavedPlanPreview(id: string): Promise<SavedPlanPreviewDto>`
  - `createCoinPlanPreview(body: CoinPlanPreviewInput): Promise<SavedPlanPreviewDto>`
    (`Idempotency-Key: body.clientRequestId`)
  - `confirmCoinPlanPreview(id: string, expectedCost: number): Promise<SavedPlanPreviewDto>`
    (`Idempotency-Key: id`)
- Produces, `plan-view.ts`: `apiErrorCode(error: unknown): string | null`. It reads
  `error.body.code` when `error.name === "ApiClientError"`.
- Produces, `premium.ts`: `useSubscriptionView(): SubscriptionView | null`. It uses the same
  `["subscription"]` query; `useIsPremium` uses it.
- Produces, `plan-puhu.ts`:
  - `type PlanInput = Extract<CoachPlanAdaptationInput, { source: "PLAN" }>`;
  - `interface StageProgress { done: number; total: number }`;
  - `interface PlanCoinQuote { requestId: string; cost: number; input: PlanInput; progress: StageProgress | null; resume: boolean }`;
  - `interface PlanCoinSheetState { armed: boolean; error: string | null; pending: { input: PlanInput; progress: StageProgress | null } | null; resume: PlanCoinQuote | null }`;
  - `newCoinQuote(pending: NonNullable<PlanCoinSheetState["pending"]>, cost: number, id?: string): PlanCoinQuote`.
    The id defaults to `newRequestId()`; tests pass one.
  - `planOpenStep(offer: PlanPreviewAccessDto): "saved" | "wizard" | "sheet"`:
    - `"saved"` when `mode !== "COIN" && !canGenerate && latestRequestId`;
    - `"wizard"` when `planAccessView(offer, false).kind === "wizard"`;
    - otherwise `"sheet"`.
  - `planNoticeText(offer: PlanPreviewAccessDto, phoneClosed: string): string`. It returns
    `phoneClosed` for `reason === "PAYMENT_PREMIUM_REQUIRED"`, else `offer.message ?? ""`.
  - `createDismissQueue(platform: string): { queue(run: () => void): void; flush(): void }`. On
    `"ios"` it holds the run until `flush()` (called from the closing modal's `onDismiss`).
    Elsewhere it runs at once.

- [ ] **Step 1: Write the failing specs.** In `plan-puhu.spec.ts`:
  - `planOpenStep`: all three outcomes; an `INCLUDED` offer that can generate gives `"wizard"`;
    a `NONE` offer with `PAYMENT_PREMIUM_REQUIRED` and no draft gives `"sheet"`;
  - `planNoticeText` gives the phone line for `PAYMENT_PREMIUM_REQUIRED` and the server message for
    `AI_RATE_LIMITED`;
  - `newCoinQuote(p, 200, "id-1")` gives `{ requestId: "id-1", cost: 200, resume: false, … }`.
    Two calls without an id give different ids;
  - `createDismissQueue("android")` runs at once. `"ios"` runs only on `flush()`, then once only
    (a second `flush()` does nothing).
  In `plan-view.spec.ts`: `apiErrorCode(Object.assign(new Error("x"), { name: "ApiClientError",
  body: { code: "INSUFFICIENT_COIN" } })) === "INSUFFICIENT_COIN"`, and a plain `Error` gives null.
- [ ] **Step 2: Run and see it fail.** Run `pnpm --filter @mentor/mobile test`. Expected: FAIL,
  missing exports.
- [ ] **Step 3: Implement** the three lib files, `useSubscriptionView`, and the copy (TR and EN).
- [ ] **Step 4: Run and see it pass.** Run the mobile test and typecheck. Expected: PASS. This
  includes the i18n parity and ban checks over the new namespaces.

### Task 4: Shared Coin "açma" rows

**Files:**
- Create: `apps/mobile/src/components/unlock/unlock-rows.tsx`
- Modify: `apps/mobile/src/components/recap/recap-access-card.tsx` (uses them; no visual change)

**Interfaces:**
- Produces (moved from the recap card's private parts, styles included):
  - `UnlockRow({ title, icon?, aside?, flush?, children? })`
  - `UnlockCaption({ children, tone? })`
  - `UnlockPips({ limit, remaining, label, text })`
  - `UnlockConfirm({ title, lead, from, to, note, confirmLabel, cancelLabel, busy, onConfirm, onCancel })`:
    the recap's confirm block, with its Coin glyph and from → to line.

- [ ] **Step 1: Move the parts.** The recap card imports them. It keeps its cover, body order,
  footer and copy.
- [ ] **Step 2: Verify no change.** Run mobile typecheck and lint. Expected: clean. On the emulator,
  the weekly recap access card looks the same before and after, in its confirm state and its Coin
  row. Compare screenshots taken with `qa.sh shot`.

### Task 5: Choice sheet

**Files:**
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-coin-sheet.tsx`
- Modify: `apps/mobile/src/components/panel/primitives.tsx` (`BottomSheet` gains optional `onDismiss`)
- Modify: `apps/mobile/src/lib/plan-puhu.ts` and its spec (`nextAvailableParts`)

**Interfaces:**
- Consumes: `planAccessView`, `clockSuffix` (Task 1); `PlanCoinSheetState`, `planNoticeText`
  (Task 3); `UnlockRow`, `UnlockCaption`, `UnlockPips`, `UnlockConfirm` (Task 4); `ProgressLine`,
  `BottomSheet` (`components/panel/primitives.tsx`).
- Produces:
  - `nextAvailableParts(iso: string, now: Date): { day: "today" | "tomorrow"; time: string }`.
    `time` is `HH:mm` in Europe/Istanbul. `day` compares Istanbul calendar dates.
  - `PlanPuhuCoinSheet({ offer, sheet, busy, onArm, onConfirm, onCancel, onRetry, onSaved, onClose, onDismiss })`.
    `BottomSheet` gains an optional `onDismiss` prop, passed to its `Modal`.
- Behaviour (web `plan-coin-sheet.tsx` with purchases off):
  - Title `planCoin.title`, `sheet.error` as an alert line.
  - `choice`: the `choose` heading, then the Coin row: `coin_title` (or `limit_title`), and
    `balance` or `{balance}/{cost}` aside. Below it, the allowance pips, or for `short` the
    progress line (`coin_progress`). Then the caption: `coin_ready`, `coin_short`, or
    `next_available_{today|tomorrow}` with `clockSuffix`. A `coin` button when `coin === "ready"`
    arms the confirm.
  - The confirm block shows when `resume`, or when armed and ready. Its title is `resume_title` or
    `coin_title`; then `confirm_lead`, the balance → `coin_amount` (balance − cost), the `resume_note`
    or `confirm_note` note, and the `resume_confirm` or `confirm` and `cancel` buttons.
  - `retry`: `unavailable_title` row, `unavailable_detail`, a secondary `retry` button.
  - `notice` and `paywall`: `planNoticeText(offer, t("phone_closed"))`.
  - Without the confirm block: `saved_detail` under a choice. "Kayıtlı taslağımı aç" (`saved`) as
    a text link when `offer.latestRequestId`.
  - Close is disabled while busy.

- [ ] **Step 1: Write the failing spec.** For
  `nextAvailableParts("2026-11-14T21:05:00.000Z", new Date("2026-11-14T20:50:00.000Z"))`, the
  Istanbul times are 00:05 next day and 23:50 now, so it gives `{ day: "tomorrow", time: "00:05" }`.
  The same iso with now `2026-11-14T21:10:00.000Z` (00:10 Istanbul) gives `{ day: "today", time: "00:05" }`.
- [ ] **Step 2: Run and see it fail.** Expected: FAIL.
- [ ] **Step 3: Implement** `nextAvailableParts` and the sheet.
- [ ] **Step 4: Run and see it pass.** Mobile test, typecheck, lint. Expected: PASS. The sheet is
  checked on the device in Task 11.

### Task 6: Wizard

**Files:**
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-wizard.tsx` (shell, state, navigation)
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-wizard-steps.tsx` (the four bodies)
- Modify: `apps/mobile/src/lib/plan-puhu.ts` and its spec

**Interfaces:**
- Consumes:
  - `planWindowToday`, `seedBriefSubjects`, `isMinuteEntry`, `formatKnownBrief`,
    `PLAN_ADAPTATION_MINUTE_CHOICES`, `PLAN_ADAPTATION_NOTE_MAX`, `PlanAdaptationKnownWeek` (Task 2);
  - `OnboardingStepShell`, `PlayOptionCard` (`components/onboarding/step-shell.tsx`);
  - `fetchExamTaxonomy` (`lib/analysis-api.ts`), with query key `["exam-taxonomy", examType, examVariant]`.
- Produces in `plan-puhu.ts`:
  - `interface BriefOverrides { weekdays: number[] | null; minutes: number | null | undefined; subjects: string[] | null }`.
    `null` or `undefined` means untouched, as the web's override states.
  - `planBriefAnswers(args: { brief: CoachPlanAdaptationBriefDto | null; goalMinutes: number | null; taxonomyNames: readonly string[] | null; knownSubjects: readonly string[]; overrides: BriefOverrides }): { weekdays: number[]; rhythmWeekdays: number[]; minutes: number | null; goalMinutes: number | null; rhythmMinutes: number | null; subjects: string[] }`.
    It follows web `plan-coach-adaptation-brief.tsx` lines 76–122. The goal counts only when
    `isMinuteEntry`. The rhythm minutes count only without a goal. Subjects are seeded from the
    coach's focus subjects when it has any, else from the known subjects. `taxonomyNames: null`
    (still loading) gives `[]`.
  - `planBriefInput(args: { note: string; weekdays: readonly number[]; minutes: number | null; subjects: readonly string[]; window: readonly PlanWindowDay[] }): PlanInput | null`.
    It follows web `submit()`: weekdays in window order, empty parts omitted, parsed with
    `coachPlanAdaptationSchema`. It returns null when parsing fails.
  - `PlanPuhuWizard({ knownWeek, brief, coinCost, submitError, onComplete, onClose })`.
    - `onComplete(input: PlanInput, progress: StageProgress)`: progress is
      `{ done: steps.length, total: steps.length + 1 }`.
    - `coinCost: number | null`: the last button reads `planCoin.coin` with the cost when set,
      else `coach_adaptation_generate`.
- Behaviour, per the spec's goal 4:
  - Steps are `days`, `minutes`, `subjects`, `note`. `subjects` is dropped when the loaded taxonomy
    is empty.
  - The shell shows progress `{index+1}/{steps+1}`, Back, and skip (`coach_adaptation_skip`). Skip
    sets that step's override to empty or null; on the last step it submits an empty note.
  - The title is the step label. The subtitle is `groundingLine` or the known line on `days`, and
    `subjects_hint` on `subjects`.
  - Days: 7 option cards showing the weekday name and "Bugün"/"Yarın"/"16 Kasım", with the rhythm
    badge and the `days_rhythm` hint line.
  - Minutes: 2×2 choice cards from `PLAN_ADAPTATION_MINUTE_CHOICES`, badged `minutes_badge` or
    `rhythm_badge`, plus a numeric custom entry. Continue with an invalid entry shows
    `minutes_invalid`.
  - Subjects: multi-select cards marked `suggested`.
  - Note: a multiline field capped at 500 characters with the `note_hint` counter.
  - The error line shows `submitError` on the note step. A failed `planBriefInput` shows
    `note_invalid`.

- [ ] **Step 1: Write the failing spec.**
  - Goal beats suggestion: `goalMinutes: 120` with `suggestion.minutesPerDay: 60` gives
    `minutes: 120, rhythmMinutes: null`.
  - With `goalMinutes: 5` (invalid), the suggestion 60 gives `minutes: 60, rhythmMinutes: 60,
    goalMinutes: null`.
  - **Review Focus 3:** `overrides.weekdays: [2]` with a brief suggesting `[1,3]` gives
    `weekdays: [2]` and `rhythmWeekdays: [1,3]`. `overrides.minutes: null` (skipped) gives
    `minutes: null` even with a goal.
  - Subjects: `focusSubjects: ["matematik"]` against taxonomy `["Türkçe","Matematik"]` gives
    `["Matematik"]`. With no focus, the known subjects seed. `taxonomyNames: null` gives `[]`.
  - `planBriefInput`, with a window starting Saturday (weekday 6) and weekdays `[1,6]`, gives
    `studyWeekdays: [6,1]`. All-empty answers give exactly `{ source: "PLAN" }`. A 501-character
    note gives null.
- [ ] **Step 2: Run and see it fail.** Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, then the wizard and steps. The wizard renders inside the
  host modal from Task 9, not in a modal of its own.
- [ ] **Step 4: Run and see it pass.** Mobile test, typecheck, lint. Expected: PASS.

### Task 7: Stage, "Şehrin üstünde"

**Files:**
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-stage.tsx` (layout, clock, title, caption, progress)
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-stage-scene.tsx` (sky, city, masked video, notes)
- Modify: `apps/mobile/src/lib/art.ts` (`planStageArt`)

**Interfaces:**
- Consumes: `STAGE_TIMING`, `stageNotes`, `stageNoteIndex`, `stagePileDepth` (Task 2); `StageProgress` (Task 3).
- Produces:
  - `planStageArt = { loop, poster, cityFar, cityMid, cityFront }`. The sources are
    `web/public/mascot/puhu/motion/puhu-hero-magic-loop.mp4`, `…/puhu-hero-magic.webp`, and the
    phone cuts `web/public/visuals/landing/city-{far,mid,front}-mobile.webp`.
  - `PlanPuhuStage({ input, knownWeek, brief, progress, arrived, onDone, onCancel })`, the same
    contract as the web stage. It is drawn as a layer over the wizard inside the host modal.
- Behaviour, per the spec's goal 5. One interval clock ticks every `lineMs` until arrival. Then:
  - **Title:** `stage_title` or `stage_title_lighten`, and on arrival `stage_ready` or
    `stage_ready_lighten`.
  - **Sub line** (fixed two-line height): `stage_slow` in lamp yellow from `slowAfterMs` on;
    otherwise the brief's `groundingLine`, or `stage_sub` when tasks are pending.
  - **Caption:** for PLAN it joins the days, minutes and subjects parts with " · ", using the
    `_one`/`_other` keys; for MOOD it shows the pending count.
  - **Progress:** `progress.done` until arrival, then `total`.
  - **Skip control** `stage_cancel` calls `onCancel`.
  - **Notes:** a Reanimated drop for each new note, keyed by index. Under the top note, 0–2 rotated
    blank sheets (−3°, +3.2°). The top note has the tape, the evidence glyph and the
    `planEvidence.<type>` label (`OTHER` fallback) in `Caveat_700Bold`, and the summary on up to
    4 lines.
  - **Screen readers:** the notes are hidden; a visually hidden list carries every note once.
  - **Video:** square, about 34% of the window height and at least 200 dp. An `expo-video` loop,
    muted, under an SVG radial fade into `#0d0e25`, so no edge shows. The poster shows under
    reduced motion or on a player error.
  - **Arrival:** the pile fades out, and `onDone` fires after `arrivalMs`, or at once under reduced
    motion.

- [ ] **Step 1: Implement** art entries, scene, and stage.
- [ ] **Step 2: Verify.** Mobile typecheck and lint, expected clean. The device check is in Task 11.
  The timing rules are tested in core (Task 2).

### Task 8: Preview

**Files:**
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-preview.tsx`
- Modify: `apps/mobile/src/lib/plan-puhu.ts` and its spec (`groupRowsByDate`)
- Modify: `apps/mobile/src/components/panel/primitives.tsx` (`FormSheet` gains optional `onDismiss`)

**Interfaces:**
- Consumes: `flattenPlanAdaptationChanges`, `selectedPlanAdaptationChanges` (Task 2);
  `applyCoachPlanAdaptation` (`lib/coach-api.ts`); `errorText` (`lib/plan-view.ts`);
  `CompanionBubble`; `FormSheet`.
- Produces:
  - `groupRowsByDate(rows: readonly PlanAdaptationRow[]): [string, PlanAdaptationRow[]][]`,
    sorted by date, with input order kept inside a date.
  - `PlanPuhuPreview({ preview, input, visible, onApplied, onPlanChanged, onRegenerate, onClose, onDismiss })`:
    - `onApplied(result: ApplyPlanAdaptationResultDto): Promise<void>`
    - `onPlanChanged(): Promise<void>`
    - `onRegenerate(input: CoachPlanAdaptationInput): void`
- Behaviour, per the spec's goal 6:
  - **Content, top to bottom:**
    - the bubble (`coachNote`, else `groundingLine`), plus the grounding line under it when both
      exist;
    - `message`;
    - a collapsible `evidence_title` list (`planEvidence` label: summary);
    - day headings formatted "Pazartesi, 16 Kasım";
    - checkbox cards, all ticked at first, with the title, `{n} dk` for an ADD, `move_dates` for a
      MOVE, the subject, and `reason`;
    - the `selected_count` line.
  - **Footer:** `apply_selected`, or `close` for `NO_CHANGE`.
  - **Apply:**
    - Zero selected shows `select_required`.
    - It sends `applyCoachPlanAdaptation({ planRevision, source: input.source, changes })` with a
      ref guard.
    - A 409 runs `onPlanChanged()`, shows the error and a `regenerate` button. The button closes the
      sheet and calls `onRegenerate(input)` after dismiss.
    - Any other error shows inline.
    - Success closes and calls `onApplied`.

- [ ] **Step 1: Write the failing spec.** `groupRowsByDate` with rows dated `11-17`, `11-16`,
  `11-17` gives `[["…-16",[b]],["…-17",[a,c]]]`.
- [ ] **Step 2: Run and see it fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see it pass.** Mobile test, typecheck, lint. Expected: PASS.

### Task 9: Controller and the Plan tab entry row

**Files:**
- Create: `apps/mobile/src/components/plan/puhu/use-puhu-generation.ts` (web `usePlanCoachGeneration`)
- Create: `apps/mobile/src/components/plan/puhu/plan-puhu-action.tsx` (web `PlanCoachAdaptationAction`, the host modal, layer hand-offs)
- Modify: `apps/mobile/src/app/(app)/(tabs)/plan.tsx`. It renders the entry row above
  `PlanWeekCard` when `availability.aiCoach` is on. It passes `knownWeek =
  summarizePendingWeek(weekTasks)`, with `onApplied` and `onPlanChanged` set to `refreshAfterChange`.

**Interfaces:**
- Consumes: everything above; `requestCoachPlanAdaptation`, `fetchPlanAdaptationBrief`
  (`lib/coach-api.ts`); `useToast`, `useAuth`.
- Produces: `PlanPuhuAction` with `forwardRef<PlanPuhuActionHandle>`, where
  `interface PlanPuhuActionHandle { open(input: CoachPlanAdaptationInput): void }`. Its props are
  `{ knownWeek, onApplied, onPlanChanged }`.
- Behaviour (web `plan-coach-adaptation-action.tsx`):
  - **Entry row:** a ghost button with the `magic-wand-2` linear glyph and `coach_adaptation_cta`,
    busy during reads. When `offer?.latestRequestId`, `planCoin.saved` sits beside it.
  - **`open({ source: "PLAN" })`:**
    - It is guarded by `busyRef` and `wizardLock`.
    - It reads the access, then dispatches by `planOpenStep`.
    - `wizard`: the host opens with the wizard, and the brief is read from
      `fetchPlanAdaptationBrief`.
    - `sheet`: the sheet opens.
    - `saved`: `readSaved`.
    - A failed read shows `errorText` in a toast.
  - **`open` with MOOD or SESSION:** generation runs directly. The host opens with the stage only;
    there is no wizard.
  - **Confirm in the sheet:**
    - With a resume quote: generate with it.
    - With pending answers: generate with `newCoinQuote(pending, cost)`.
    - Otherwise: open the wizard with `coinCost = cost`; the brief comes from `fetchCoinPlanBrief`.
    - Sheet → host goes through the dismiss queue.
  - **Generation** (`use-puhu-generation.ts`):
    - **Request by path:** a run counter, then included → `requestCoachPlanAdaptation`; Coin →
      `createCoinPlanPreview({ input, expectedCost, clientRequestId: quote.requestId })`; resume →
      `confirmCoinPlanPreview`.
    - **After a Coin call:** invalidate `["economy"]` and re-read the offer.
    - **A stale run** (after cancel) is dropped.
    - **Errors:**
      - `apiErrorCode ∈ COIN_SHEET_ERRORS` on a paid run re-reads the offer. The sheet then shows
        armed, with the error, pending the answers (no pending on a resume). It opens over the open
        wizard, so the answers stay.
      - `PAYMENT_PREMIUM_REQUIRED` shows a toast with `planCoin.phone_closed`.
      - Anything else: `submitError` in the wizard when it is open, else a toast.
  - **Arrival:** the stage calls `onDone`. The host closes, and the preview opens after the dismiss
    queue.
  - **Regenerate from the preview:** on the Coin path with a PLAN input, re-read the offer and show
    the sheet with `pending`. Otherwise generate directly.
  - **`readSaved(id)`:** with a preview, open the preview. With `GENERATED`, show the sheet with
    `resume`, built by `newCoinQuote({ input: { source: "PLAN" }, progress: null }, saved.cost,
    id)` with `resume: true`.
  - **Android back:** on the stage it is `onCancel`; on the wizard it is Back.
  - **Unmount** cancels the run.

- [ ] **Step 1: Implement** the generation hook, the controller and the plan.tsx row.
- [ ] **Step 2: Verify.** Mobile test, typecheck, lint. Expected: clean. The behaviour is checked
  in Task 11.

### Task 10: Panel "Bugünü hafiflet" opens the MOOD flow

**Files:**
- Modify: `apps/mobile/src/app/(app)/(tabs)/dashboard.tsx`
- Modify: `apps/mobile/src/app/(app)/(tabs)/plan.tsx`

**Interfaces:**
- Consumes: `isPremiumFeatureAvailable` (Task 1), `useSubscriptionView` (Task 3),
  `parsePlanAdaptationQuery` (Task 2), and `PlanPuhuActionHandle` (Task 9).
- Behaviour:
  - **Dashboard** `onLighten`: when `isPremiumFeatureAvailable(view, "plan.ai")`, call
    `router.replace({ pathname: "/plan", params: { coach: "adapt", source: "mood" } })`. Otherwise
    call `openPlan()` as today.
  - **`plan.tsx`:**
    - It reads `useLocalSearchParams<{ coach?: string; source?: string; sessionId?: string }>()`
      and parses them with `parsePlanAdaptationQuery`.
    - A ref consumes each request once. It clears the params with
      `router.setParams({ coach: undefined, source: undefined, sessionId: undefined })` and calls
      `actionRef.current?.open(request)`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** Run typecheck and lint, expected clean; the device check is in Task 11.

### Task 11: Device QA, docs and the final gate

**Files:**
- Modify: `docs/standards/mobile.md`. Add a timeline entry, "2026-11-1x — Plan tab, Puhu'yla
  planla at web parity (stop C)", with the gotchas found.
- QA aids live in the scratchpad (not committed). Coin for the QA student is a dev-DB grant. The
  Premium QA account gets the STAFF role in the dev DB.

- [ ] **Step 1: Emulator scenarios** (emulator-5554, local API on :3001, full reload before each
  group). Record pass/fail in the ledger.
  1. **Coin ready:** Plan → "Puhu'yla planla" → sheet → "200 Coin ile hazırla" → confirm block →
     "Onayla ve devam et" → wizard. The last button reads "200 Coin ile hazırla" (real cost).
     Generate, then the stage with notes; Puhu's loop has no edge. Then the preview, untick one
     card, apply. The toast shows, the tasks appear, the nav Coin pill drops.
  2. **Double-tap on "Onayla ve devam et" and on the wizard's last button:** one POST each (API log).
  3. **"Vazgeç" during the stage on a Coin run:** the stage closes. "Kayıtlı taslağımı aç" later
     opens the draft without a second debit (the balance is unchanged).
  4. **Coin short** (balance below cost): progress, "{n} Coin daha", no button, no Premium row.
  5. **Allowance used:** limit title, empty pips, the today/tomorrow line with the right suffix.
  6. **Coin path off** (`mode: NONE`): sheet line "Puhu'yla planlama şu an telefonda açık değil.".
  7. **Premium account (STAFF):** "Puhu'yla planla" opens the wizard at once, with no sheet.
     "Bugünü hafiflet" on the panel (mood ≤ 2) → Plan → stage "Planını hafifletiyoruz." → preview.
     A free account's "Bugünü hafiflet" just opens Plan.
  8. **409:** open a preview, edit a task in that window on the web, apply. The error and "Yeniden
     hazırla" show; the plan refreshes.
  9. **360 dp width:** the sheet, the wizard's day cards, and the stage title and caption fit with
     no clipping. Dark theme: the sheet and wizard read right; the stage stays night.
  10. **Reduced motion on:** the poster replaces the video, the notes do not travel, and the
      preview opens at once on arrival.
- [ ] **Step 2: Docs.** Add the mobile.md timeline entry.
- [ ] **Step 3: Final gate.** Core test, web test, mobile test, mobile typecheck and lint. Expected:
  all PASS. The web typecheck reds are only in `test-results/`.
