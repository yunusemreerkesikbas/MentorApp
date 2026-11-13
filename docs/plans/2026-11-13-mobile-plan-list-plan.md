# Mobile Plan Tab, Stop A (Liste) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mobile Plan tab becomes the web's Liste view at phone width: a week card, the past-day
notice, and a "Görevler" card with tasks and coach meetings. Students can add, edit, tick, delete
and start a session, all through bottom sheets.

**Architecture:**
- The pure plan rules the web already has move to `@mentor/core`, and the web files re-export or
  call them. These are the time helpers, the coach-task lock, event grouping, and the add/edit
  validation and payload shaping.
- Mobile gets a thin `plan.tsx` orchestrator, new `components/plan/*`, a titled sheet frame, a
  confirm dialog, and a `plan` copy namespace that mirrors the web keys.
- The four Phase 2 plan components are deleted.
- **Commits:** none. The owner commits when they ask.

**Tech Stack:** TypeScript, `@mentor/core` (node:test), Next.js web (Vitest), Expo SDK 58 / RN 0.88 /
Expo Router / TanStack Query v5.

**Spec:** `docs/plans/2026-11-13-mobile-plan-list-design.md`

## Global Constraints

- **Branch and files:** branch `feature/APP-142-mobile-core-qa`. Touch only files this plan names.
  Other sessions' uncommitted work (landing, SEO, consent, forum, community, `docs/standards/api.md`,
  `web-shell.md`, the promo doc) stays as it is.
- **Packages:**
  - After any `packages/core` or `packages/ui` change, rebuild it (`pnpm --filter @mentor/core
    build`), because mobile and the core specs read `dist`.
  - Core specs import from `../dist/index.js`. Mobile specs live in `apps/mobile/src/lib/*.spec.ts`
    and import `.ts` files directly.
- **Copy:**
  - The web copy is used as-is (owner rule). Mobile's formatter only fills `{name}` placeholders.
  - `i18n.spec.ts` enforces TR/EN key parity and the voice.md bans: no em dash, no "lütfen", no
    "AI" in TR.
- **Hidden in this stop:** the Liste / Timeline / Takvim switcher, "Puhu'yla planla", the analysis
  locked-focus form, community links and prompts, and holidays.
- **Past days:** a selected day before `todayIso()` (Istanbul) shows the notice. It has no "+", no
  "⋯", no toggle and no "Seans başlat →". Every mutation also re-checks `isPastDate(task.taskDate)`.
- **Coach tasks:** `isCoachAssigned(task)` hides "Görevi düzenle". Delete and toggle stay.
- **Sheets:** the task menu and the time picker are bottom sheets (web popovers). The time field is
  tap-only. No new native dependency.
- **Theme:** colours come from `useThemeTokens().palette` only:
  - progress blue `progress`, selected-day well `playSelected`;
  - hairlines `playLine`, danger `danger`, scrim `scrim`.
  - Light and dark both work.
- **Secrets:** never print the QA account email or password (gitignored
  `apps/mobile/.expo/qa-accounts.json`).

## Review Focus

1. **Week across a month or year end** (e.g. 29 Aralık – 4 Ocak, or a month starting on Sunday). The
   range label, the month grid and the selected day must stay right. Test: Task 3,
   `monthGridDays` / `selectedDayForWeek` cases.
2. **A second tap while a toggle or delete is in flight.** It must do nothing: one PATCH, and no
   flicker back. Test: Task 9 guard (`busyId`) plus an emulator double-tap.
3. **Android keyboard inside the form sheet.** The focused field (description, the last one) and
   the pinned "Görev ekle" must stay above the keyboard. Test: Task 10 emulator scenario at 360 dp.
4. **Coach meetings that fail to load** (no coach, 403, network). The day shows its tasks and no
   error. Test: Task 9 maps a failed events query to `[]`; Task 10 scenario with a coachless
   account.
5. **An existing task off the five-minute grid** (e.g. 19:07, or a start with no end). The edit form
   opens with the minute listed and an end of start + 1 h. Test: Task 1 `minuteChoices(7)` and Task 2
   `plusOneHour` cases.

