# Mobile Plan Takvim B2b — Gün

This extends the completed [B2a design](2026-11-15-mobile-plan-takvim-design.md) on `feature/APP-142-mobile-core-qa`. The web's phone-width `plan-time-grid.tsx` supplies the layout reference.

## Behavior

- The scale selector reads Gün, Ajanda, Ay. The existing SecureStore key accepts all three and defaults to Ajanda. Collapsing the Ay board opens Gün. The Gün toolbar displays the selected date.
- Gün arrows pick the previous or next civil date. A deliberate step across a month boundary changes the board month, including when the target is a spill day. Ajanda scrolling keeps its B2a rules.
- Gün shows the selected date's holidays and all-day items above a nested, scrollable 24-hour grid. Use the existing month data and shared lane layout. The first open on a date lands half an hour before the earliest timed item, or at 06:30 to bring 07:00 into view for an empty timeline. Initial positioning includes the first meetings result when available. A later refresh preserves the scroll position.
- Timed and all-day items use the existing calendar detail sheets. A writable hour opens the existing calendar add form with the tapped start and a one-hour end, limited to 23:59. Past dates have no writable slots. The floating add button keeps its all-day default.

## Steps

1. Cover saved scale, day and month boundaries, initial offset and the add draft in the existing mobile unit specs. Implement those rules in `plan-calendar.ts` and `plan-view.ts`.
2. Add `PlanDayGrid`, wire it through `PlanCalendar` and `PlanScreen`, and use the existing calendar copy and form flow.
3. Verify the first offset, overlap lanes, writable and past slots, timed save, scale persistence, and collapse to Gün on Android. Run core, web and mobile tests, plus mobile typecheck and lint. Build any changed shared package.

## Verification

- Mobile unit cases failed before the scale, date, offset and form changes, and passed after them.
- Core 58/58, web 1170/1170, mobile 90/90, mobile typecheck and lint passed.
- Android confirmed the initial time position, separate lanes for overlapping tasks, both detail sheets, the all-day row, the empty-day position, cross-month day stepping, collapse to Gün and persistence after relaunch. The past holiday has no writable hours. The API confirmed the saved 12:00–13:00 task. At 360 dp the final slot prefilled 23:00–23:59. Fixture records were removed and checked.
