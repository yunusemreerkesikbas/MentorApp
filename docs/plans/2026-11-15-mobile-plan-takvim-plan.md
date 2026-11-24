# Mobile Plan Tab, Stop B2a (Takvim: Ajanda + Ay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Plan tab gets the web's Takvim view at phone width:
- a drag-open month board that is also the date strip
- Ajanda below it, with Ay plus the subject legend when the board is open
- holidays, a "+" button and a task details sheet

**Architecture:**
- **Shared rules move to `@mentor/core`** and the web re-exports them:
  - month grid and day layout
  - subject colour swatches
  - calendar items
  - subject summary
  - spotlight delay
- **Mobile-only rules** live in `apps/mobile/src/lib/plan-calendar.ts`, unit-tested: scale, board-month state transitions, board row, agenda spy, legend, tints, items.
- **Components** live in `components/plan/calendar/*`. The board drags on the UI thread with gesture-handler, and a `GestureHandlerRootView` now wraps the app.
- **The screen** holds one `PlanCalendarState` (week anchor, selected day, board month, month step) shared by all three views.
- **Commits:** none. The owner commits when they ask.

**Tech Stack:** TypeScript, Expo SDK 58 / RN 0.88 Fabric / Expo Router / TanStack Query v5 / Reanimated ~4.7.1 / react-native-gesture-handler ~3.3.0 (v3 hook API) / expo-secure-store. Core and mobile specs use `node --experimental-strip-types --test`; web specs use vitest.

**Spec:** `docs/plans/2026-11-15-mobile-plan-takvim-design.md` (owner-approved 2026-11-15)

## Global Constraints

- **Branch and files:** branch `feature/APP-142-mobile-core-qa`. Touch only the files this plan names.
  - Other sessions' uncommitted work stays as it is:
    - landing, SEO / structured data, consent banner, forum, discover-community
    - `docs/standards/api.md`, `web-shell.md`, the promo doc
    - the web e2e files, `apps/web/messages/*.json`
    - `use-plan-coin-flow.ts`, `plan-coach-adaptation-action.tsx`
  - Before every task, check `git status` for files this plan names that already hold someone else's edits. Leave those hunks alone.
- **Dependencies:** none new.
- **Copy:**
  - Copied verbatim from web `messages/{tr,en}.json` `plan.*` into mobile `i18n/{tr,en}.ts` `plan`.
  - Mobile has no ICU. `legend_days` splits into:
    - `legend_days_one`: "{count} gün yayılmış" / "across {count} day"
    - `legend_days_other`: "{count} güne yayılmış" / "across {count} days"
  - `i18n.spec.ts` enforces TR/EN parity.