---

### Task 1: Plan time, coach-lock and event helpers move to `@mentor/core`

**Files:**
- Create: `packages/core/src/plan-items.ts`, `packages/core/src/plan-items.spec.ts`
- Modify: `packages/core/src/index.ts` (add `export * from "./plan-items.js";`)
- Modify: `apps/web/src/app/[locale]/(app)/plan/_components/plan-time.ts` (re-export only)
- Modify: `apps/web/src/lib/plan-task-permissions.ts` (re-export only)
- Modify: `apps/web/src/lib/plan-events.ts` (re-export `groupPlanEventsByDate`, keep the rest)

**Interfaces:**
- Produces:
  - `canonicalHm(value: string): string | null`
  - `minuteChoices(minute: number | null): number[]`
  - `pad(value: number): string`
  - `isCoachAssigned(task: Pick<PlanTaskDto, "origin">): boolean`
  - `groupPlanEventsByDate(events: PlanEventDto[]): Record<string, PlanEventDto[]>`

- [ ] **Step 1: Write the failing core spec.** Port the cases of the three web specs
  (`plan-time.spec.ts`, `plan-task-permissions.spec.ts`, `plan-events.spec.ts`, grouping part) to
  node:test, importing from `../dist/index.js`. Include at least:
  - `canonicalHm("9:05") === "09:05"`, `canonicalHm("24:00") === null`, `canonicalHm("ab") === null`;
  - `minuteChoices(null)` is `[0,5,…,55]` (12 items), `minuteChoices(7)` has 13 items with `7`
    between `5` and `10`;
  - `isCoachAssigned({ origin: { type: "MENTORSHIP" } })` is true, and `{ origin: null }` is false;
  - `groupPlanEventsByDate` keeps input order inside one date.
- [ ] **Step 2: Run it and see it fail.** Run `pnpm --filter @mentor/core build && pnpm --filter
  @mentor/core test`. Expected: FAIL, because the functions are not exported.
- [ ] **Step 3: Move the code.** Move the three bodies verbatim into `plan-items.ts` (types from
  `@mentor/types`). The web files become re-exports, so no web import site changes.
- [ ] **Step 4: Run the tests and see them pass.** Run the core build and test, then `pnpm --filter
  @mentor/web test`. Expected: all PASS. The three web specs still pass through the re-exports.

### Task 2: Add/edit task rules move to `@mentor/core`

**Files:**
- Create: `packages/core/src/plan-task-form.ts`, `packages/core/src/plan-task-form.spec.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/web/src/app/[locale]/(app)/plan/_components/plan-add-task-form.tsx`. Its local
  `plusOneHour` goes. `validate()` keeps its analysis/taxonomy/date guards first, then calls
  `planTaskDraftError`. `getValues()` spreads `planTaskFormValues(draft)` and then applies its own
  `taskDate` and the `displayFocus` subject override.
- Modify: `apps/web/src/app/[locale]/(app)/plan/_components/plan-shell.tsx`. The plain create `input`
  becomes `planTaskCreateInput(values, targetDate)` and the edit payload becomes
  `planTaskUpdateInput(values, task)`. The weekly-report, analysis and community branches stay.

**Interfaces:**
- Consumes: `canonicalHm` (Task 1); `SESSION_FOCUS_MINUTES_MIN`, `SESSION_FOCUS_MINUTES_MAX` (`@mentor/types`).
- Produces:
  ```ts
  export interface PlanTaskDraft { title: string; subject: string; allDay: boolean; startTime: string; endTime: string; description: string; duration: string }
  export interface PlanTaskFormValues { title: string; subject: string; startTime: string | null; endTime: string | null; description: string | null; durationMinutes: number | null }
  export type PlanTaskDraftError = "duration_invalid" | "task_required" | "time_invalid";
  export function plusOneHour(start: string): string;
  export function planTaskDraftError(draft: PlanTaskDraft): PlanTaskDraftError | null;
  export function planTaskFormValues(draft: PlanTaskDraft): PlanTaskFormValues;
  export function planTaskCreateInput(values: PlanTaskFormValues, taskDate: string): { title: string; taskDate: string; subject?: string; startTime?: string | null; endTime?: string | null; description?: string; durationMinutes: number | null };
  export function planTaskUpdateInput(values: PlanTaskFormValues, task: Pick<PlanTaskDto, "origin" | "subject">): { title: string; subject: string | null; startTime: string | null; endTime: string | null; description: string | null; durationMinutes: number | null };
  ```
  The bodies are the web's current lines (`plan-add-task-form.tsx` 50–55 and 104–137,
  `plan-shell.tsx` 562–570 and 693–700), unchanged in behaviour. The duration rule is an integer
  from MIN to MAX, as `studyDurationMinutesSchema` says.

