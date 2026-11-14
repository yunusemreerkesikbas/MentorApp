# Mobile Plan tab, stop B1 (view switcher + Timeline): design

Date: 2026-11-14 · Branch: `feature/APP-142-mobile-core-qa` · App: `apps/mobile` (Expo SDK 58)
Reference: the web plan at phone width, `apps/web/src/app/[locale]/(app)/plan/_components/`.
The relevant files are:
- `plan-shell.tsx` (view state, header order)
- `plan-view-switcher.tsx` (`SlidingTabs` from `@mentor/ui`)
- `plan-timeline-view.tsx`
- `plan-content-skeleton.tsx` (`PlanTimelineSkeleton`)
- `plan-task-row.tsx` (`dense`)
- `plan-utils.ts` (stored view mode)

The phone-width timeline rules live in `apps/web/src/app/globals.css` under `.mentor-plan-timeline-*`, in the `max-width: 1023px` block.
Capture: `apps/mobile/.expo/qa/web/plan-light-timeline.png` (390×844, empty week).

## Intent

Stop A (Liste, aedfa1e6) and stop C (Puhu'yla planla, a34fd94a) are done. Until now the
Liste/Timeline/Takvim switcher has stayed hidden on the phone.

Stop B brings the other two views of the same plan. On 2026-11-14 the owner split it into two rounds:
- **B1** (this document): the switcher and Timeline.
- **B2**: Takvim, with Gün, Ajanda and Ay, the month range, holidays and the drag-open board.

Timeline answers "how does my week look, day by day" without leaving the list's data.

## Owner decisions (2026-11-14)

- **Two rounds.** B1 is the switcher plus Timeline, committed on its own. Takvim follows as B2 with its own design.
  Until B2 lands, the switcher shows only **Liste · Timeline**.
- **Inner scrolling like the web (approach 1).**
  - The Timeline card has its own fixed-height scroller. Each day snaps to the top.
  - The week card above stays in place and its selected day follows the scroll.
  - The page keeps its own scroll and pull to refresh.
- **Nothing above the card moves while Timeline scrolls (B).** In Timeline, two things are hidden: the week card's day-progress block ("2/3 görev · %67", shown today only when the selected day has tasks) and the past-day notice. Otherwise they come and go as the scroll changes the selected day, and the card jumps 40–56 dp under the finger. The web has that jump; the phone does not copy it. Each day's "done/total" on the timeline carries the progress, and past days' rows stay read-only. Liste keeps both as they are.

## Goals

1. **Switcher.**
   - Position: under the "Puhu'yla planla" button, above the week card. This is the web header order.
   - Style: a sliding pill tab list with equal-width tabs, matching the web's `SlidingTabs` `equalWidth`.
     - Track: `surfaceContainer` at 80 % with a 1 px border at 70 %.
     - The pill slides 250 ms on `cubic-bezier(0.22, 1, 0.36, 1)` and snaps with reduced motion.
   - Copy, as-is from web `plan.*`: `view_list` "Liste", `view_timeline` "Timeline", `view_switch_aria` "Plan görünümü".
   - Accessibility: a tab list whose tabs report "selected".
2. **The choice is remembered.**
   - The last view is read before the first frame and written on change, like the web's localStorage `mentor.plan.view`.
   - In B1 a stored `calendar`, or anything unknown, opens Liste.
3. **Timeline card**: a `PanelCard`, opening under the week card.
   - **"+" button:** top right, 6 px in.
     - It adds a task on the selected day through the existing form sheet.
     - It is hidden when the selected day is in the past.
   - **Inner scroller:**
     - Height is the smaller of 448 and 52 % of the window height.
     - Padding is 5.6 top, 28 right (room for the "+" and the day stats), 10.4 bottom and 5.6 left.
     - It scrolls inside the page (`nestedScrollEnabled`).
     - It snaps to each day's top.
     - A day taller than the scroller gets extra snap stops inside it, so every row can come to rest in view. The web's CSS snap lets you scroll freely inside an oversized day; React Native's `snapToOffsets` would otherwise skip its lower rows. This is my call: a pure helper `timelineSnapOffsets(dayTops, dayHeights, viewport)`, tested.
     - An end spacer of (scroller height − 72) lets the last day reach the top.
   - **Rail:** centred at x = 22. It has two lines, each 2 px wide:
     - A track line in `progressTrack`.
     - A fill line in `progress`. Its height is (active day's top + 22) ÷ rail height. It animates 320 ms on `cubic-bezier(0.22, 1, 0.36, 1)`.
   - **Day section:**
     - Spacing: 44 left, 16 bottom.
     - Inactive days sit at opacity 0.78, or 1 with reduced motion.
     - Past days are read-only.
   - **Active day badge:**
     - Shape: a 36 × 36 circle on the rail with a `progress` fill, a 2 px `surface` border and the card shadow.
     - Text: white bold 9 px "13" over "KAS" (`formatMonthDayShort`).
     - Motion: it slides to the new active day with a spring (stiffness 420, damping 34). With reduced motion it jumps.
   - **Inactive day dot:**
     - Shape: 12 × 12 at top 10, with a `surface` fill and a 2 px `progressTrack` border.
     - Today: `progress` fill and border.
     - Past days: opacity 0.75.
     - Tapping a dot selects that day.
     - Its accessibility label is the full date.
   - **Day header:**
     - Title: "Bugün" for today, otherwise the full date label (`formatDateLabel` `alwaysFull`). It is 13 px bold, in `main` when active and `body` otherwise.
     - Stats: "done/total" on the right, 11 px `secondary` with tabular numbers, shown only when the day has tasks.
     - Minimum height: 36 when active, 32 otherwise (with 4 px top padding).
   - **Empty day:** "Bu günde görev yok." (`timeline_day_empty`), 12 px `secondary`.
   - **Rows:**
     - The Liste row in a new `dense` form: smaller checkbox, 14 px title, tighter meta.
     - Pending tasks come first, then done ones.
     - The tick, the "⋯" menu (Düzenle / Sil) and the start-a-session link work as on Liste.
4. **Scroll and selection stay together** (the web's `syncFromScroll`).
   - **Scrolling inside the card:**
     - The day whose top is nearest the scroll offset becomes active.
     - When it changes, the week card's selected day follows.
     - A scroll the code started itself does not echo back.
   - **A day tapped in the week card, a dot, or the date sheet:**
     - The card scrolls to that day in 420 ms (ease-out cubic).
     - With reduced motion it jumps.
   - **Week arrows:**
     - The week card already picks the new selected day: today if the new week holds it, otherwise its Monday (`shiftPlanWeek`).
     - The Timeline re-pins to that day.
5. **No visible jump on entry.**
   - When Timeline opens, the scroller is pinned without animation to today (if the week holds it) or to the selected day. Opening on today also selects today, as on the web.
   - When the week changes, it is pinned to the selected day the week card already chose: today or Monday after an arrow, or the picked day after the date sheet. The web pins to today here even after an explicit pick. This is my call: a direct pick wins.
   - Until then the timeline skeleton covers it.
   - The skeleton is the web's `PlanTimelineSkeleton`: a rail, seven day blocks, the first with two row placeholders.
   - The same skeleton shows while the week loads.
6. **Switch motion.**
   - Timeline fades in over 180 ms.
   - Liste keeps its own entry.
   - Reduced motion: no fades.
7. **Accessibility.**
   - The scroller is labelled "Haftalık plan zaman çizelgesi" (`timeline_scroll_aria`).
   - The new active day is announced politely when it changes. The announcement is the full date label.

## Data

No new reads. Timeline reads the week query Liste already uses (`["plan-tasks", "week", anchor]`, `listPlanTasksForWeek`).

All writes go through the screen's existing handlers:
- tick and untick (optimistic, with the busy lock)
- menu → edit or delete (confirm)
- start a session
- add on the selected day
- refresh after a change

Pull to refresh stays on the page's `ScrollView`.

## Non-goals

- Takvim and every part of it (B2).
- Coach meetings on Timeline. The web's Timeline shows tasks only. Meetings stay on Liste and, in B2, on Takvim.
- The web's desktop keyboard stepping (↑ ↓ inside the scroller).
- Any change to Liste, the form sheets or Puhu'yla planla. The week card only gains a way to hide its day-progress block, used by Timeline.

## Anti-goals

- **A jump on entry.** The reader must never see the timeline scroll from Monday to today.
- **A feedback loop.** Our own `scrollTo` must not move the selected day and trigger another scroll. That would make the strip flicker or fight the finger.
- **A trap.** The page must still scroll and refresh from outside the card.

## Constraints

- **Dependencies:** none new. Reanimated 4 and gesture-handler are installed. `expo-secure-store` is already the app's small-preferences store (`stores/preferences.store.ts`, `lib/recap-opened.ts`), and its sync API lets the first frame open on the saved view.
- **Copy:** ported as-is from web `messages/tr.json` and `en.json` `plan.*` into mobile `i18n/{tr,en}.ts`. No ICU, so strings are split where needed.
- **File size:** stays under about 300 lines; split the view where it grows.
- **Tests:** pure rules get node strip-types tests in `apps/mobile/src/lib`.
- **Gate:**
  - `pnpm --filter @mentor/core test`
  - `pnpm --filter @mentor/web test`
  - `pnpm --filter @mentor/mobile test`
  - mobile typecheck and lint

## Approaches considered

1. **Inner scroller like the web (picked by the owner).** It is faithful. The cost is nested scrolling on Android: when the inner list reaches its end, the same gesture does not carry on to the page. The web behaves the same.
2. **The page scrolls; the timeline follows the page offset.** The gesture is simpler. But the week card scrolls away, so the strip following the day is unseen unless the card becomes sticky, which drifts from the web.
3. **No sync.** Seven days on a rail as a flat list. It loses the badge, the fill and the strip link, which are the point of the view.

## My calls (the owner can overrule)

- **No meetings on Timeline**, as on the web.
- **Dense rows keep every action** (tick, menu, session), as the web's dense row does.
- **The view is stored with `expo-secure-store`** under `mentor.plan.view.v1`.
- **Helpers live in mobile `lib/plan-timeline.ts`, not `@mentor/core`.** The web's timeline rules are written against DOM offsets inside its component, so there is no shared rule to move.
  - `activeTimelineDay(offsets, scrollTop)`
  - `timelinePinTarget(days, today, selected)` (entry only)
  - `timelineSnapOffsets(dayTops, dayHeights, viewport)`
  - `orderTimelineTasks(tasks)`
  - `railFillRatio(activeTop, railHeight)`
  - `readPlanViewMode(raw)`

## Left to the builder

- How day tops are measured (`onLayout` per section) and how the badge and fill animate. Reanimated is preferred so the badge spring runs off the JS thread.
- How the polite announcement is made (`AccessibilityInfo.announceForAccessibility`, or a live region).
- The switcher's implementation (a reusable `components/ui/sliding-tabs.tsx`; B2's Gün/Ajanda/Ay control can reuse it).
- How the skeleton overlay hands over to the pinned scroller.

## Verification

- **Unit:** each helper above, including:
  - the nearest-day pick at ties and past the last day
  - the pin target when the week holds today and when it does not
  - pending before done
  - fill clamped to 0..1
  - stored values `calendar`, `week`, garbage and null → `list`
- **Emulator QA** (light, plus dark, 360 dp and reduced motion where noted):
  1. Switch Liste → Timeline → Liste. The pill slides, Timeline opens pinned to today with no visible jump, and a relaunch reopens Timeline.
  2. Scroll the card. The badge and fill move, the strip follows, and each day snaps to the top.
  3. Tap a day in the strip, then a dot. The card scrolls there.
  4. Week arrows to next and previous week. It re-pins to Monday, or to today on this week. Scrolling from a day with tasks to an empty day, and from today into yesterday, moves nothing above the card: no progress block and no past-day notice in Timeline, while Liste still shows both.
  5. Tick, untick, menu edit and delete, and start a session from a Timeline row.
  6. Go to a past day. Rows are read-only and there is no "+".
  7. "+" on a future day. The form opens on that day.
  8. An empty week shows the empty line under every day.
  9. Pull to refresh from outside the card still works, and the page still scrolls past the card.
  10. Dark theme, 360 dp and reduced motion (no spring, no fades, inactive days not faded).
