# Coach plan shared calendar (2026-09-11)

The coach `/plan` calendar uses the same Takvim chrome as the student plan: left rail + hour
grid, Gün / Hafta / Ay scales, mobile date strip and agenda. Student pixels stay the same.

## Shared layer

- `PlanCalendarItem<TSource>` is the only shape the grid/chip/strip/agenda/preview render.
- Adapters: `planTaskCalendarItem()` and `coachPlanCalendarItem()`. Color stays token-derived.
- `PlanCalendarFrame` is the two-column rail + main card. Mini calendar loads marked dates
  through a `loadMarkedDates` port.

## Coach differences

- Student filter lives in the left rail (desktop) and above the card (mobile).
- Chip color is the attendee set (personal = neutral). Task vs event is a glyph, not a hue.
- Create from an empty slot or FAB opens an action sheet (task / event), then the existing
  right-drawer form. Toolbar "Yeni görev" / "Yeni etkinlik" still open those forms directly.
- Detail is a live overlay (not a frozen bottom-sheet snapshot) so an in-flight reload can
  replace the open row. Forms stay `z-50` above it. The toolbar also sits at `z-50` so Yeni
  görev / Yeni etkinlik stay clickable while a row is open.

## Out of scope

- Student `plan-shell.tsx` decomposition.
- Coach completion/progress, subject legend, mutation/API changes.