- [ ] **Step 1: Write the failing spec.**
  - Error order, as the web: duration first, then title, then time. A draft with title `"  "` and
    duration `"3"` gives `"duration_invalid"`.
  - Title `"  "` with an empty duration gives `"task_required"`.
  - `allDay: false`, `09:00`–`09:00` gives `"time_invalid"`. `09:00`–`""` gives null (open-ended).
    `allDay: true` ignores the times.
  - `plusOneHour("09:30") === "10:30"` and `plusOneHour("23:15") === "23:15"`.
  - `planTaskFormValues`:
    - `{allDay:true}` gives `startTime: null, endTime: null`;
    - `"9:05"` becomes `"09:05"`;
    - a blank description becomes null; duration `""` becomes null and `"40"` becomes 40.
  - `planTaskCreateInput` leaves out `subject`, the times and `description` when they are blank or
    null, trims the title, and keeps `durationMinutes`.
  - `planTaskUpdateInput`:
    - always sends `startTime` and `endTime`, even both null;
    - keeps `task.subject` when `task.origin?.type === "WEEKLY_REPORT"`;
    - otherwise sends the trimmed subject, or null when it is blank.
- [ ] **Step 2: Run it and see it fail.** Run the core build and test. Expected: FAIL (not exported).
- [ ] **Step 3: Implement `plan-task-form.ts` and switch the two web call sites to it.**
- [ ] **Step 4: Run the tests.** Run the core build and test, `pnpm --filter @mentor/web test`, and
  `pnpm --filter @mentor/web typecheck`. Expected: PASS, and typecheck shows no errors under `src`
  (the `test-results` reds are known; do not delete that folder).

### Task 3: Mobile plan data and pure view steps

**Files:**
- Modify: `apps/mobile/src/lib/coaching-api.ts`
- Create: `apps/mobile/src/lib/plan-view.ts`, `apps/mobile/src/lib/plan-view.spec.ts`

**Interfaces:**
- Produces (coaching-api, same paging and URL shape as the web's `lib/plan-events.ts` and
  `lib/plan-tasks.ts`):
  - `listPlanEventsForRange(from: string, to: string): Promise<PlanEventDto[]>`
  - `listPlanTaskCalendarDates(from: string, to: string): Promise<string[]>`
    (`GET /v1/plan-tasks/calendar?from&to`, returns `.dates`)
- Produces (plan-view):
  - `selectedDayForWeek(anchor: string, selected: string, today: string): string`. This is the web
    shell's `handleWeekChange` rule: keep `selected` if it is in the week, else `today` if it is in
    the week, else `anchor`.
  - `monthGridDays(monthIso: string): string[]`. These are Monday-first whole weeks covering the
    month of `monthIso`, a multiple of 7 long, including outside-month days.
  - `withTaskStatus(byDay: Record<string, PlanTaskDto[]>, id: string, status: PlanTaskStatus): Record<string, PlanTaskDto[]>`.
    This is the optimistic flip; other days keep their array identity.

