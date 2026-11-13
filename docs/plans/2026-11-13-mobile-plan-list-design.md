# Mobile Plan tab, stop A (Liste) — design

Date: 2026-11-13 · Branch: `feature/APP-142-mobile-core-qa` · App: `apps/mobile` (Expo SDK 58)
Reference: the web plan at phone width, `apps/web/src/app/[locale]/(app)/plan/_components/`
(`plan-shell.tsx` orchestrates; `plan-date-nav`, `plan-week-strip`, `plan-list-view`,
`plan-task-row`, `plan-task-menu`, `plan-add-task-form`, `plan-time-field`, `plan-subject-picker`,
`plan-date-picker-sheet`, `plan-week-mini-calendar`, `plan-coach-event`, `plan-progress`,
`plan-content-skeleton`). Captures at 390×844 in gitignored `apps/mobile/.expo/qa/web/plan*-light-*.png`.

## Intent

The student-core release reaches web parity screen by screen; the Panel, the reward scenes and the
weekly recap story are done. The Plan tab is next. The mobile Plan is still the Phase 2.2 screen
(page title, chunky week pills, an inline add form, a "Puhu'yla Haftalık Planı Uyarla" card). The
web's Plan is about 7,700 lines, so the owner split it into three stops (2026-11-13), in this order:

- **A · Liste** (this document): the daily loop. See the week, pick a day, add, tick, edit, delete,
  start a session.
- **C · Puhu'yla planla**: Coin choice, wizard, "Şehrin üstünde" waiting stage, preview, apply.
- **B · Timeline + Takvim**: the other two views of the same data.

The owner will not ship mobile until all development is done, so interim states are never seen by
users.

## Goals

1. **Layout = the web's Liste view at phone width**, under the existing `AppHeader` and above the
   floating tab bar, in this order:
   1. **Week card** (`PlanDateNav` → `PlanWeekStrip`): ‹ previous week, the range ("9 Kasım – 15
      Kasım"), a calendar icon, › next week; below, seven days (short weekday caps over the day
      number). Today's number is in the progress blue. The selected day sits in a light-blue circle.
      A dot under each day that has tasks. When the selected day has tasks, a divider and the day
      progress follow: "{done} / {total} tamamlandı" left, "%{percent}" right, then the progress line.
   2. **Past-day notice** when the selected day is before today (`past_readonly_notice`, the web's
      pale blue box).
   3. **"Görevler" card** with a "+" beside the heading (hidden on a past day). It holds, in order,
      the day's coach meetings, then its tasks. When it holds nothing: `empty_desc` centred.
2. **Task row** (`PlanTaskRow`, non-dense): a checkbox (`progress` fill + white tick when done),
   the title (struck through and secondary when done), then a meta line: subject in small bold caps,
   "{minutes} dk", the "Koçundan" badge (person icon) for a human coach's task, and "Seans başlat →"
   for a pending task on today or later. A coach note shows under the meta line with a left rule.
   On the right, "⋯" opens the task menu (not on a past day). Rows are divided by hairlines.
3. **Toggle.** Optimistic, like the web: flip at once, `PATCH /v1/plan-tasks/:id {status}`, revert and
   show the error on failure. Not possible on a past day. After a change, refresh the today and
   economy queries and call `celebrations.refresh()`, so the streak scene and reward queue run as they
   do now.