- **Theme:** colours come from `useThemeTokens().palette`. Web → mobile mapping:
  - `--color-progress` → `progress`
  - `--color-main` → `main`; `--color-body` → `main`; `--color-secondary` → `secondary`
  - `--color-chip-text` → `chipText` (new)
  - `--color-accent` → `progress` (the web accent is #55ACEE; mobile `accent` is amber)
  - `--color-surface-container` → `surfaceAlt`
  - `--color-btn` / `--color-btn-label` → `main` / `surface`
  - `--color-danger` → `danger`
  - a tint `color-mix(X n%, transparent)` → `mixHex(X, palette.surface, n / 100)`
  - card shadow → `cardShadow`
- **Motion:**
  - `useReducedMotion()` from Reanimated. With reduced motion every timing and spring jumps.
  - Springs pass `mass: 1` (the Reanimated 4 default is 4).
  - Settle timing: 240 ms, `Easing.bezier(0.22, 1, 0.36, 1)`.
  - Animated layout props lagged seconds on Fabric in B1. Prefer transforms everywhere. The one exception is the board's height, which the spike proved smooth when it is driven from a UI-thread gesture.
- **Android at density 2.625:**
  - single-line labels get `numberOfLines={1}`
  - a rounded view whose fill changes gets a `key` remount
  - writes keep the busy-ref guard
- **File size:** a new file stays under about 300 lines. `plan.tsx` (338 lines) grows by at most about 50.
- **Build:** after a core or ui change, run `pnpm --filter @mentor/core build` / `pnpm --filter @mentor/ui build`. Core specs import `../dist/index.js`.
- **Gate before done:**
  - `pnpm --filter @mentor/core test`
  - `pnpm --filter @mentor/web test`
  - `pnpm --filter @mentor/mobile test`, `typecheck` and `lint`
  - The web typecheck's reds come only from `apps/web/test-results` (do not delete that folder).
- **Secrets:** never print the QA account email or password (`apps/mobile/.expo/qa-accounts.json`).

## Review Focus

1. **The agenda's own jump echoes back through the spy and moves the selection.**
   - Expect: a strip tap, "Bugün" or ‹ › jumps once, and the selection stays on the picked day.
   - Test: Task 5 reuses `scrollSync` plus a suppress window. QA 3 does rapid taps on three strip days.
2. **The board month and the selected day drift apart.** The collapsed strip would show a row from another month, or none at all.
   - Expect: after any pick, follow or step, the board's 42 days hold the selected day.
   - Test: Task 2's invariant test over an operation sequence.
3. **Drag, tap and the page scroll fight over the handle.**
   - The cases: a vertical drag that scrolls the page, a tap that toggles twice, a release racing a segment tap.
   - Expect: one settle per gesture, and the page never moves while the handle is dragged.
   - Test: QA 2.
4. **A busy day on a narrow phone.**
   - The case: a holiday plus five tasks with long titles in an 84 dp row at 360 dp.
   - Expect: two chips, then "+N tane daha"; titles clip to one line; nothing spills into the next row.
   - Test: QA 4 with a seeded busy holiday day.
5. **Stale data across months and writes.**
   - Expect: stepping months never shows the previous month's chips in the new grid. A delete from the details sheet disappears from board and agenda. A failed holidays read is silent.
   - Test: the per-month query keys (Task 3), plus QA 4, QA 6 and QA 8.

---

### Task 1: Shared calendar rules move to `@mentor/core`

**Files:**
- Create: `packages/core/src/plan-calendar-layout.ts`
  - Moved verbatim from `apps/web/src/lib/plan-calendar-layout.ts`: `DAY_MINUTES`, `DEFAULT_EVENT_MINUTES`, `TimedInput`, `TimedEventLayout`, `DayLayout`, `minutesFromHhmm`, `hhmmFromMinutes`, `monthGridDays`, `layoutDayEvents`, `earliestStartMinute`.
- Create: `packages/core/src/plan-calendar.ts` (swatches, items, subject summary, spotlight)
- Create: `packages/core/src/plan-calendar.spec.ts`
- Modify: `packages/core/src/index.ts` (export both)
- Modify (web re-exports, signatures unchanged):
  - `apps/web/src/lib/plan-calendar-layout.ts`: re-export from core.
  - `plan-subject-summary.ts`: re-export from core.
  - `plan-event-colors.ts`: keeps `PlanEventColor`, `planEventColor`, `planEventPalette`, `planEventNeutralColor`. It builds them from the core swatches and returns the same object instances per bucket as today.
  - `plan-calendar-item.ts`: web `PlanCalendarItem<T>` = core `PlanCalendarItem<T, PlanEventColor>` plus `icon?` and `accessory?` (`ReactNode`). `planTaskCalendarItem(task, labels)` and `planTaskCalendarItems(...)` call core with `planEventColor`.
  - `plan-events.ts`: `studentEventCalendarItem(event, viewerId, labels)` calls core with `planEventNeutralColor`.
  - `app/[locale]/(app)/plan/_components/plan-event-chip.tsx`: `spotlightDelay`, `SPOTLIGHT_STEP_MS` and `SPOTLIGHT_MAX_DELAY_MS` are imported from core and re-exported.

**Interfaces:**
- Produces (core):
  - Everything moved from the layout file. `monthGridDays(year: number, monthIndex: number): string[]` always returns 42 days.
  - `type PlanEventSwatchToken = "progress" | "chip" | "thumbViolet" | "success" | "star" | "secondary"`
  - `interface PlanEventSwatch { token: PlanEventSwatchToken; tint: number }` (tint in percent)
  - `PLAN_EVENT_SWATCHES: readonly PlanEventSwatch[]`, in this order:
    - progress 18
    - chip 24
    - thumbViolet 26
    - success 13
    - star 26
  - `PLAN_EVENT_NEUTRAL_SWATCH: PlanEventSwatch` (secondary 12)
  - `planEventSwatch(subject: string | null | undefined): PlanEventSwatch`: the web's FNV-1a on the trimmed subject, modulo 5; neutral for an empty one.
  - `interface PlanCalendarItem<TSource = unknown, TColor = unknown>`: the web fields minus `icon` / `accessory`, with `color: TColor`.
  - `interface PlanTaskItemLabels { done: string; hint: string }`
  - `planTaskCalendarItem<C>(task: PlanTaskDto, labels: PlanTaskItemLabels, colorOf: (subject: string | null) => C): PlanCalendarItem<PlanTaskDto, C>`
  - `planTaskCalendarItems<C>(tasksByDate: Record<string, PlanTaskDto[]>, labels: PlanTaskItemLabels, colorOf: (subject: string | null) => C): Record<string, PlanCalendarItem<PlanTaskDto, C>[]>`
  - `interface StudentEventLabels { withCoach: string; cancelled: string }`
  - `studentEventCalendarItem<C>(event: PlanEventDto, viewerId: string, labels: StudentEventLabels, neutral: C): PlanCalendarItem<PlanEventDto, C>`
  - `SummarizableTask`, `PlanSubjectSummary`, `summarizeSubjectMonth(...)`, `formatPlannedMinutes(...)`, all as on the web.
  - `SPOTLIGHT_STEP_MS = 25`, `SPOTLIGHT_MAX_DELAY_MS = 400`, `spotlightDelay(litIndex: number): number`

- [ ] **Step 1: Write the failing core spec** `plan-calendar.spec.ts`. It imports from `../dist/index.js`, like `plan-access.spec.ts`.

```ts
describe("monthGridDays", () => {
  it("always gives six Monday-first weeks", () => {
    const nov = monthGridDays(2026, 10);
    assert.equal(nov.length, 42);
    assert.deepEqual([nov[0], nov[41]], ["2026-10-26", "2026-12-06"]);
    assert.equal(monthGridDays(2026, 1)[0], "2026-01-26"); // 1 Feb 2026 is a Sunday
  });
});
describe("layoutDayEvents", () => {
  it("puts all-day items aside and orders timed ones by start", () => {
    const out = layoutDayEvents([{ startTime: "10:00", endTime: null }, { startTime: null, endTime: null }, { startTime: "08:30", endTime: "09:00" }]);
    assert.equal(out.allDay.length, 1);
    assert.deepEqual(out.timed.map((t) => t.event.startTime), ["08:30", "10:00"]);
  });
});
describe("planEventSwatch", () => {
  it("keeps the web's buckets", () => {
    const token = (s: string) => planEventSwatch(s).token;
    assert.deepEqual(["Tarih", "Coğrafya", "Matematik", "Fizik", "Türkçe"].map(token), ["progress", "chip", "thumbViolet", "success", "star"]);
    assert.deepEqual(planEventSwatch(" Tarih "), planEventSwatch("Tarih"));
  });
  it("gives no subject the neutral swatch", () => {
    for (const s of [null, undefined, "", "   "]) assert.deepEqual(planEventSwatch(s), { token: "secondary", tint: 12 });
  });
});
describe("calendar items", () => {
  const labels = { done: "D", hint: "H" };
  it("maps a done task with its trimmed subject", () => {
    const item = planTaskCalendarItem({ id: "t", taskDate: "2026-11-03", title: "Tekrar", subject: " Tarih ", status: "DONE", startTime: null, endTime: null, description: null } as PlanTaskDto, labels, (s) => `c:${s}`);
    assert.deepEqual([item.color, item.meta, item.groupKey, item.muted, item.hint], ["c:Tarih", "Tarih", "Tarih", true, "D"]);
  });
  it("labels a coach's meeting and mutes a cancelled one", () => {
    const base = { id: "e", eventDate: "2026-11-03", title: "Görüşme", startTime: "18:00", endTime: "18:30", description: null, status: "SCHEDULED", organizerUserId: "coach" } as PlanEventDto;
    const item = studentEventCalendarItem(base, "me", { withCoach: "Koçunla", cancelled: "İptal" }, "N");
    assert.deepEqual([item.meta, item.groupKey, item.glyph, item.color, item.muted], ["Koçunla", null, "event", "N", false]);
    const own = studentEventCalendarItem({ ...base, organizerUserId: "me", status: "CANCELLED" }, "me", { withCoach: "Koçunla", cancelled: "İptal" }, "N");
    assert.deepEqual([own.meta, own.muted, own.hint], [null, true, "İptal"]);
  });
});
describe("summarizeSubjectMonth", () => {
  it("counts the month only, adds planned minutes and finds the next task", () => {
    const task = (status: string, startTime: string | null = null, endTime: string | null = null, durationMinutes: number | null = null) => ({ title: `T${status}`, subject: "Tarih", status, startTime, endTime, durationMinutes });
    const s = summarizeSubjectMonth("Tarih", {
      "2026-11-03": [task("DONE", null, null, 45)],
      "2026-11-10": [task("PENDING", "09:00", "10:30")],
      "2026-11-20": [task("PENDING")],
      "2026-12-01": [task("PENDING")],
    }, "2026-11", "2026-11-15");
    assert.deepEqual([s.done, s.total, s.percent, s.dayCount, s.plannedMinutes], [1, 3, 33, 3, 135]);
    assert.equal(s.next?.date, "2026-11-20");
  });
  it("formats planned minutes", () => {
    const l = { hour: "sa", minute: "dk" };
    assert.deepEqual([formatPlannedMinutes(210, l), formatPlannedMinutes(45, l), formatPlannedMinutes(120, l)], ["3 sa 30 dk", "45 dk", "2 sa"]);
  });
});
describe("spotlightDelay", () => {
  it("steps 25 ms and caps at 400", () => assert.deepEqual([0, 3, 100].map(spotlightDelay), [0, 75, 400]));
});
```

- [ ] **Step 2: Run it.**
Run: `pnpm --filter @mentor/core build; pnpm --filter @mentor/core test`
Expected: FAIL. The new exports are missing (`monthGridDays is not a function` or similar).

- [ ] **Step 3: Implement the two core files and export them from `index.ts`.** Move the bodies from the web libs. Only the colour becomes generic.

- [ ] **Step 4: Switch the six web files to core.**

- [ ] **Step 5: Verify.**
Run: `pnpm --filter @mentor/core build; pnpm --filter @mentor/core test; pnpm --filter @mentor/web test`
Expected: all pass. The web specs `plan-calendar-layout`, `plan-calendar-item`, `plan-events`, `plan-subject-summary` and `coach-plan-calendar-item` pass unchanged.

---

### Task 2: Mobile calendar rules, theme tokens, saved scale

**Files:**
- Create: `apps/mobile/src/lib/plan-calendar.ts`, `apps/mobile/src/lib/plan-calendar.spec.ts`
- Modify: `apps/mobile/src/lib/plan-timeline.ts` + spec:
  - `PlanViewMode` gains `"calendar"`, and `readPlanViewMode("calendar")` returns it.
  - `timelineSync` is renamed `scrollSync`, and its fields `week` / `pinnedWeek` become `range` / `pinnedRange`.
  - Update the caller in `components/plan/plan-timeline.tsx`.
- Modify: `apps/mobile/src/lib/plan-view.ts` + spec: `monthGridDays` is renamed `dateSheetMonthDays`. `monthGridWeeks` uses it.
- Modify: `apps/mobile/src/lib/plan-view-store.ts`: `loadPlanCalendarScale()` and `savePlanCalendarScale(scale)`, key `mentor.plan.calendar-scale.v1`, in the same shape as the view.
- Modify: `packages/ui/src/tokens.ts`: `ThemePalette` gains `chip`, `chipText` and `thumbViolet`. Add them to every object typed `ThemePalette`:

  | Palette | `chip` | `chipText` | `thumbViolet` |
  |---|---|---|---|
  | light, and the scene palettes | `#BEA1FE` | `#7C6F97` | `#DDACE5` |
  | dark | `#332C47` | `#C4B8E0` | `#DDACE5` |

**Interfaces:**
- Consumes (Task 1): `monthGridDays`, `planEventSwatch`, `PLAN_EVENT_NEUTRAL_SWATCH`, `planTaskCalendarItems`, `studentEventCalendarItem`, `PlanCalendarItem`, `PlanEventSwatch`.
- Produces:
  - `type PlanCalendarScale = "week" | "month"`
  - `readPlanCalendarScale(raw: string | null): PlanCalendarScale`
  - `interface PlanCalendarState { anchor: string; selected: string; month: string; monthStep: MonthStep | null }`. `month` is the board's first day, `YYYY-MM-01`.
  - `initialPlanCalendarState(today: string): PlanCalendarState`
  - `boardDays(month: string): string[]` (42 days)
  - `pickDay(state: PlanCalendarState, iso: string): PlanCalendarState`: the month becomes the day's month.
  - `followDay(state: PlanCalendarState, iso: string): PlanCalendarState`: the month is kept while `boardDays(month)` holds the day.
  - `stepCalendar(state: PlanCalendarState, scale: PlanCalendarScale, direction: -1 | 1, today: string): PlanCalendarState`
    - week: `shiftPlanWeek` by ±7, then the month by the `followDay` rule.
    - month: `stepMonth(selected, direction, monthStep)`; the month becomes the new day's month and `monthStep` keeps the result, so 31 Jan → 28 Feb → 31 Mar.
    - Every transition sets `anchor = weekStart(selected)`. Only a month step keeps `monthStep`; picks, follows and week steps clear it.
  - `boardWeekRow(days: readonly string[], selected: string): number`
  - `agendaActiveDay(tops: readonly { iso: string; top: number }[], scrollTop: number): string | null`: the last top ≤ `scrollTop + 8`.
  - `legendSubjects(tasksByDate: Record<string, readonly { subject: string | null }[]>, monthKey: string): { subject: string; count: number }[]`
  - `highlightedSubject(picked: string | null, tasksByDate: Record<string, readonly { subject: string | null }[]>, monthKey: string): string | null`
  - `interface PlanEventTint { bg: string; bar: string }`
  - `planEventTint(swatch: PlanEventSwatch, palette: Pick<ThemePalette, PlanEventSwatchToken | "surface">): PlanEventTint`
  - `type PlanBoardItem = PlanCalendarItem<PlanTaskDto | PlanEventDto, PlanEventTint>`
  - `calendarItemsByDate(tasksByDate: Record<string, PlanTaskDto[]>, eventsByDate: Record<string, PlanEventDto[]>, viewerId: string, labels: PlanTaskItemLabels & StudentEventLabels, palette: Pick<ThemePalette, PlanEventSwatchToken | "surface">): Record<string, PlanBoardItem[]>`: each day's tasks first, then its meetings. Tasks are tinted by `planEventSwatch(subject)`, meetings by `PLAN_EVENT_NEUTRAL_SWATCH`.

- [ ] **Step 1: Write the failing specs.**

`plan-calendar.spec.ts`:

```ts
const nov = (patch: Partial<PlanCalendarState> = {}): PlanCalendarState => ({ anchor: "2026-11-23", selected: "2026-11-25", month: "2026-11-01", monthStep: null, ...patch });

it("reads the saved scale: only Ay is kept, Gün waits for B2b", () => {
  assert.equal(readPlanCalendarScale("month"), "month");
  for (const raw of ["week", "day", "garbage", "", null]) assert.equal(readPlanCalendarScale(raw), "week");
});
it("a pick takes the day's month, a spill day included", () => {
  assert.deepEqual(pickDay(nov(), "2026-12-02"), { anchor: "2026-11-30", selected: "2026-12-02", month: "2026-12-01", monthStep: null });
});
it("a scroll keeps the board month while its grid holds the day", () => {
  assert.equal(followDay(nov(), "2026-12-06").month, "2026-11-01");
  assert.equal(followDay(nov(), "2026-12-07").month, "2026-12-01");
});
it("Ajanda steps keep the month until the week leaves the grid, both ways", () => {
  const a = stepCalendar(nov(), "week", 1, "2026-11-15");
  assert.deepEqual([a.anchor, a.selected, a.month], ["2026-11-30", "2026-11-30", "2026-11-01"]);
  const b = stepCalendar(a, "week", 1, "2026-11-15");
  assert.deepEqual([b.anchor, b.selected, b.month], ["2026-12-07", "2026-12-07", "2026-12-01"]);
  assert.equal(stepCalendar(b, "week", -1, "2026-11-15").month, "2026-12-01"); // 30 Nov is in December's grid
});
it("Ay steps keep the day across short months", () => {
  const jan = nov({ anchor: "2027-01-25", selected: "2027-01-31", month: "2027-01-01" });
  const feb = stepCalendar(jan, "month", 1, "2026-11-15");
  assert.deepEqual([feb.selected, feb.month], ["2027-02-28", "2027-02-01"]);
  assert.equal(stepCalendar(feb, "month", 1, "2026-11-15").selected, "2027-03-31");
});
it("the board always holds the selected day", () => {
  let s = initialPlanCalendarState("2026-11-15");
  const ops: ((x: PlanCalendarState) => PlanCalendarState)[] = [(x) => followDay(x, "2026-12-03"), (x) => stepCalendar(x, "week", 1, "2026-11-15"), (x) => stepCalendar(x, "week", -1, "2026-11-15"), (x) => pickDay(x, "2026-10-27"), (x) => stepCalendar(x, "month", -1, "2026-11-15"), (x) => followDay(x, "2026-09-28")];
  for (const op of ops) { s = op(s); assert.ok(boardDays(s.month).includes(s.selected), `${s.month} ${s.selected}`); assert.equal(s.anchor, weekStart(s.selected)); }
});
it("finds the selected week's row", () => {
  const days = boardDays("2026-11-01");
  assert.deepEqual([boardWeekRow(days, "2026-11-15"), boardWeekRow(days, "2026-12-06"), boardWeekRow(days, "2026-10-26")], [2, 5, 0]);
});
it("spies the last day whose top has passed the fold", () => {
  const tops = [{ iso: "a", top: 0 }, { iso: "b", top: 100 }, { iso: "c", top: 250 }];
  assert.deepEqual([0, 91, 92, 1000].map((y) => agendaActiveDay(tops, y)), ["a", "a", "b", "c"]);
  assert.equal(agendaActiveDay([], 0), null);
});
it("lists the month's subjects, busiest first, then by Turkish name", () => {
  const byDate = { "2026-11-03": [{ subject: "Tarih" }, { subject: "Fizik" }], "2026-11-04": [{ subject: " Tarih " }, { subject: null }, { subject: "Coğrafya" }], "2026-12-01": [{ subject: "Tarih" }] };
  assert.deepEqual(legendSubjects(byDate, "2026-11"), [{ subject: "Tarih", count: 2 }, { subject: "Coğrafya", count: 1 }, { subject: "Fizik", count: 1 }]);
  assert.equal(highlightedSubject("Fizik", byDate, "2026-11"), "Fizik");
  assert.equal(highlightedSubject("Fizik", byDate, "2026-12"), null);
});
const palette = { progress: "#55ACEE", chip: "#BEA1FE", thumbViolet: "#DDACE5", success: "#15803D", star: "#FBBF24", secondary: "#4B5563", surface: "#FFFFFF" };
it("tints a swatch over the surface", () => {
  assert.deepEqual(planEventTint({ token: "progress", tint: 18 }, palette), { bar: "#55ACEE", bg: mixHex("#55ACEE", "#FFFFFF", 0.18) });
});
it("puts a day's tasks before its meetings", () => {
  const task = { id: "t1", taskDate: "2026-11-03", title: "Tekrar", subject: "Tarih", status: "PENDING", startTime: "20:00", endTime: null, description: null } as PlanTaskDto;
  const meeting = { id: "e1", eventDate: "2026-11-03", title: "Görüşme", startTime: "09:00", endTime: "09:30", description: null, status: "SCHEDULED", organizerUserId: "coach" } as PlanEventDto;
  const out = calendarItemsByDate({ "2026-11-03": [task] }, { "2026-11-03": [meeting] }, "me", { done: "D", hint: "H", withCoach: "Koçunla", cancelled: "İptal" }, palette);
  assert.deepEqual(out["2026-11-03"].map((i) => i.id), ["t1", "e1"]);
  assert.deepEqual(out["2026-11-03"][1].color, planEventTint(PLAN_EVENT_NEUTRAL_SWATCH, palette));
});
```

- In `plan-timeline.spec.ts`:
  - `readPlanViewMode("calendar")` returns `"calendar"`.
  - The `timelineSync` cases call `scrollSync` with `range` / `pinnedRange`.
- In `plan-view.spec.ts`: the `monthGridDays` cases call `dateSheetMonthDays`.

- [ ] **Step 2: Run it.**
Run: `pnpm --filter @mentor/mobile test`
Expected: FAIL on the missing module and exports.

- [ ] **Step 3: Implement.**
  - The lib files, the store functions and the tokens.
  - Then rebuild ui: `pnpm --filter @mentor/ui build`.
  - Then rename the caller in `plan-timeline.tsx`.
  - `legendSubjects` sorts with `localeCompare(…, "tr")`.

- [ ] **Step 4: Verify.**
Run: `pnpm --filter @mentor/mobile test; pnpm --filter @mentor/mobile typecheck; pnpm --filter @mentor/mobile lint`
Expected: all pass (71 + the new cases).

---

### Task 3: Data, copy, the add form's title and the task details sheet

**Files:**
- Modify: `apps/mobile/src/lib/content-api.ts`: `listPublicHolidays(from: string, to: string): Promise<PublicHolidayDto[]>` (`/v1/content/holidays?from&to`).
- Create: `apps/mobile/src/components/plan/calendar/use-plan-calendar-data.ts`
- Modify: `apps/mobile/src/i18n/tr.ts`, `en.ts` (`plan`): add these keys, verbatim from the web except the plural split:
  - Views and header: `view_calendar`, `calendar_back`, `go_today`, `calendar_scale_agenda`, `calendar_scale_month`, `calendar_scale_aria`, `calendar_prev_week`, `calendar_next_week`, `calendar_prev_month`, `calendar_next_month`
  - Board: `calendar_strip_expand`, `calendar_strip_collapse`, `calendar_more`, `calendar_add_on`
  - Legend: `calendar_legend_aria`, `calendar_legend_clear`, `legend_progress`, `legend_days_one`, `legend_days_other`, `legend_hour_short`, `legend_minute_short`, `legend_next_short`
  - Details and add: `new_event_title`, `event_status_done`, `event_status_pending`, `coach_note`, `calendar_preview_done`, `calendar_preview_hint`
- Modify: `apps/mobile/src/components/plan/plan-task-form-sheet.tsx`
  - `PlanFormMode`'s add arm becomes `{ kind: "add"; date: string; origin?: "calendar" }`.
  - The title is `new_event_title` when `origin === "calendar"`, otherwise `add_sheet_title`.
- Create: `apps/mobile/src/components/plan/calendar/plan-task-details-sheet.tsx`

**Interfaces:**
- Consumes (Task 2): `boardDays`, `calendarItemsByDate`, `PlanBoardItem`. Also `groupPlanTasksByDate` and `groupPlanEventsByDate` (core), and `listPlanTasksForRange` / `listPlanEventsForRange` (`coaching-api`).
- Produces:
  - `usePlanCalendarData(month: string, enabled: boolean)` returns:

    ```ts
    {
      days: string[];
      tasksByDate: Record<string, PlanTaskDto[]>;
      itemsByDate: Record<string, PlanBoardItem[]>;
      holidaysByDate: Record<string, PublicHolidayDto>;
      loading: boolean;
      isError: boolean;
      refetch: () => void;
    }
    ```

    - Tasks: `["plan-tasks", "month", month]`, over `boardDays(month)`, with every day filled with `[]`.
    - Meetings: `["plan-events", "month", month]`, `retry: false`. An error gives `{}`.
    - Holidays: `["holidays", month]`, `retry: false`, `staleTime` 24 h. An error gives `{}`, silently.
    - `loading` is true while the tasks query has no data.
  - `PlanTaskDetailsSheet(props: { task: PlanTaskDto | null; onClose: () => void; onEdit: (task: PlanTaskDto) => void; onDelete: (task: PlanTaskDto) => void }): JSX.Element | null`

- [ ] **Step 1: Copy.** Add the keys to both catalogues.
  Run: `pnpm --filter @mentor/mobile test`
  Expected: the `i18n` parity spec passes.

- [ ] **Step 2: Write the API function, the hook and the form title.**
  - `plan.tsx` already reaches the new keys by prefix: `refreshAfterChange` invalidates `["plan-tasks"]` after every write, and the pull-to-refresh also invalidates `["plan-events"]`. Do not add new invalidations. Holidays are not refreshed on a pull (24 h stale time).

- [ ] **Step 3: Write `PlanTaskDetailsSheet`** after `plan-event-details.tsx`, in the same `FormSheet` as `PlanEventSheet`. The title is `event_details_title`.
  - **Banner:**
    - `padding` 16 and `radii.card`. Its fill is `planEventTint(planEventSwatch(task.subject), palette).bg`.
    - Title: 18 bold `main`. When done it is struck through at 0.7.
    - A clock line: `ClockCircleIcon` 16 and `"{formatDateLabel(taskDate, locale, t('today'), { alwaysFull: true })}, {formatTimeRange(start, end) ?? t('all_day')}"`, 14 `main`.
  - **Rows** (the web's `DetailRow`):
    - Layout: label 14 `secondary` on the left, value 14 medium `main` on the right with `numberOfLines={1}`. Multiline rows stack. A hairline (`main` at 8 %) sits between rows.
    - The rows:
      - `subject`: "subject › topic", or "—"
      - `event_status`: done or pending
      - `duration_label`: `duration_minutes`, when set
      - `coach_note`: multiline, when set
      - `description`: multiline, when set
  - **Buttons:** hidden when `isPastDate(task.taskDate)`.
    - Two outlined buttons with `minHeight` 44, side by side.
    - `task_action_edit` with a pen icon: only when `!isCoachAssigned(task)`. Border `main` at 15 %.
    - `task_action_delete` with a trash icon: border `danger` at 30 %, `danger` text.
  - There is no tick anywhere.

- [ ] **Step 4: Verify.**
Run: `pnpm --filter @mentor/mobile test; pnpm --filter @mentor/mobile typecheck; pnpm --filter @mentor/mobile lint`
Expected: all pass.

---

### Task 4: The month board, the card header and the gesture root

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`. Wrap everything under `RootLayout` in `<GestureHandlerRootView style={{ flex: 1 }}>`, outermost.
- Create: `apps/mobile/src/components/plan/calendar/plan-calendar-header.tsx`
- Create: `apps/mobile/src/components/plan/calendar/plan-month-board.tsx`

**Interfaces:**
- Consumes:
  - From Task 2: `boardDays`, `boardWeekRow`, `PlanBoardItem`, `PlanCalendarScale`.
  - From Task 1: `spotlightDelay`.
  - From core: `formatMonthTitle`, `isPastDate`, `todayIso`.
  - `SlidingTabs`.
- Produces:
  - `PlanCalendarHeader(props: { scale: PlanCalendarScale; month: string; onScaleChange: (scale: PlanCalendarScale) => void; onStep: (direction: -1 | 1) => void; onToday: () => void }): JSX.Element`
  - `PlanMonthBoard(props: { month: string; selectedDate: string; itemsByDate: Record<string, PlanBoardItem[]>; holidaysByDate: Record<string, PublicHolidayDto>; highlight: string | null; expanded: boolean; onSelectDate: (iso: string) => void; onOpenItem: (source: PlanTaskDto | PlanEventDto) => void; onExpandedChange: (expanded: boolean) => void }): JSX.Element`

- [ ] **Step 1: Write `PlanCalendarHeader`.**
  - **Row 1:**
    - The title: `formatMonthTitle(month, locale)`, 16 bold `main`, `flex: 1`, `numberOfLines={1}`. Only in Ay; in Ajanda a spacer stands in its place.
    - "Bugün" (`go_today`): a `surfaceAlt` pill, `minHeight` 36, 14 semibold.
    - ‹ ›: the `PlanWeekCard` arrow buttons, labelled `calendar_prev_{week|month}` / `calendar_next_{week|month}`.
  - **Row 2:** `SlidingTabs` with `week` → `calendar_scale_agenda` and `month` → `calendar_scale_month`, labelled `calendar_scale_aria`.

- [ ] **Step 2: Write `PlanMonthBoard`.**
  - **Constants:** `ROW = 84`, `ROWS = 6`, `COLLAPSED = 40`, `TRAVEL = ROWS * ROW - COLLAPSED`, `MAX_CHIPS = 2`.
  - **Weekday row:** `week_mon`…`week_sun`, 11 medium uppercase `secondary`, `paddingBottom` 4.
  - **Box:** an `Animated.View` with `overflow: "hidden"` and height `COLLAPSED + progress * TRAVEL`.
    - Inside it, the grid is shifted by `translateY: -(1 - progress) * row * ROW`.
    - `row` is a shared value. It animates the settle timing when `boardWeekRow(days, selectedDate)` changes.
  - **Grid:** six explicit week rows of seven cells (a 1/7 flex-wrap fits six cells on Android).
    - A cell is `height: ROW`, centred, `paddingTop` 4, `gap` 6, `paddingHorizontal` 1.
    - Opacity is 0.45 outside the month, then 0.75 when past, otherwise 1.
  - **Day number:** a 32 × 32 `Pressable` that calls `onSelectDate`.
    - Text: 14 bold. White when selected, `progress` for today, `chipText` for a holiday, `main` otherwise.
    - Accessibility: selected state, plus "today" in its label.
  - **Selected pill:**
    - One absolute 32 × 32 `progress` circle inside the shifted grid, under the numbers. Its `translateX` is column × the measured cell width plus `(cellWidth − 32) / 2`; its `translateY` is row × `ROW` plus the cell's 4 dp top padding.
    - It moves with a spring: stiffness 420, damping 36, mass 1.
  - **Under the number:**
    - The holiday name: 8 / 11, `chipText` at 0.75, one line.
    - Then up to two chips, each a `Pressable` calling `onOpenItem(item.source)`:
      - Text 8 / 11 `main`, one line, `paddingHorizontal` 2, radius 3.
      - Fill `item.color.bg`, with a 2 dp left border in `item.color.bar`.
      - Struck through when `item.muted`.
      - The accessibility label is the title.
    - Then `calendar_more` "+N" in 8 / 11 semibold `progress`.
  - **Highlight:** when `highlight` is set, chips whose `groupKey` matches get `boxShadow: 0 0 0 1px <bar>`. They light in reading order, each waiting `spotlightDelay(litIndex)` and fading in over 260 ms. Every other chip goes to opacity 0.32.
  - **Collapsed:** rows other than the selected week are hidden from accessibility (`importantForAccessibility="no-hide-descendants"`).
  - **Handle:** a 112 × 44 view centred under the box, holding a 40 × 4 bar (`main` at 22 %).
    - Accessibility: role button, label `calendar_strip_expand` or `calendar_strip_collapse`, `accessibilityState.expanded`, and an `activate` action that toggles.
  - **Gesture** (UI thread). Check the exact v3 shapes in `node_modules/react-native-gesture-handler/lib/typescript/v3` before writing it.
    - `usePanGesture` with `activeOffsetY: [-4, 4]` and `failOffsetX: [-24, 24]`. Callbacks carry `"worklet"`:
      - `onBegin`: `base = progress`.
      - `onUpdate`: `progress = clamp01(base + e.translationY / TRAVEL)`.
      - `onDeactivate`: `settled = progress > 0.5`; settle with timing; then `runOnJS(onExpandedChange)(settled)` when it differs from `expanded`.
    - `useTapGesture`: its end toggles.
    - Compose them with `useCompetingGestures` inside one `GestureDetector`.
  - **When `expanded` changes from outside** (segment, release): progress settles to 0 or 1. With reduced motion it jumps.

- [ ] **Step 3: Verify.**
Run: `pnpm --filter @mentor/mobile typecheck; pnpm --filter @mentor/mobile lint`
Expected: pass. Drag smoothness is checked on device in Task 7, QA 2.

---

### Task 5: Ajanda and the subject legend

**Files:**
- Create: `apps/mobile/src/components/plan/calendar/plan-agenda.tsx`
- Create: `apps/mobile/src/components/plan/calendar/plan-subject-legend.tsx`

**Interfaces:**
- Consumes:
  - From Task 2: `agendaActiveDay`, `legendSubjects`, `PlanBoardItem`, `planEventTint`, `planEventSwatch`.
  - From `plan-timeline.ts`: `scrollSync`, `timelineEndSpace`.
  - From core: `layoutDayEvents`, `formatTimeRange`, `summarizeSubjectMonth`, `formatPlannedMinutes`, `formatDateLabel`, `isPastDate`, `todayIso`.
- Produces:
  - `PlanAgenda(props: { days: string[]; month: string; itemsByDate: Record<string, PlanBoardItem[]>; holidaysByDate: Record<string, PublicHolidayDto>; loading: boolean; selectedDate: string; scrollRequest: number; onActiveDayChange: (iso: string) => void; onOpenItem: (source: PlanTaskDto | PlanEventDto) => void }): JSX.Element`
  - `PlanSubjectLegend(props: { monthKey: string; tasksByDate: Record<string, PlanTaskDto[]>; active: string | null; onSelect: (subject: string | null) => void }): JSX.Element | null`

- [ ] **Step 1: Write `PlanAgenda`.**
  - **Sync:** mirror `plan-timeline.tsx`'s sync, with the month as the range:
    - On a month visit, a render-time reset clears `boxes` and `readyMonth`.
    - `handled = useRef(scrollRequest)`, plus an `emitted` ref and a suppress window of 120 ms.
    - One effect runs `scrollSync({ range: month, pinnedRange: readyMonth, loading, measured: all 42 boxes and the viewport, request: scrollRequest, handled })`. Both "pin" and "scroll" jump to `boxes[selectedDate].top` with `animated: false`.
  - **Scroller:** `height: 0.6 * windowHeight`, `nestedScrollEnabled`, `scrollEventThrottle={16}`, no snap.
    - After the last day comes an end spacer of `timelineEndSpace(height, lastDayHeight, 0)`, so every day can reach the top. The web has none; this is ledgered as a ruling.
    - `onScroll` runs the spy (`agendaActiveDay`) unless suppressed. It reports a changed day once through `onActiveDayChange`.
  - **Cover:** until pinned, a small agenda skeleton (three day blocks with two row bars, using the ui `Skeleton`) covers the scroller.
  - **Section:**
    - `paddingVertical` 12, `gap` 8, a bottom hairline (`main` at 8 %), and opacity 0.7 when past.
    - `onLayout` reports its top and height.
  - **Header** (baseline row, `gap` 8):
    - The day, "15 Kas" (`toLocaleDateString(tr-TR|en-GB, { day: "numeric", month: "short" })`): 18 bold, `progress` for today, otherwise `main`.
    - Then `t("today")` or the long weekday, 14 `secondary`.
    - Then the holiday name, 14 `chipText` at 0.75, one line.
  - **Body:**
    - `timeline_day_empty` (14 `secondary`) when the day has no items.
    - Otherwise `layoutDayEvents(items)`: its `allDay` first ("Tüm gün"), then `timed` (`formatTimeRange`).
  - **Row** (`Pressable`, `minHeight` 44, `paddingVertical` 6, `gap` 12; tap calls `onOpenItem`):
    - A 64-wide time column, 12 `secondary`, tabular numbers.
    - A 4 × 16 bar in `item.color.bar`.
    - The title, 16 medium (struck through at 0.7 when muted), one line.
    - The meta, 12 `secondary`, one line.

- [ ] **Step 2: Write `PlanSubjectLegend`.**
  - Hidden when the month has no subjects.
  - **Container:** `flexWrap` with `gap` 6, a top hairline, `paddingTop` 12, labelled `calendar_legend_aria`.
  - **Pill** (`minHeight` 36, radius full, `paddingHorizontal` 10, 12 text):
    - A 4 × 12 bar, the subject, and the count in `secondary`.
    - Active: fill is the tint's `bg`, the border is its `bar`, `translateY` −1, `boxShadow: 0 4px 12px <bar at 32 %>`.
    - Inactive while one is active: opacity 0.45.
    - Selected state.
    - Tap: `onSelect(active ? null : subject)`.
  - **"Vurguyu kaldır"** (`calendar_legend_clear`): 12 semibold `progress`, only while one is active.
  - **Summary line:** a full-width line, 12 `secondary`, shown when active and `summary.total > 0`. It joins these with " · ":
    - `legend_progress`
    - `legend_days_one` or `legend_days_other`
    - `formatPlannedMinutes(…, { hour: legend_hour_short, minute: legend_minute_short })` when not null
    - `legend_next_short` with `formatDateLabel(next.date, locale, t("today"), { compact: true })` when there is a next one

- [ ] **Step 3: Verify.**
Run: `pnpm --filter @mentor/mobile typecheck; pnpm --filter @mentor/mobile lint`
Expected: pass.

---

### Task 6: Takvim on the Plan screen

**Files:**
- Create: `apps/mobile/src/components/plan/calendar/plan-calendar.tsx`
- Modify: `apps/mobile/src/app/(app)/(tabs)/plan.tsx`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `PlanCalendar(props: { state: PlanCalendarState; scale: PlanCalendarScale; scrollRequest: number; viewerId: string | null; onScaleChange: (scale: PlanCalendarScale) => void; onPick: (iso: string) => void; onFollow: (iso: string) => void; onStep: (direction: -1 | 1) => void; onToday: () => void; onEdit: (task: PlanTaskDto) => void; onDelete: (task: PlanTaskDto) => void; onOpenEvent: (event: PlanEventDto) => void }): JSX.Element`

- [ ] **Step 1: Write `PlanCalendar`.**
  - **Card:** a `PanelCard` with padding 12 and `gap` 12.
  - **Data:** `usePlanCalendarData(state.month, true)` with labels from `t`.
  - **Order:**
    - `PlanCalendarHeader`.
    - `PlanMonthBoard`, with `expanded={scale === "month"}`. Its `onExpandedChange` maps to `onScaleChange("month" | "week")`.
    - Then `PlanAgenda` in Ajanda, or `PlanSubjectLegend` in Ay.
  - **Highlight:** the picked subject is local state. It is passed as `highlightedSubject(picked, tasksByDate, month.slice(0, 7))` and only in Ay.
  - **Items:** `calendarItemsByDate` gets `viewerId ?? ""` (no meeting has an empty organizer).
  - **Opening an item:** `"taskDate" in source` tells a task from a meeting. A task opens `PlanTaskDetailsSheet`, which this component holds. A meeting goes to `onOpenEvent`.
  - **Düzenle / Sil:** the details sheet closes first, then hands the task to `onEdit` / `onDelete`, so two sheets are never open at once.
  - **Error:** with no data and `isError`, a `StateView` with retry replaces the agenda and legend.

- [ ] **Step 2: Wire `plan.tsx`.**
  - **State:**
    - `view` becomes `PlanCalendarState` (`initialPlanCalendarState(todayIso())`).
    - `scale` comes from `loadPlanCalendarScale()`; `changeScale` saves it.
  - **Handlers:**
    - Picks: `pick(iso)` = `pickDay`, plus a scroll request. Used by strip and Ay taps, the week card's day taps and Timeline dots.
    - Scroller follows: `follow(iso)` = `followDay`, with no request. Used by the agenda spy and the Timeline scroller.
    - Saved task and date-sheet apply: `followDay` plus a request.
    - Takvim ‹ ›: `stepCalendar(s, scale, dir, todayIso())` plus a request.
    - "Bugün": `pickDay(s, todayIso())` plus a request.
    - Week card arrows: `stepCalendar(s, "week", ±1, today)` with no request, which is today's behaviour.
  - **Takvim mode** (`mode === "calendar"`):
    - The header row is a back button plus `PlanPuhuAction`. The back button is a 40 round `surfaceAlt` button with an arrow-left icon, labelled `calendar_back`; it does `changeMode("list")`.
    - There is no `SlidingTabs`, no `PlanWeekCard` and no past-day notice. `PlanCalendar` follows.
    - The switcher outside Takvim lists Liste · Timeline · Takvim (`view_calendar`).
  - **Android back:** while Takvim is shown and the tab is focused, `BackHandler` returns to Liste and consumes the press. Use `useFocusEffect` from expo-router.
  - **FAB:**
    - Placement: outside the `ScrollView`, absolute, `right` 20, `bottom` `tabBarClearance(insets.bottom)`.
    - Look: 56 round `main` fill, a plus icon in `surface`, `cardShadow`.
    - Label: `calendar_add_on` with the full date.
    - Action: `setFormMode({ kind: "add", date: selectedDate, origin: "calendar" })`. Hidden when the selected day is past.
    - In Takvim the page's bottom padding grows by 72.
  - Keep the growth of `plan.tsx` within about 50 lines; anything more goes into `PlanCalendar`.

- [ ] **Step 3: Verify.**
Run: `pnpm --filter @mentor/mobile test; pnpm --filter @mentor/mobile typecheck; pnpm --filter @mentor/mobile lint`
Expected: all pass. Liste and Timeline behave as before (Task 7, QA 1).

---

### Task 7: Standards note, device QA and gate

**Files:**
- Modify: `docs/standards/mobile.md`. Add a "2026-11-15 — Plan tab, Takvim (stop B2a)" entry in the timeline, in the same shape as B1's. It covers:
  - the app-root `GestureHandlerRootView`: a local root never starts the pan ("didn't get starting ACTION_DOWN")
  - why PanResponder was rejected (a 1.3 s stall)
  - the board-month rule
  - the gotchas QA finds

- [ ] **Step 1: Run device QA** on the emulator (see the memory note "mobile emulator run recipe").
  - **Seed** with the QA student via the API:
    - a busy future day this month with five tasks across three subjects, two of them with long titles
    - one task on 29 October (Cumhuriyet Bayramı is in the dev holidays)
    - a timed and an all-day task on one day
  - Screenshots go to `apps/mobile/.expo/qa/takvim/`.
  - Cleanup at the end deletes the seeded tasks by id. Past ones go through the dev DB, since the API answers 403.
  - **Steps:**
    1. Liste → Takvim → Geri → Takvim; Android back from Takvim returns to Liste. A relaunch reopens Takvim on the saved scale. Liste and Timeline (switch, scroll, pin) behave as in B1.
    2. **Board drag:** with `pointer_location` on, drag slowly; the board follows the finger.
       - Release under half: back to Ajanda. Past half: Ay.
       - Tap the handle: it toggles once.
       - A vertical drag on the handle never scrolls the page.
       - Tap the segment mid-settle: one final state.
    3. **Ajanda:**
       - Scroll: the pill follows.
       - Tap three strip days quickly, then "Bugün", then ‹ ›. Each jumps once, with no echo.
       - Fling from 30 Nov into December. The board stays on November with no cover; scroll over the boundary week both ways and the month never flips.
       - › past 6 Dec: December loads under the cover and pins.
    4. **Ay:**
       - ‹ › from 31 Jan to February to March keeps the day.
       - The busy day shows two chips and "+3 tane daha"; long titles clip.
       - In October, the holiday name shows over the 29th.
       - Outside-month days are faded; tapping a spill day switches the month.
    5. **Legend:**
       - Highlight a subject: matching chips ring in order and the rest fade.
       - The summary line reads right.
       - "Vurguyu kaldır" clears it.
       - Step to a month without that subject: the highlight is gone.
    6. **Details:**
       - A chip or agenda row opens the sheet. Düzenle opens the form. Sil confirms, and the item leaves both board and agenda.
       - A coach task has no Düzenle.
       - A past day has no buttons.
       - A meeting opens its own sheet.
    7. **"+":** on a future day it opens "Yeni etkinlik" on that day, and saving lands the agenda on the new task's day. It is hidden on a past day.
    8. **Holidays failing:** with the API's holidays route returning an error (stop the API briefly, or point at a wrong path in a throwaway edit), there are no names and no error.
    9. **Refresh and settings:**
       - Pull to refresh from above the card works.
       - Dark theme: chip colours are readable.
       - 360 dp (`wm density 480`).
       - Reduced motion (the three animator scales at 0, then reload): the board, pill and row jump, and there is no spring.
       - Put every emulator setting back afterwards.
- [ ] **Step 2: Write the `mobile.md` entry.**
- [ ] **Step 3: Run the gate.**
Run: `pnpm --filter @mentor/core test`, `pnpm --filter @mentor/web test`, `pnpm --filter @mentor/mobile test`, `pnpm --filter @mentor/mobile typecheck`, `pnpm --filter @mentor/mobile lint`
Expected: all pass.