- [ ] **Step 1: Write the failing spec** (`plan-view.spec.ts`):
  - `selectedDayForWeek("2026-11-16", "2026-11-13", "2026-11-13") === "2026-11-16"` (Monday);
  - `selectedDayForWeek("2026-11-09", "2026-11-20", "2026-11-13") === "2026-11-13"` (today);
  - `selectedDayForWeek("2026-11-09", "2026-11-11", "2026-11-13") === "2026-11-11"` (kept).
  - `monthGridDays("2026-11-13")` starts `"2026-10-26"`, ends `"2026-12-06"`, length 42.
  - `monthGridDays("2026-02-01")` (Sunday the 1st) starts `"2026-01-26"`.
  - `monthGridDays("2026-12-31")` ends in January 2027.
  - `withTaskStatus` flips only the matching id and leaves the other days `===` unchanged.
- [ ] **Step 2: Run it and see it fail.** Run `pnpm --filter @mentor/mobile test`. Expected: FAIL
  (module missing).
- [ ] **Step 3: Implement the module.** Use `weekDates`, `weekStart`, `monthStart` and `shiftDate`
  from `@mentor/core`. Add the two API functions next to `listPlanTasksForRange`.
- [ ] **Step 4: Run the tests.** Run `pnpm --filter @mentor/mobile test`. Expected: PASS.

### Task 4: Mobile `plan` copy

**Files:**
- Modify: `apps/mobile/src/i18n/tr.ts`, `apps/mobile/src/i18n/en.ts` (replace the whole `plan`
  namespace; nothing else reads the old keys)

**Interfaces:**
- Produces: flat `plan.*` keys, values copied word for word from `apps/web/messages/{tr,en}.json`:
  - from the web `plan` keys:
    - lists and headings: `tasks_title`, `empty_desc`, `add_task`, `add_sheet_title`, `new_task`;
    - edit and delete: `edit_sheet_title`, `task_action_edit`, `edit_task_save`,
      `task_action_delete`, `task_delete_confirm_title`, `task_delete_confirm_message`,
      `task_delete_confirm_yes`, `task_delete_confirm_no`;
    - row: `start_session`, `duration_minutes`, `coach_assigned`, `task_menu_aria`;
    - week card: `progress`, `progress_percent`, `past_readonly_notice`, `calendar_aria`,
      `date_sheet_title`, `date_sheet_apply`, `prev_week_aria`, `next_week_aria`, `today`;
    - form: `all_day`, `time_start`, `time_end`, `time_invalid`, `subject_pick_label`,
      `subject_pick_hint`, `subject`, `subject_placeholder`, `description`, `duration_label`,
      `duration_optional`, `description_placeholder`, `task_placeholder`, `task_required`,
      `duration_invalid`, `loading`;
    - coach meetings: `event_with_coach`, `event_cancelled`, `event_details_title`, `event_status`;
  - from the web `common.time_picker`, flattened: `time_picker_title`, `time_picker_hour`,
    `time_picker_minute`.

- [ ] **Step 1: Replace the namespace in both files.** Run `pnpm --filter @mentor/mobile test`.
  Expected: `i18n.spec` PASS (the "5–200" en dash is allowed; only the em dash is banned).
  Typecheck fails until Task 9, because the old components still read the old keys. That is
  expected here.

### Task 5: Sheet frame, danger action and confirm dialog

**Files:**
- Modify: `apps/mobile/src/components/panel/primitives.tsx`
- Create: `apps/mobile/src/components/ui/confirm-dialog.tsx`, export it from `components/ui/index.ts`

**Interfaces:**
- Produces:
  - `FormSheet({ visible, title, closeLabel, onClose, footer, children }: { visible: boolean; title: string; closeLabel: string; onClose: () => void; footer?: ReactNode; children: ReactNode })`.
    It is built on the same `Modal` as `BottomSheet`:
    - a centred title with a × button on the right (`closeLabel` is its accessibility label);
    - a `playLine` hairline, then a `ScrollView` body (`keyboardShouldPersistTaps="handled"`);
    - `footer` pinned under the body, above `insets.bottom`;
    - at most 90 % of the window height;
    - wrapped in `KeyboardAvoidingView` (`behavior="padding"`), because the root one does not
      reach inside a `Modal`.
  - `SheetAction` gains `tone?: "danger"`. `ActionSheet` draws a danger label in `palette.danger`.
  - `ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel })`.
    It is a centred card over the scrim, mirroring the web's `useMentorDialog`:
    - cancel on the left and confirm on the right; confirm is `danger` when `destructive`;
    - the system back button cancels.

