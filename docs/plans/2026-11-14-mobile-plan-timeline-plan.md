# Mobile Plan Tab, Stop B1 (view switcher + Timeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mobile Plan tab gets the web's Liste · Timeline switcher and the Timeline view. Timeline is a
week rail in its own scroller that stays in step with the week card.

**Architecture:**
- **Pure rules** live in `apps/mobile/src/lib/plan-timeline.ts`, unit-tested: stored view, pin target,
  active day, row order, rail fill and snap stops.
- **Saved view:** a tiny SecureStore wrapper keeps the chosen view.
- **Switcher:** `components/ui/sliding-tabs.tsx` is a reusable pill switcher.
- **Timeline:** `components/plan/plan-timeline*.tsx` render it.
- **The screen** `app/(app)/(tabs)/plan.tsx` switches between Liste and Timeline. Its task actions move
  into a hook so the screen stays readable.
- **Commits:** none. The owner commits when they ask.

**Tech Stack:** TypeScript, Expo SDK 58 / RN 0.88 Fabric / Expo Router / TanStack Query v5 /
Reanimated 4 / expo-secure-store. Mobile specs use `node --experimental-strip-types --test`.

**Spec:** `docs/plans/2026-11-14-mobile-plan-timeline-design.md` (owner-approved 2026-11-14)

## Global Constraints

- **Branch and files:** branch `feature/APP-142-mobile-core-qa`. Touch only the files this plan names.
  - Other sessions' uncommitted work stays as it is: landing, SEO, consent, forum, community,
    `docs/standards/api.md`, `web-shell.md`, the promo doc, `packages/types/src/forum.ts`, the web
    e2e files and `apps/web/messages/*.json`.
  - The web Coin-retry session's `use-plan-coin-flow.ts` and `plan-coach-adaptation-action.tsx` are not
    touched either.
  - No web or core file changes in B1.
- **Dependencies:** none new.
- **Copy:**
  - Copied verbatim from web `messages/{tr,en}.json` `plan.*` into mobile `i18n/{tr,en}.ts` `plan`:
    - `view_list` "Liste" / "List"
    - `view_timeline` "Timeline" / "Timeline"
    - `view_switch_aria` "Plan görünümü" / "Plan view mode"
    - `timeline_day_empty` "Bu günde görev yok." / "No tasks on this day."
    - `timeline_scroll_aria` "Haftalık plan zaman çizelgesi" / "Weekly plan timeline"
  - `view_calendar` waits for B2.
  - `i18n.spec.ts` enforces TR/EN parity.
- **Theme:** colours come from `useThemeTokens().palette`. Web → mobile token mapping:
  - `--color-progress` → `progress`; `--color-progress-track` → `progressTrack`
  - `--color-surface` → `surface`
  - `--color-main` → `main`; `--color-body` → `main` (mobile has no body token); `--color-secondary` → `secondary`
  - `--color-surface-container` → `surfaceAlt`
  - card shadow → `cardShadow` from `lib/layout.ts`
- **Motion:** `useReducedMotion()` from Reanimated. With reduced motion:
  - no spring and no timing (values jump)
  - no fades
  - inactive days are not dimmed
- **Android at density 2.625:**
  - single-line labels get `numberOfLines={1}`
  - a rounded view whose fill changes gets a `key` remount
  - every write keeps the existing busy-ref guard
- **File size:** a new file stays under about 300 lines.
- **Gate before done:**
  - `pnpm --filter @mentor/core test`
  - `pnpm --filter @mentor/web test`
  - `pnpm --filter @mentor/mobile test`, `typecheck` and `lint`
  - The web typecheck's reds come only from `apps/web/test-results` (do not delete that folder).
- **Secrets:** never print the QA account email or password (`apps/mobile/.expo/qa-accounts.json`).

## Review Focus

1. **Our own `scrollTo` echoes back as a scroll and moves the selection again.** The strip would flicker
   or fight the finger. Expect: a tap in the strip, or on a dot, scrolls once and the selection stays on
   the tapped day.
   Test: Task 4's suppress ref, plus Task 6 QA 3 (rapid taps on three days).
2. **Pinning against the previous week's measurements after a week change.** The card would land
   mid-day or on the wrong day. Expect: the pin waits until all seven sections of the new week have
   laid out.
   Test: Task 4's pin gate, plus Task 6 QA 4 (arrows both ways from a scrolled-down position).
