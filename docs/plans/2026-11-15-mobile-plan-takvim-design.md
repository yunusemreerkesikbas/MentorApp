# Mobile Plan tab, stop B2a (Takvim: Ajanda + Ay): design

Date: 2026-11-15 · Branch: `feature/APP-142-mobile-core-qa` · App: `apps/mobile` (Expo SDK 58)
Reference: the web plan at phone width, `apps/web/src/app/[locale]/(app)/plan/_components/`:
- `plan-shell.tsx` (Takvim mode, back arrow, scale storage, stepping, data, details sheet)
- `plan-calendar-view.tsx`, `plan-calendar-header.tsx`, `plan-calendar-fab.tsx`
- `plan-mobile-date-strip.tsx` (the drag-open board)
- `plan-mobile-agenda.tsx` (Ajanda)
- `plan-subject-legend.tsx` (Ay legend), `plan-event-chip.tsx` (`spotlightDelay`)
- `plan-event-details.tsx` (task details sheet body)

Web libs: `apps/web/src/lib/plan-calendar-layout.ts`, `plan-calendar-item.ts`, `plan-event-colors.ts`, `plan-events.ts`, `plan-subject-summary.ts`, `plan-tasks.ts` (`listPublicHolidaysByDate`, `listPlanTasksForMonthGrid`).

## Intent