- [ ] **Step 1: Implement the three pieces.** Run `pnpm --filter @mentor/mobile lint`. Expected:
  clean for these files. They are checked visually in Task 10.

### Task 6: Week card and date sheet

**Files:**
- Create: `apps/mobile/src/components/plan/plan-week-card.tsx`, `apps/mobile/src/components/plan/plan-date-sheet.tsx`

**Interfaces:**
- Consumes: `selectedDayForWeek`, `monthGridDays`, `listPlanTaskCalendarDates` (Task 3); `FormSheet`
  (Task 5); core `weekDates`, `shiftDate`, `formatWeekRangeLabel`, `formatWeekdayShort`,
  `formatDayNumber`, `formatMonthTitle`, `shiftMonth`, `monthIsoBounds`, `taskStats`.
- Produces:
  - `PlanWeekCard({ weekAnchor, selectedDate, weekTasks, onSelectDate, onWeekChange, onOpenDatePicker }: { weekAnchor: string; selectedDate: string; weekTasks: Record<string, PlanTaskDto[]>; onSelectDate: (iso: string) => void; onWeekChange: (anchor: string) => void; onOpenDatePicker: () => void })`
  - `PlanDateSheet({ visible, initialDate, onApply, onClose }: { visible: boolean; initialDate: string; onApply: (iso: string) => void; onClose: () => void })`

- [ ] **Step 1: Build `PlanWeekCard`** as in the design's Goals 1.1. It is a `PanelCard` with:
  - a top row: ‹, the range, the calendar icon, ›;
  - seven day buttons: weekday caps over the number; today's number in `progress`; the selected day
    in a `playSelected` circle; a dot when that day has tasks;
  - when the selected day has tasks: a hairline, "{done} / {total} tamamlandı" with "%{percent}",
    and a `ProgressLine`.
  - ‹ › call `onWeekChange(shiftDate(weekAnchor, ∓7))`.
- [ ] **Step 2: Build `PlanDateSheet`:**
  - a `FormSheet` titled `date_sheet_title`, holding a "Bugün" chip, a month header with ‹ ›, and a
    Monday-first grid (outside-month days in `muted`);
  - dots come from a query `["plan-tasks", "calendar", from, to]` over the shown month, best-effort;
  - the selected day is filled; the footer is a pinned "Uygula" that calls `onApply(selected)`.
- [ ] **Step 3: Run lint.** Run `pnpm --filter @mentor/mobile lint`. Expected: clean for these
  files.

### Task 7: Task card, task row and coach meetings

**Files:**
- Create: `apps/mobile/src/components/plan/plan-task-card.tsx`, `apps/mobile/src/components/plan/plan-task-row.tsx`, `apps/mobile/src/components/plan/plan-event-row.tsx`

**Interfaces:**
- Consumes: `isCoachAssigned` (Task 1); `FormSheet` (Task 5); core `formatTimeRange`, `formatDateLabel`.
- Produces:
  - `PlanTaskCard({ readOnly, tasks, events, viewerId, busyId, onAdd, onToggle, onOpenMenu, onStartSession, onOpenEvent }: { readOnly: boolean; tasks: PlanTaskDto[]; events: PlanEventDto[]; viewerId: string | null; busyId: string | null; onAdd: () => void; onToggle: (task: PlanTaskDto) => void; onOpenMenu: (task: PlanTaskDto) => void; onStartSession: (task: PlanTaskDto) => void; onOpenEvent: (event: PlanEventDto) => void })`
  - `PlanTaskRow({ task, readOnly, busy, onToggle, onOpenMenu, onStartSession })`, the design's
    Goals 2.
  - `PlanEventRow({ event, viewerId, onPress })`. Its meta line reads `event_with_coach` when
    `event.organizerUserId !== viewerId`, then the time range or `all_day`, then `event_cancelled`
    when cancelled.
  - `PlanEventSheet({ event, onClose }: { event: PlanEventDto | null; onClose: () => void })`, a
    read-only `FormSheet` showing the date and time, the status and the description.