3. **Day heights change after a tick, an add or a delete.** A done row moves to the end, a row
   disappears, a coach note wraps. Stale tops would make the active day and the snap stops wrong.
   Expect: sections re-measure on layout, and snap stops and the badge follow.
   Test: Task 4 re-measure, plus Task 6 QA 5.
4. **A long day on a short phone.** About six dense rows overflow the 333 dp scroller at 360 × 640.
   Expect: every row of that day can rest in view.
   Test: Task 1 `timelineSnapOffsets` cases, plus Task 6 QA 10 at 360 dp with a seeded long day.
5. **Pull to refresh and page scroll around the nested scroller.** Expect: the page still scrolls and
   refreshes from outside the card.
   Test: Task 6 QA 9.

---

### Task 1: Timeline rules in `lib/plan-timeline.ts`

**Files:**
- Create: `apps/mobile/src/lib/plan-timeline.ts`, `apps/mobile/src/lib/plan-timeline.spec.ts`

**Interfaces:**
- Produces:
  - `type PlanViewMode = "list" | "timeline"`
  - `readPlanViewMode(raw: string | null): PlanViewMode`
  - `timelinePinTarget(days: readonly string[], today: string, selected: string): string`
  - `interface TimelineDayTop { iso: string; top: number }`
  - `activeTimelineDay(tops: readonly TimelineDayTop[], scrollTop: number): string | null`
  - `orderTimelineTasks<T extends { status: string }>(tasks: readonly T[]): T[]`
  - `TIMELINE_RAIL_X = 22`
  - `TIMELINE_END_RESERVE = 72`
  - `railFillRatio(activeTop: number, railHeight: number): number`
  - `timelineSnapOffsets(dayTops: readonly number[], dayHeights: readonly number[], viewport: number): number[]`

- [ ] **Step 1: Write the failing tests** in `plan-timeline.spec.ts` (import from `./plan-timeline.ts`):

```ts
describe("readPlanViewMode", () => {
  it("opens Timeline only when Timeline was saved", () => {
    assert.equal(readPlanViewMode("timeline"), "timeline");
    for (const raw of ["list", "calendar", "week", "garbage", "", null]) assert.equal(readPlanViewMode(raw), "list");
  });
});

describe("timelinePinTarget", () => {
  const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  it("opens on today when the week holds it", () => {
    assert.equal(timelinePinTarget(days, "2026-11-14", "2026-11-11"), "2026-11-14");
  });
  it("opens on the selected day in any other week", () => {
    assert.equal(timelinePinTarget(days, "2026-11-20", "2026-11-11"), "2026-11-11");
  });
});

describe("activeTimelineDay", () => {
  const tops = [{ iso: "a", top: 0 }, { iso: "b", top: 120 }, { iso: "c", top: 300 }];
  it("picks the day whose top is nearest the scroll offset", () => {
    assert.equal(activeTimelineDay(tops, 50), "a");
    assert.equal(activeTimelineDay(tops, 200), "b");
    assert.equal(activeTimelineDay(tops, 290), "c");
  });
  it("keeps the earlier day on a tie and the last day past the end", () => {
    assert.equal(activeTimelineDay(tops, 60), "a");
    assert.equal(activeTimelineDay(tops, 900), "c");
  });
  it("has no day before anything is measured", () => {
    assert.equal(activeTimelineDay([], 0), null);
  });
});

describe("orderTimelineTasks", () => {
  it("puts pending tasks first and keeps each group's order", () => {
    const tasks = [{ id: 1, status: "DONE" }, { id: 2, status: "PENDING" }, { id: 3, status: "DONE" }, { id: 4, status: "PENDING" }];
    assert.deepEqual(orderTimelineTasks(tasks).map((task) => task.id), [2, 4, 1, 3]);
  });
});

describe("railFillRatio", () => {
  it("fills to the active day's marker and stays within 0..1", () => {
    assert.equal(railFillRatio(78, 200), 0.5);
    assert.equal(railFillRatio(900, 200), 1);
    assert.equal(railFillRatio(0, 0), 1);
  });
});

describe("timelineSnapOffsets", () => {
  it("stops at each day's top when every day fits", () => {
    assert.deepEqual(timelineSnapOffsets([0, 100, 220], [100, 120, 80], 300), [0, 100, 220]);
  });
  it("adds stops inside a day taller than the scroller so its last rows can rest in view", () => {
    // stride = viewport − TIMELINE_END_RESERVE = 228; the day's last stop is its bottom − viewport.
    assert.deepEqual(timelineSnapOffsets([0, 700], [700, 50], 300), [0, 228, 400, 700]);
  });
  it("ignores a scroller with no height yet", () => {
    assert.deepEqual(timelineSnapOffsets([0, 100], [500, 50], 0), [0, 100]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && node --experimental-strip-types --test src/lib/plan-timeline.spec.ts`
