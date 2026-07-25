# Plan page UI redesign (2026-07-25)

Validated design for `/plan` chrome. Tokens only (`DESIGN.md` / `@mentor/ui`).

## Tabs
- Capsule segmented control (`rounded-full` track + pill).
- Active: `main` fill + white label; inactive: `secondary-text`.
- Motion: Framer `layoutId="plan-view-pill"` (tween ~200ms); skip when `prefers-reduced-motion`.

## Date (Liste / Timeline)
- Reuse week strip (same as Hafta mobile nav): month/week header, ← →, 7-day row.
- Today: bolder numeral; selected: soft `progress` circle via `layoutId="plan-day-selected"`.
- Planned days: dot under numeral only when tasks exist (`progress` / `success` if 100%).
- Progress bar stays below the strip; calendar sheet entry remains.
- Week change: light horizontal slide + fade (`AnimatePresence`).

## Actions
- **Görev ekle:** `Button` `accent` (`--color-accent`), `min-h-11`, not oversized black slab.
- **Koçla planla:** compact soft secondary (`accent-soft` well), not full-width black/outline slab.
- Press feedback: optional `whileTap={{ scale: 0.98 }}` when motion allowed.

## Timeline (weekly vertical chronology)
- Same week as the strip (`weekAnchor`); all 7 days visible; empty days show short empty copy.
- Opens on **today**; scroll up = past days, scroll down = future days.
- Sticky rail badge: **day + short month** (not weekday — weekday stays in the section title).
- Rail fill tracks scroll (grows down / shrinks up); strip syncs from scroll + taps.
- Tasks via `PlanTaskRow` (no card shadow); pending then done per day.
- No backend change — uses existing `weekTasks`.

## Out of scope
- Global Nuton primary (`btn` black) rewrite across the app.
- New date-picker library; calendar bottom sheet stays.