Stops A (Liste), C (Puhu'yla planla) and B1 (switcher + Timeline, 366dc12b) are done. Takvim is the last of the three plan views. It answers "what does my month look like" and lets the student move from a day strip to the whole month with one drag, the way the web does at phone width.

## Owner decisions (2026-11-15)

- **Two rounds.**
  - **B2a** (this document): Takvim mode, the drag-open board with Ay and the subject legend, Ajanda, the "+" button and holidays.
  - **B2b**: the Gün hour grid, its own design.
- **Details sheet like the web, no tick button.** A task opened from Takvim shows its details with Düzenle / Sil only.
- **The board follows the finger (approach 1), after a spike.** The spike passed (below), so approach 2 (a threshold toggle) is not needed.
- **The month changes only on purpose (B).** Scrolling Ajanda never changes the board's month; see goal 5.
  - On the web, scrolling November's agenda into 1 December switches the board to December. The data reloads under a skeleton mid-fling. Around the boundary week, the month also flips back and forth.
  - The phone does not copy that.

## Spike result (2026-11-15, emulator, Expo Go dev mode)

A throwaway board (6 × 84 dp rows, 40 dp collapsed, the same push-down content) was measured with `screenrecord`, `pointer_location` and mid-drag screenshots.

- **PanResponder (JS thread):** the board stalled 1.3 s, then jumped. A transform-only marker lagged in step with the height, so the cost is JS touch delivery, not layout.
- **gesture-handler `usePanGesture` + Reanimated worklets (UI thread):** the board moves every frame. Its gap to the finger matches the native page `ScrollView` on the same emulator:

  | Swipe speed | Board gap | Native scroll gap |
  |---|---|---|
  | 0.6 px/ms | 152 px | 196 px |
  | 0.3 px/ms | 112 px | about 100 px |

- **Root view:** a `GestureHandlerRootView` placed only around the board does not work. The pan never begins, and logcat shows "received touch event but didn't get starting ACTION_DOWN". It must wrap the app at `src/app/_layout.tsx`, which is the library's standard install.
- Dragging the handle never scrolled the page.

## Goals

1. **Switcher.** It gains a third tab, "Takvim" (`view_calendar`). A stored `calendar` now opens Takvim (`readPlanViewMode`).
2. **Takvim mode** (the web's full-screen mode at phone width):
   - The switcher is replaced by a back arrow, "Geri" (`calendar_back`), which returns to Liste. "Puhu'yla planla" stays beside it.
   - The week card and the past-day notice are hidden. The board is the date strip.
   - One card holds the header, the board and the scale's body.
   - The "+" button floats bottom right, above the tab bar.
3. **Card header** (`plan-calendar-header.tsx`):
   - A title: the month title in Ay (`formatMonthTitle`). It is hidden in Ajanda, because the strip already shows that week.
   - "Bugün" (`go_today`), then ‹ ›. Their labels are `calendar_prev_week` / `calendar_next_week` or `calendar_prev_month` / `calendar_next_month`.
   - A segment control (`calendar_scale_aria`). In B2a it holds **Ajanda · Ay**; Gün joins in B2b.
   - Stepping:
     - Ajanda moves the week anchor ±7 days. The selected day follows the week card's rule (`shiftPlanWeek`): today if the week holds it, otherwise its Monday.
     - Ay uses `stepMonth`, which keeps the day of month across short months.
     - "Bugün" selects today in either scale.
4. **The board** (`plan-mobile-date-strip.tsx`):
   - **Layout:**
     - A weekday row (`panel.week_mon`…`week_sun`, 11 px uppercase `secondary`).
     - Then a 6 × 7 month grid, built from `monthGridDays` for the selected day's month. Each row is 84 dp.
   - **Collapsed (Ajanda):**
     - The board is 40 dp tall.
     - The grid is shifted up so the selected week's row shows.
     - The chips sit below the fold.
   - **Expanded (Ay):** 504 dp, all six rows.
   - **Motion:**
     - Height and the row shift both follow `progress` (0..1) on the UI thread.
     - Release past 0.5 settles to Ay; otherwise it settles back. In B2a "back" is Ajanda; the web goes to Gün.
     - A tap on the handle toggles.
     - Settling takes 240 ms on `cubic-bezier(0.22, 1, 0.36, 1)`.
     - With reduced motion it jumps.
   - **Handle:**
     - A 112 × 44 target holding a 40 × 4 bar (`main` at 22 %).
     - Its label is `calendar_strip_expand` or `calendar_strip_collapse`, with an expanded state.
   - **Cell:**
     - **Day number:** 32 dp circle, bold 14. Text colour: white when selected, `progress` for today, `chipText` for a holiday, `main` otherwise. Tapping the number selects the day.
     - **Selected pill:** one `progress`-filled pill. It slides between cells with a spring (stiffness 420, damping 36) and jumps with reduced motion.
     - **Holiday name:** 8 px, `chipText` at 0.75 opacity.
     - **Chips:** up to two, then "+N tane daha" (`calendar_more`, 8 px semibold `accent`). Each chip is 8 px text on the subject tint, with a 2 dp left bar in the subject colour. Done tasks and cancelled meetings are struck through.
     - **Fading:** past days at 0.75, days outside the month at 0.45.
     - **Chip tap:** a task opens the details sheet; a meeting opens the existing `PlanEventSheet`.
5. **Ajanda** (`plan-mobile-agenda.tsx`):
   - **Scroller:** all 42 board days, in a fixed-height inner scroller of 60 % of the window height.
   - **Each day:**
     - A header: "15 Kas" bold 18 (in `progress` for today), then the weekday or "Bugün" in 14 `secondary`, then the holiday name.
     - Rows: all-day items first ("Tüm gün"), then timed ones by start time (`formatTimeRange`).
     - Each row is a time column 64 dp wide, a 4 × 16 colour bar, the title (16, struck through and at 0.7 when muted), and the subject as meta (12 `secondary`).
     - An empty day reads `timeline_day_empty`.
     - Past days sit at 0.7. A hairline (`main` at 8 %) separates days.
   - **Scroll spy:** the selected day is the last day whose top is at or above `scrollTop + 8`. The strip's pill follows it.
   - **The board's month is its own state, not the selected day's month** (owner's pick B):
     - The spy may select a spill day, for example 1 December on November's board. The board stays on November, and the collapsed strip shows that day's week, which is row 5 of November's grid. Nothing reloads and the scroll is never cut.
     - The month changes only on these:
       - ‹ › in Ay
       - "Bugün"
       - a tap on a spill day, on the strip or in Ay
       - an Ajanda week step that leaves the board's 42 days
       - a saved task or a date-sheet pick outside them
     - Each of those sets the month of the newly selected day. The agenda then re-pins on the new range.
   - **Picks from outside the scroller** jump the agenda to that day, as the web does. These are a strip number, "Bugün", ‹ › and a saved task.
   - **Opening, or a new month range,** pins to the selected day before it is shown.
6. **Ay**: the expanded board plus the subject legend below it.
   - **Legend** (`plan-subject-legend.tsx`):
     - It lists the subjects with tasks in the board's month, most tasks first, then by name (Turkish collation).
     - Each pill has a 4 × 12 colour bar, the subject and its count. Its group label is `calendar_legend_aria`.
     - Tapping a pill highlights that subject; tapping it again, or "Vurguyu kaldır" (`calendar_legend_clear`), clears it.
     - The active pill is filled with its tint, has a border in its colour and lifts 1 dp. Inactive pills drop to 0.45 while a highlight is on.
     - One summary line shows under the pills, for example "3 / 5 tamamlandı · 4 güne yayılmış · 3 sa 30 dk · sıradaki 18 Kas". It uses `summarizeSubjectMonth` and `formatPlannedMinutes`.
   - **On the board:**
     - Matching chips get a 1 dp ring in their colour, lit one after another (`spotlightDelay`: 25 ms steps, capped at 400 ms).
     - Other chips fade to 0.32.
     - The highlight is derived, never stored, so it disappears when the month has no such subject.
7. **"+" button** (`plan-calendar-fab.tsx`):
   - A 56 dp `btn` circle, labelled `calendar_add_on` with the full date.
   - It opens the existing add form on the selected day, titled "Yeni etkinlik" (`new_event_title`).
   - It is hidden when the selected day is past.
8. **Task details sheet** (`plan-event-details.tsx`), titled "Etkinlik detayı" (`event_details_title`):
   - **Banner:** in the subject tint. It shows the title (struck through when done) and a clock line with the full date plus the time range or "Tüm gün".
   - **Rows:**
     - `subject`: "subject › topic", or "—".
     - `event_status`: Tamamlandı or Bekliyor.
     - `duration_label` with "N dk", when set.
     - `coach_note` and `description`, when set, multiline.
   - **Buttons:**
     - "Görevi düzenle" (`task_action_edit`), unless the task is coach-assigned (`isCoachAssigned`).
     - "Sil" (`task_action_delete`).
     - There are no buttons on a past date, and no tick.
   - Düzenle and Sil hand off to the screen's existing edit and delete flows.
9. **Data:**
   - **Tasks:** one query per board month, `["plan-tasks", "month", monthAnchor]`, over the 42 board days via the existing `listPlanTasksForRange`. 42 days stays under the API's 62-day cap.
   - **Meetings:** `listPlanEventsForRange` over the same 42 days, best-effort like today's week read.
   - **Holidays:** `/v1/content/holidays?from&to` over the same days, keyed by date. A failure shows no holidays and no error.
   - **Writes:** tick, edit, delete, add and refresh reuse the screen's handlers. Their invalidation must reach the month key.
10. **The scale is remembered** in SecureStore, like the view (`mentor.plan.calendar-scale.v1`):
    - Default: Ajanda.
    - A stored `day` opens Ajanda until B2b.
11. **Accessibility:**
    - The segment is a tab list.
    - Day numbers report selected and today.
    - Chips are buttons named by their title.
    - The FAB, handle and back arrow carry the labels above.

## Shared logic moves to `@mentor/core`, and the web re-exports it

- **`plan-calendar-layout`:**
  - Functions: `monthGridDays`, `layoutDayEvents`, `earliestStartMinute`, `minutesFromHhmm`, `hhmmFromMinutes`.
  - Constants: `DAY_MINUTES`, `DEFAULT_EVENT_MINUTES`.
- **`plan-calendar-item`:**
  - `PlanCalendarItem` without its React-only fields. `icon` and `accessory` stay in a web-side type that extends it.
  - `planTaskCalendarItem(s)`.
- **`plan-event-colors`:**
  - The FNV-1a subject hash and the palette order (progress 18 %, chip 24 %, thumb-violet 26 %, success 13 %, star 26 %; neutral = secondary 12 %), as token keys plus tint percents.
  - Each platform turns them into colours: the web keeps its CSS `color-mix` strings; mobile mixes its palette hex.
  - Mobile has no `thumb-violet` yet (web CSS only, `#ddace5`), so it is added.
- **`studentEventCalendarItem`**, without the fetcher.
- **`summarizeSubjectMonth`, `formatPlannedMinutes`, `spotlightDelay`.**
- Existing web specs keep passing through the re-exports. Core gets the specs that move with the code.

## Non-goals

- Gün (the hour grid), and stepping by day (B2b).
- The web's desktop pieces: the rail with the mini calendar and to-do list, hover previews, the seven-column week grid.
- Any change to Liste, Timeline or the form sheets beyond the add form's title.
- Ticking a task from Takvim.

## Anti-goals

- **A board that trails the finger, or stalls.** That is why the drag runs on the UI thread.
- **A feedback loop between the agenda and the strip.** Our own jump must not re-select a day and trigger another jump.
- **A trap.** The page still scrolls and refreshes from outside the agenda.

## Constraints

- **Dependencies:** none new. `react-native-gesture-handler` ~3.3.0 and Reanimated ~4.7.1 are installed.
  - New app-wide wiring: `GestureHandlerRootView` (flex 1) wraps the root layout.
  - Gestures inside an RN `Modal` would need their own root. None are planned.
- **Copy:** ported as-is from web `plan.*` and `panel.week_*` into mobile `i18n/{tr,en}.ts`. There is no ICU, so `legend_days` (plural) and other ICU strings are split.
- **Files:** each stays under about 300 lines.
- **Tests:** pure rules get node strip-types tests (core or mobile `lib`).
- **Gate:**
  - `pnpm --filter @mentor/core test`
  - `pnpm --filter @mentor/web test`
  - `pnpm --filter @mentor/mobile test`
  - mobile typecheck and lint
  - core and ui are built after changes

## Approaches considered

1. **The board follows the finger, gesture-handler on the UI thread (picked, spike passed).** It is faithful to the web. The cost is the app-wide root wrapper.
2. **Threshold toggle.** A short drag or tap flips between collapsed and expanded with an animation. It needs no new wiring, but the board no longer tracks the finger.
3. **PanResponder following the finger.** Measured: it stalls for over a second in dev mode. Rejected.

## My calls (the owner can overrule)

- **The past-day notice is hidden in Takvim**, as in Timeline. The web shows it.
- **The board collapses to Ajanda in B2a.** B2b switches this to Gün, as on the web. Until then the collapse label already reads "Gün görünümüne dön", since B2a ships only with B2b.
- **A stored Gün opens Ajanda until B2b.**
- **Ajanda reuses B1's explicit scroll pattern:**
  - Picks from outside bump a request counter.
  - The scroller's own day changes go through `onActiveDayChange`.
  - A "wait / pin / scroll / none" sync decides each render.
  - The Ajanda rule is the web's "last top passed" spy, not Timeline's "nearest top".
- **The chip fade is opacity only.** RN has no `saturate` filter.
- **Meetings use the existing `PlanEventSheet`.** Task details are a new component.
- **Android's system back in Takvim works like "Geri".** It returns to Liste. Takvim is a full-screen mode with its own back arrow, so back should undo the mode, not leave the tab. Built with `BackHandler` while the Plan tab is focused.
- **Android is verified; iOS is safe by construction but untested.** The app is Android first and there is no iOS device here. gesture-handler and Reanimated are cross-platform. The handle's pan claims vertical movement at once (`activeOffsetY` of a few dp), so the page scroll does not take it on either platform.
- **Name clashes when moving code to core:**
  - Mobile's own `monthGridDays(monthIso)` in `lib/plan-view.ts` (5 or 6 rows, used by the date sheet) is renamed `dateSheetMonthDays`. Core takes the web's always-42-day `monthGridDays(year, monthIndex)`.
  - Core's item builders are generic over the colour. `planTaskCalendarItem(task, labels, colorOf)` and `studentEventCalendarItem(event, userId, labels, neutral)` take what the platform paints with. The web passes its CSS `PlanEventColor`, so its `PlanCalendarItem.color`, the coach-plan files and `plan-calendar-item.spec.ts` keep working unchanged. Mobile passes hex pairs mixed from its palette.

## Left to the builder

- How the selected pill slides across cells (one absolutely placed pill driven by row/column, versus per-cell).
- How the add form receives its title (a `title` on `PlanFormMode` or a sheet prop).
- The Takvim loading skeleton (the web's `PlanCalendarSkeleton` is the reference).
- File split under `components/plan/calendar/`.

## Verification

- **Unit:**
  - **Moved core helpers:** month grid at month edges, day layout ordering, the colour hash bucket for known subjects (unchanged from the web), the subject summary.
  - **Mobile helpers:**
    - The agenda's "last top passed" spy.
    - The scale reader: `week`, `month`, `day` → Ajanda, garbage.
    - `readPlanViewMode('calendar')`.
    - Step rules for each scale.
    - The board month after each kind of pick. A spy pick of a spill day keeps the month. A week step past the grid, "Bugün", or a tap on a spill day moves it.
- **Emulator QA** (light, plus dark, 360 dp and reduced motion where noted):
  1. Liste → Takvim → Geri. A relaunch reopens Takvim on the saved scale.
  2. Drag the handle slowly. The board follows the finger, and release past half opens Ay. Then drag back, tap the handle, and check that a vertical drag on the handle never scrolls the page.
  3. **Ajanda:**
     - Scroll and watch the pill follow.
     - Tap a strip day, "Bugün" and ‹ ›, and see the agenda jump without an echo.
     - Fling from 30 Nov into December. The board stays on November, there is no skeleton, and the scroll is not cut. Scroll back and forth over the boundary week: the month never flips.
  4. Ay: ‹ › across months (31st → 30th), chips with "+N", holiday names (Cumhuriyet Bayramı is on the dev data), outside-month fading.
  5. Legend: highlight, clear, step to a month without that subject.
  6. Tap a chip and an agenda row. Details shows, then Düzenle (not for coach tasks) and Sil. Past days are read-only. A meeting opens its sheet.
  7. "+" on a future day opens "Yeni etkinlik" on that day; it is hidden on a past day.
  8. With the holidays endpoint failing, there is no error and no names.
  9. Pull to refresh from outside the agenda. Dark theme, 360 dp, reduced motion: no slides, no spring, and the board jumps.