Expected: FAIL (cannot find module `./plan-timeline.ts`).

- [ ] **Step 3: Implement the helpers in `plan-timeline.ts`.**
  - `activeTimelineDay` follows the web's `syncFromScroll`: absolute distance, and a strictly smaller
    distance wins.
  - `railFillRatio` is `(activeTop + TIMELINE_RAIL_X) / railHeight`, clamped to 0..1. A rail height of 0
    gives 1.
  - `timelineSnapOffsets`, for each day:
    - It pushes the day's top.
    - When the day's height is greater than the viewport (and the viewport is above 0), it adds
      `top + k × (viewport − TIMELINE_END_RESERVE)` for k = 1, 2, … while the stop is below
      `top + height − viewport`, then `top + height − viewport`.
    - The result is ascending and unique.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && node --experimental-strip-types --test src/lib/plan-timeline.spec.ts`
Expected: PASS, 11 tests.

---

### Task 2: The switcher and the saved view

**Files:**
- Create: `apps/mobile/src/components/ui/sliding-tabs.tsx`
- Modify: `apps/mobile/src/components/ui/index.ts` (export it)
- Create: `apps/mobile/src/lib/plan-view-store.ts`
- Modify: `apps/mobile/src/i18n/tr.ts` and `en.ts`, `plan`: add the five keys in Global Constraints.

**Interfaces:**
- Consumes: `PlanViewMode` and `readPlanViewMode` (Task 1).
- Produces:
  - `SlidingTabs<T extends string>(props: { items: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void; accessibilityLabel: string; style?: StyleProp<ViewStyle> }): JSX.Element`
  - `loadPlanViewMode(): PlanViewMode` and `savePlanViewMode(mode: PlanViewMode): void`, with key
    `mentor.plan.view.v1`. Use sync `SecureStore.getItem` / `setItem`, wrapped in try/catch, in the
    shape of `lib/recap-opened.ts`.

- [ ] **Step 1: Write `SlidingTabs`** (web `SlidingTabs` with `equalWidth`, pill variant):
  - **Container:** a row with role `tablist`, labelled `accessibilityLabel`.
    - Radius: full.
    - Padding: 4.
    - Background: `mixHex(palette.surfaceAlt, palette.bg, 0.8)`.
    - Border: 1 px `palette.border`.
  - **Tabs:** equal-width with role `tab` and `accessibilityState.selected`.
    - Minimum height: 44.
    - Label: 15 px, weight 700. Selected is `main`, others `secondary`. `numberOfLines={1}`.
  - **Pill:** sits under the tabs.
    - Fill: `palette.surface` with `cardShadow`, full radius.
    - Its width is the container's inner width ÷ item count. It moves by `translateX` over 250 ms with
      `Easing.bezier(0.22, 1, 0.36, 1)`.
    - It snaps (no timing) on its first placement, on a width change, and under reduced motion.
  - **Haptics:** `haptics.selection()` on a change.
- [ ] **Step 2: Write `plan-view-store.ts`** as in the Interfaces block.
- [ ] **Step 3: Add the copy keys** to both locale files.
- [ ] **Step 4: Verify**

Run: `pnpm --filter @mentor/mobile test` then `pnpm --filter @mentor/mobile typecheck` then `pnpm --filter @mentor/mobile lint`
Expected: all pass. The i18n parity spec stays green with the five new keys.

---

### Task 3: Dense row and the week card's progress switch

**Files:**
- Modify: `apps/mobile/src/components/plan/plan-task-row.tsx`
- Modify: `apps/mobile/src/components/plan/plan-week-card.tsx`

**Interfaces:**
- Produces:
  - `PlanTaskRow` gains `dense?: boolean`, default `false`. The non-dense look is unchanged.
  - `PlanWeekCard` gains `showDayProgress?: boolean`, default `true`. When it is `false`, the
    `day.total > 0` progress block is not rendered.

- [ ] **Step 1: Add `dense` to `PlanTaskRow`** with the web's phone-width dense sizes. The checkbox's
  44 × 44 hit area stays.

  | Part | Dense value |
  |---|---|
  | Row | `minHeight` 44, `gap` 6, `paddingVertical` 6 |
  | Checkbox | 20 × 20, check icon 12 |
  | Title | 14 / 20 |
  | Meta | `marginTop` 2, `columnGap` 6 |
  | Subject and coach badge | 9 / 13 |
  | Coach icon | 11 |
  | Duration | 11 / 15 |
  | "Oturum başlat →" | 11 |
  | Coach note | 10 / 14, `marginTop` 4 |

- [ ] **Step 2: Add `showDayProgress` to `PlanWeekCard`.**
- [ ] **Step 3: Verify**

Run: `pnpm --filter @mentor/mobile typecheck` then `pnpm --filter @mentor/mobile lint`
Expected: pass. Liste looks unchanged (checked in Task 6 QA 1).

---

### Task 4: The Timeline view

**Files:**
- Create: `apps/mobile/src/components/plan/plan-timeline.tsx` (card, scroller, rail, badge, sync, pin)
- Create: `apps/mobile/src/components/plan/plan-timeline-day.tsx` (one day: dot, header, rows, empty line)
- Create: `apps/mobile/src/components/plan/plan-timeline-skeleton.tsx`

**Interfaces:**
- Consumes:
  - From Task 1: `timelinePinTarget`, `activeTimelineDay`, `orderTimelineTasks`, `railFillRatio`,
    `timelineSnapOffsets`, `TIMELINE_RAIL_X`, `TIMELINE_END_RESERVE`.
  - From Task 3: `PlanTaskRow` `dense`.
  - From `@mentor/core`: `weekDates`, `todayIso`, `isPastDate`, `taskStats`, `formatDateLabel`,
    `formatMonthDayShort`.
- Produces:
  - `PlanTimeline(props: { weekAnchor: string; weekTasks: Record<string, PlanTaskDto[]>; selectedDate: string; busyId: string | null; onSelectDate: (iso: string) => void; onAdd: () => void; onToggle: (task: PlanTaskDto) => void; onOpenMenu: (task: PlanTaskDto) => void; onStartSession: (task: PlanTaskDto) => void }): JSX.Element`
  - `PlanTimelineSkeleton(props: { embedded?: boolean }): JSX.Element`

- [ ] **Step 1: Write `PlanTimelineSkeleton`** after the web's `PlanTimelineSkeleton`, using the
  `Skeleton` from `components/ui`:
  - a 2 px `progressTrack` rail at x 11
  - seven day blocks, each with a 24 px circle at x 24, a 16 × 144 title bar and row placeholders
    (two in the first block, one elsewhere)
  - gap 24
  - `embedded` drops the outer `PanelCard`

- [ ] **Step 2: Write `PlanTimelineDay`.**
  - **Props:** iso, tasks, active, `onLayout`, `onSelect`, the three row handlers and `busyId`.
  - **Section:**
    - `paddingLeft` 44, `paddingBottom` 16.
    - Opacity is 0.78 when inactive and not under reduced motion.
  - **Inactive dot:** a 12 × 12 `Pressable` at top 10, centred on x = `TIMELINE_RAIL_X`, with a 44
    `hitSlop`.
    - Fill `surface` and a 2 px `progressTrack` border. Today: `progress` fill and border.
    - Past days: opacity 0.75.
    - Its accessibility label is `formatDateLabel(iso, locale, t("today"), { alwaysFull: true })`.
    - Tapping it calls `onSelect(iso)`.
    - The active day has no dot; the parent's badge covers it.
  - **Header:**
    - Title: `t("today")` for today, otherwise the full date label. 13 / 16 bold, `main`.
      `numberOfLines={1}`.
    - Stats: `done/total` on the right, 11 px `secondary` with tabular numbers, only when total > 0.
    - `minHeight`: 36 when active; 32 with `paddingTop` 4 otherwise. `marginBottom` 6.
  - **Body:**
    - No tasks: `timeline_day_empty` at 12 / 16 `secondary`, `paddingVertical` 4.
    - Otherwise: `orderTimelineTasks(tasks)` as `PlanTaskRow dense`, with `readOnly={isPastDate(iso)}`.
  - **Measuring:** `onLayout` reports `{ iso, top: y, height }` to the parent.

- [ ] **Step 3: Write `PlanTimeline`.**
  - **Card:** a `PanelCard` with padding 12 and `paddingTop` 40.
    - The "+" button (the web's `PlanAddTaskButton`: a round 36 button with a plus glyph) sits
      absolute at top 6, right 6.
    - The "+" is hidden when `isPastDate(selectedDate)`. Its accessibility label is `t("add_task")`,
      as on Liste's add button.
  - **Scroller:** a `ScrollView`.
    - Props: `nestedScrollEnabled`, `scrollEventThrottle={16}`,
      `snapToOffsets={timelineSnapOffsets(...)}`, `decelerationRate="fast"`.
    - Accessibility label: `timeline_scroll_aria`.
    - Size: `maxHeight = Math.min(448, 0.52 × useWindowDimensions().height)`.
    - Content padding: top 5.6, right 28, bottom 10.4, left 5.6.
    - The viewport height comes from `onLayout`.
  - **Content** (relative):
    - **Rail track:** absolute from top 8 to bottom 8, 2 px wide at x = `TIMELINE_RAIL_X`, in
      `progressTrack`.
    - **Rail fill:** absolute from top 8, in `progress`. Its height is the rail height ×
      `railFillRatio(activeTop, railHeight)`, animated with `withTiming` over 320 ms on
      `Easing.bezier(0.22, 1, 0.36, 1)`.
    - **Badge:** a 36 × 36 `Animated.View`.
      - It is absolute at x = `TIMELINE_RAIL_X` − 18. Its `top` is a shared value set to the active day's
        top, animated with `withSpring({ stiffness: 420, damping: 34 })`.
      - Look: `progress` fill, 2 px `surface` border, `cardShadow`.
      - Text: two white lines from `formatMonthDayShort(activeIso, locale)` (`.day`, `.month`),
        9 / 10 bold.
      - `pointerEvents="none"`.
    - **Days:** seven `PlanTimelineDay`s.
    - **End spacer:** `max(0, viewport − TIMELINE_END_RESERVE)`.
  - **State and refs:**
    - **Tops:** a `Record<iso, { top, height }>` from the days' `onLayout`. It re-measures on every
      layout (Review Focus 3).
    - **Active day:** `activeIso` state.
    - **`suppressRef`:** set while our own `scrollTo` runs. It is cleared after 420 ms, or 80 ms for a
      jump.
    - **`emittedRef`:** the last day we reported.
    - **`pinnedWeekRef`:** starts at `null`, which means entry.
  - **Pin:** runs once all seven tops for `weekAnchor` are measured and
    `pinnedWeekRef.current !== weekAnchor` (Review Focus 2).
    - Target: `pinnedWeekRef.current === null ? timelinePinTarget(weekDates(weekAnchor), todayIso(), selectedDate) : selectedDate`.
    - Scroll without animation to the target's top, set `activeIso`, then set `emittedRef` and
      `pinnedWeekRef`.
    - If the target ≠ `selectedDate`, call `onSelectDate(target)`.
    - Then reveal the scroller. Until the reveal, it sits at opacity 0 under
      `<PlanTimelineSkeleton embedded />`.
  - **Scroll:**
    - `onScroll` → `activeTimelineDay(tops, y)`. When the result changes, set `activeIso` and announce
      `AccessibilityInfo.announceForAccessibility(fullDateLabel)`.
    - Only if `!suppressRef.current` and the result ≠ `emittedRef`: set `emittedRef` and call
      `onSelectDate(active)`.
  - **Outside selection:** when `selectedDate` changes and ≠ `emittedRef` (a strip tap, a dot or the
    date sheet, all within this week):
    - Set `emittedRef` and `activeIso`.
    - Set `suppressRef`.
    - `scrollTo({ y: top, animated: !reduceMotion })`.
  - **Under reduced motion:** the spring and the timing are replaced by direct sets.
  - **Out of scope:** the screen handles loading and error. `PlanTimeline` renders only with data.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @mentor/mobile typecheck` then `pnpm --filter @mentor/mobile lint`