4. **Task menu.** A small bottom sheet (the web's popover, moved to a sheet by the platform rule) with
   "Görevi düzenle" (hidden for a coach's task: the API refuses the edit) and "Sil" (danger). "Sil"
   asks first with the web's dialog (`task_delete_confirm_*`, destructive).
5. **Add / edit sheet** (`PlanAddTaskForm` in the shared bottom sheet). Title "Yeni görev" or
   "Görevi düzenle", close ×, fields in the web's order:
   - title (`new_task` label, `task_placeholder`), required;
   - "Tüm gün" checkbox, on by default for a new task; off reveals "Başlangıç" and "Bitiş" (new task
     default 09:00 and 10:00);
   - "Ders" chips from the student's exam taxonomy; free text when there is no taxonomy;
   - duration (optional, the web's limits), description (optional);
   - a pinned bottom button: "Görev ekle" or "Kaydet".
   A new task goes to the selected day. Validation and the update payload follow the web shell
   exactly (times are sent as a pair; a `WEEKLY_REPORT` task keeps its subject).
6. **Time field.** The web's field and its hour/minute lists: tapping a time opens a sheet with an
   hour column (00–23) and a minute column (`minuteChoices`: five-minute ticks plus the current
   minute when off the grid).
7. **Date sheet.** The calendar icon opens "Tarih seç": a "Bugün" chip, a month header with ‹ ›,
   a Monday-first month grid with outside-month days greyed, dots on days with tasks, the selected day
   filled, and a pinned "Uygula". Applying moves the week and the day.
8. **Coach meetings** (`PlanCoachEventRow`): a row per meeting the student takes part in, "Koçunla"
   and the time range or "Tüm gün", "İptal edildi" when cancelled. Tapping opens a read-only details
   sheet (`PlanCoachEventDetails`: when, status, description). Meetings are not ticked. They load
   best-effort: a failed read shows none and never an error (as the web's `usePlanEvents`).
9. **"Seans başlat →"** opens `/(app)/study-session` with the task's id, title, subject and minutes,
   as the current mobile screen does.
10. **Loading** shows a card-shaped skeleton of the week card and the task card (the web's
    `PlanListSkeleton` shape). Pull to refresh stays (platform habit).
11. **Light and dark** both follow the existing tokens.

## Non-goals (this stop)

- The Liste / Timeline / Takvim switcher, Timeline and Takvim (stop B).
- "Puhu'yla planla" and everything behind it (stop C).
- The analysis "locked focus" variant of the add form (`analysisFocus`), which belongs to the
  Analiz parity stop.
- Community-origin tasks' "konuya dön" link and their completion prompt: community is hidden on
  mobile. Such a task shows as an ordinary row.
- Holidays (only the Takvim view shows them).

## Anti-goals

- A mobile-only look: no page title, no pill week buttons, no inline form, no extra cards.
- Business rules re-implemented on mobile (past-day lock, coach-task lock, payload rules) when the
  web already has them as pure code: those move to `@mentor/core` and both apps use them.
- A new native dependency for pickers.

## Owner decisions (2026-11-13)

- Order A → C → B.
- Until B and C land, the view switcher and the "Puhu'yla planla" button are **hidden**, and the old
  `PuhuPlanAdaptCard` is removed.
- Human-coach items show as on the web: "Koçundan" badge, coach note and coach meetings (read-only
  details).
- Approach: rebuild from the web's phone layout (below).

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **Chosen** | **Rebuild** in new `components/plan/*` from the web's phone layout, reusing the Panel's primitives (`PanelCard`, `BottomSheet`, `ActionSheet`, `ProgressLine`); delete the old week strip, composer, task list and adapt card. | Largest diff; ends 1:1 with the web and leaves no Phase 2 code behind. |
| Rejected | Restyle the existing components. | Looks smaller, but the shapes differ (inline form vs sheet, pills vs light row, no menu or edit), so most of it would be rewritten anyway. |
| Rejected | Show the web page in a web view. | Not native; ruled out in the Panel round. |

## Design

**Screen.** `app/(app)/(tabs)/plan.tsx` becomes a thin orchestrator (state: selected date, week
anchor, busy id, open sheet; queries; mutations) like the web shell, with rendering in
`components/plan/`. Suggested split (the builder may adjust, files stay under ~250 lines):
`plan-week-card.tsx` (strip + progress), `plan-task-card.tsx` (heading, events, rows, empty),
`plan-task-row.tsx`, `plan-task-form-sheet.tsx`, `plan-time-sheet.tsx`, `plan-date-sheet.tsx`,
`plan-event-row.tsx` + details sheet, `plan-skeleton.tsx`.

**Data.**
- Week tasks: the existing `listPlanTasksForWeek` (dots, the selected day's rows, progress).
- Coach meetings: new `listPlanEventsForRange(from, to)` in a mobile lib file, same paging as the
  web's `apps/web/src/lib/plan-events.ts`; query per visible week (the date sheet's month needs only
  task dots, not events).
- Month dots in the date sheet: `GET /v1/plan-tasks/calendar?from&to` (the web's
  `listPlanTasksForMonthGrid`), fetched when the sheet opens or its month changes.
- Taxonomy: the existing `fetchExamTaxonomy` for the student's exam, cached by TanStack Query.
- Mutations: the existing `createPlanTask`, `updatePlanTask`, `deletePlanTask`.

**Moved to `@mentor/core`** (web files re-export, core and ui rebuilt after):
`canonicalHm`, `minuteChoices`, `pad` (web `plan-time.ts`), `isCoachAssigned`
(`apps/web/src/lib/plan-task-permissions.ts`), `groupPlanEventsByDate`
(`apps/web/src/lib/plan-events.ts`). The date helpers (`weekStart`, `weekDates`, `isPastDate`,
`taskStats`, `formatWeekRangeLabel`, …) are already there. If the add/edit validation or payload
shaping has to live in two places, move it too; otherwise leave it in the web shell.

**Copy.** A new mobile `plan` namespace mirrors the web's `plan` keys this stop reads, TR and EN, word
for word (owner rule: web copy as-is). The old mobile plan keys that nothing reads afterwards go.
Mobile's formatter only substitutes `{name}` (no ICU): check each ported key.

**Week navigation** follows the web shell: ‹ › move the week anchor by seven days and keep the
selected day if it is in the new week, else select today if it is in the week, else the week's
Monday. Picking a day (strip or date sheet) selects it and moves the anchor to its week.

**Sheets.** All sheets build on the Panel's `BottomSheet` (RN `Modal`). It is bare today (no header,
no scroll, no pinned footer). The form, date, time and meeting sheets need the web's sheet frame: a
centred title with a close × under the grab handle, a hairline, a scrolling body and, where the web
has one, a pinned bottom button. Add that frame once (a titled variant next to `BottomSheet`) rather
than per sheet. `ActionSheet` needs a danger tone for "Sil". Inputs inside a `Modal` are not covered
by the root `KeyboardAvoidingView`: the form sheet must keep the focused field and the pinned button
above the keyboard on Android.

**Delete confirm.** Mobile has no confirm dialog yet. Add a small centred one mirroring the web's
`useMentorDialog` (title, message, cancel and a destructive confirm), reusable by later stops.

**Haptics.** A light haptic when a task is ticked done (the web has no sound here).

## My calls (the owner can overrule)

- No visible page title (the web's `h1` is screen-reader only).
- The task menu and the time picker are bottom sheets (web popovers), per the platform rule.
- The time field is tap-only (no typed time); the web also accepts typing.
- Pull to refresh stays.
- The coach-meeting details sheet is read-only, like the web.
- A new centred confirm dialog for "Görevi sil?" (the web uses a centred dialog too; mobile had none).

## Left to the builder

File split, query keys, skeleton details, how the optimistic update is written (TanStack
`onMutate` or local state), and test choice (pure helpers moved to core get core specs; any new pure
mobile step gets a `src/lib/*.spec.ts`).

## Verification

- `pnpm --filter @mentor/core test`, `@mentor/web test`, `@mentor/mobile test`, mobile typecheck and
  lint; web typecheck shows no errors under `src`.
- On the Android emulator against the local API, light and dark, 411 and 360 dp wide: empty day,
  day with tasks (done, pending, timed, subject, duration), past day (notice, no "+", no menu, no
  toggle), add (all-day and timed, taxonomy chips), edit, delete with confirm, coach task (no edit,
  badge, note), coach meeting row and details, date sheet (month change, dots, apply), "Seans
  başlat →", tick → streak scene once, pull to refresh, the 401-after-idle path still clean.
- Screens side by side with the web captures.
- QA data: the student account already has tasks on 2026-11-13/14 (seeded through the API). Coach
  items need the QA `coach` account linked to the student (invite code, then accept on the student
  side) and then one assigned task with a note and one meeting created by the coach; seed them
  through the API, not the database.