- [ ] **Step 1: Build the three files.** The card shows the heading "Görevler" with "+" (hidden
  when `readOnly`), then the event rows, then the task rows divided by `playLine` hairlines, or
  `empty_desc` centred when both lists are empty. "Seans başlat →" shows only for a PENDING task
  when not `readOnly`. Every tap target is at least 44 dp.
- [ ] **Step 2: Run lint.** Run `pnpm --filter @mentor/mobile lint`. Expected: clean for these
  files.

### Task 8: Task form sheet and time sheet

**Files:**
- Create: `apps/mobile/src/components/plan/plan-task-form-sheet.tsx`, `apps/mobile/src/components/plan/plan-time-sheet.tsx`

**Interfaces:**
- Consumes: `PlanTaskDraft`, `planTaskDraftError`, `planTaskFormValues`, `planTaskCreateInput`,
  `planTaskUpdateInput`, `plusOneHour`, `canonicalHm`, `minuteChoices`, `pad` (Tasks 1–2);
  `FormSheet` (Task 5); `createPlanTask` and `updatePlanTask` (coaching-api); `fetchExamTaxonomy`
  (analysis-api); `useAuth().user.examType/examVariant`.
- Produces:
  - `type PlanFormMode = { kind: "add"; date: string } | { kind: "edit"; task: PlanTaskDto }`
  - `PlanTaskFormSheet({ mode, onClose, onSaved }: { mode: PlanFormMode | null; onClose: () => void; onSaved: (task: PlanTaskDto) => void })`
  - `PlanTimeSheet({ value, title, onPick, onClose }: { value: string | null; title: string; onPick: (hm: string) => void; onClose: () => void })`