Expected: pass. Each new file is under 300 lines.

---

### Task 5: The screen switches views

**Files:**
- Create: `apps/mobile/src/components/plan/use-plan-task-actions.ts`
- Modify: `apps/mobile/src/app/(app)/(tabs)/plan.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `PlanViewMode`
  - Task 2: `SlidingTabs`, `loadPlanViewMode`, `savePlanViewMode`
  - Task 3: `showDayProgress`
  - Task 4: `PlanTimeline`, `PlanTimelineSkeleton`
- Produces:
  - `usePlanTaskActions({ weekKey, onChanged, onError }: { weekKey: readonly unknown[]; onChanged: () => Promise<void> | void; onError: (error: unknown) => void }): { busyId: string | null; toggle: (task: PlanTaskDto) => Promise<void>; remove: (task: PlanTaskDto) => Promise<void> }`
  - The bodies of `toggle`, `remove`, `begin`, `end` and the busy ref move from `plan.tsx` verbatim.

- [ ] **Step 1: Move the task actions into `usePlanTaskActions`.** Liste's behaviour is unchanged.
- [ ] **Step 2: Wire the views in `plan.tsx`.**
  - **State:** `const [mode, setMode] = useState<PlanViewMode>(loadPlanViewMode)`. A change sets the
    state and calls `savePlanViewMode`.
  - **Switcher:** `<SlidingTabs>` with Liste and Timeline (`view_list`, `view_timeline`,
    `view_switch_aria`). It goes between `PlanPuhuAction` and `PlanWeekCard`.
  - **Week card:** `showDayProgress={mode === "list"}`.
  - **Past-day notice:** rendered only when `mode === "list"`.
  - **Content:**
    - No data yet: `PlanTimelineSkeleton` in Timeline, `PlanSkeleton` in Liste. The error `StateView`
      is shared.
    - Liste: unchanged.
    - Timeline: `PlanTimeline`. It is wrapped in an `Animated.View` with
      `entering={reduceMotion ? undefined : FadeIn.duration(180)}` and keyed by mode.
    - Timeline's `onAdd` is `setFormMode({ kind: "add", date: selectedDate })`.
- [ ] **Step 3: Verify**

Run: `pnpm --filter @mentor/mobile test` then `pnpm --filter @mentor/mobile typecheck` then `pnpm --filter @mentor/mobile lint`
Expected: all pass. `plan.tsx` ends no longer than it started (346 lines).

---

### Task 6: Standards note, device QA and gate

**Files:**
- Modify: `docs/standards/mobile.md`. Add a "2026-11-14 — Plan tab, view switcher and Timeline (stop
  B1)" entry in the timeline, in the same shape as the stop C entry: what was done, usage, gotchas found
  in QA, related files.

- [ ] **Step 1: Run device QA** on the emulator (see the memory note "mobile emulator run recipe"). Use the
  QA student; seed a long day (8+ tasks) and an empty day in this week through the API. Screenshots go
  to `apps/mobile/.expo/qa/timeline/`.
  1. Liste → Timeline → Liste. The pill slides. Timeline opens pinned to today with no visible
     jump. Relaunching the app reopens Timeline.
  2. Scroll the card. The badge springs and the fill follows, the strip's selected day follows, and
     each day comes to rest at the top.
  3. Tap three strip days quickly, then a dot. The card scrolls once per tap and the selection stays
     where it was tapped.
  4. Week arrows, from a scrolled-down position:
     - Next week pins to Monday; back to this week pins to today.
     - Picking another week's Wednesday in the date sheet pins to that Wednesday.
     - Nothing above the card moves while scrolling between a day with tasks and an empty day, or
       into yesterday.
  5. From a Timeline row:
     - Tick and untick. The done row moves to the end and the badge and snap stay right.
     - Menu → Düzenle saves, menu → Sil confirms.
     - "Oturum başlat" opens the session.
  6. A past day: rows are read-only and there is no "+".
  7. "+" on a future day opens the form on that day.
  8. A fully empty week shows the empty line under every day, and the last day still reaches the top.
  9. Pull to refresh from above the card works. The page scrolls past the card.
  10. Dark theme. 360 dp (`wm density 480`) with the long day: every row reachable. Reduced motion
      (the three animator scales at 0, then reload): no spring, no fades, no dimming. Put every
      emulator setting back afterwards.
- [ ] **Step 2: Write the `mobile.md` entry** with the gotchas QA found.
- [ ] **Step 3: Run the gate.**

Run: `pnpm --filter @mentor/core test`, `pnpm --filter @mentor/web test`, `pnpm --filter @mentor/mobile test`, `pnpm --filter @mentor/mobile typecheck`, `pnpm --filter @mentor/mobile lint`
Expected: all pass.