- [ ] **Step 1: Build `PlanTimeSheet`.** It is a `FormSheet` with two scrolling columns, hours
  `00`–`23` and `minuteChoices(currentMinute)`. Each tap applies at once (the web's `commit`): an
  hour keeps the minute (or 0), and a minute keeps the hour (or 9). The sheet closes with × or the
  scrim.
- [ ] **Step 2: Build `PlanTaskFormSheet`.**
  - **Draft initial state:**
    - add: `allDay: true`, `09:00` / `10:00`;
    - edit: the task's values, `allDay = !startTime`, end `= endTime ?? plusOneHour(start ?? "09:00")`.
  - **Fields** in the web's order. Subject chips come from the query `["exam-taxonomy", examType,
    examVariant]` (the same key as Analiz). A chip toggles `subject.name`. With no `examType` it
    shows `subject_pick_hint` and a free-text field; with an empty list, a free-text field.
  - **Footer:** a pinned `LedgeButton` labelled `add_task` / `edit_task_save`.
  - **Submit:**
    - validate with `planTaskDraftError` and show `t(error)` above the footer;
    - otherwise call `createPlanTask(planTaskCreateInput(values, mode.date))` or
      `updatePlanTask(task.id, planTaskUpdateInput(values, task))`;
    - an API error shows its message and keeps the sheet open; success calls `onSaved`.
- [ ] **Step 3: Run lint.** Run `pnpm --filter @mentor/mobile lint`. Expected: clean for these
  files.

### Task 9: `plan.tsx` orchestrator, skeleton, old code removed

**Files:**
- Modify: `apps/mobile/src/app/(app)/(tabs)/plan.tsx` (rewrite)
- Create: `apps/mobile/src/components/plan/plan-skeleton.tsx`
- Delete: `apps/mobile/src/components/plan/{plan-task-composer,plan-task-list,puhu-plan-adapt-card,week-strip}.tsx`

**Interfaces:**
- Consumes: everything above; `useCelebrations().refresh`, `useToast().show`, `haptics.lightImpact`,
  `useAuth().user.id`.

- [ ] **Step 1: Rewrite `plan.tsx`.**
  - **State:** `selectedDate`, `weekAnchor`, `busyId`, `menuTask`, `formMode`, `pendingDelete`,
    `openEvent`, `datePickerOpen`.
  - **Queries:**
    - the week: unchanged key `["plan-tasks", "week", weekAnchor]`;
    - events: `["plan-events", weekAnchor]` → `groupPlanEventsByDate`, with `retry: false`; a
      failure is treated as `{}`, with no error UI.
  - **Layout:** a `ScrollView` with pull to refresh holding `PlanWeekCard`, the past notice (when
    `isPastDate(selectedDate)`) and `PlanTaskCard`. While the week loads, `PlanSkeleton` shows; on
    a week error, the existing `StateView` with retry.
  - **Toggle:**
    - return early when `busyId` is set or the task is in the past;
    - otherwise set the query data with `withTaskStatus` and `PATCH`;
    - on error, restore the previous data and `toast.show(message)`;
    - on success, `haptics.lightImpact()` when it became DONE, then refresh: `celebrations.refresh()`
      and invalidate the week, `["coaching", "today"]` and `["economy", "quests"]`.
  - **Menu:** `ActionSheet` with `task_action_edit` (left out when `isCoachAssigned`) and
    `task_action_delete` (`tone: "danger"`). Delete opens `ConfirmDialog`, which then deletes with
    the same busy guard and refresh.
  - **Navigation:** week changes use `selectedDayForWeek(anchor, selectedDate, todayIso())`. Picking
    a day, applying the date sheet, or saving a task on another day sets the day and its
    `weekStart`.
  - **Start session:** "Seans başlat →" pushes `/(app)/study-session` with the same params as today.
- [ ] **Step 2: Build `PlanSkeleton` and delete the four old files.** The skeleton is a week-card
  block (header row and 7 circles) and a task-card block (heading and 3 rows), using the existing
  `Skeleton`.
- [ ] **Step 3: Run the checks.** Run `pnpm --filter @mentor/mobile typecheck`, `lint` and `test`.
  Expected: all PASS, with no reference left to the deleted files or the old copy keys.

### Task 10: Emulator verification, docs and memory

**Files:**
- Modify: `docs/standards/mobile.md` (new top timeline entry)
- Modify: memory `mobile-plan-parity-direction.md`

- [ ] **Step 1: Seed the coach items through the API, not the database.** The QA `coach` account
  creates an invite code; the student accepts it. Then the coach adds one task for the student
  today, with a note, and one meeting today. Use a scratchpad script and do not print credentials.
- [ ] **Step 2: Run the emulator scenarios** (recipe in memory `mobile-emulator-run-recipe`) at 411
  and 360 dp, light and dark. Save captures to `apps/mobile/.expo/qa/plan-*.png`:
  - an empty day;
  - a day with tasks (done, pending, timed, subject, duration);
  - a past day (notice, no "+", no "⋯", no toggle);
  - add, both all-day and timed with taxonomy chips. At 360 dp the keyboard is open on the
    description and the button stays visible;
  - edit, including a 19:07 task;
  - delete with the confirm dialog;
  - a double tap on the checkbox, which sends one PATCH;
  - a coach task (badge, note, no "Görevi düzenle");
  - a coach meeting row and its details;
  - the date sheet: month change, dots, Uygula, and a December → January week;
  - "Seans başlat →";
  - tick → the streak scene shows once;
  - pull to refresh;
  - the 401-after-idle path is still clean.
- [ ] **Step 3: Compare side by side** with `apps/mobile/.expo/qa/web/plan2-light-*.png`. Fix the
  gaps.
- [ ] **Step 4: Run the full checks.** Run `pnpm --filter @mentor/core test`, `@mentor/web test`
  and `@mentor/mobile test`, plus mobile `typecheck` and `lint`. Expected: all PASS, and web
  typecheck shows no errors under `src`.
- [ ] **Step 5: Write the docs and memory.** Add the `mobile.md` timeline entry (what was done,
  usage, gotchas, files) and update the memory note (stop A done, uncommitted). Then run one
  whole-change review on Opus.
