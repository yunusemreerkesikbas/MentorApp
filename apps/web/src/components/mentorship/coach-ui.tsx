/**
 * Inset group classes for the coach's side panels (the week composer, the weekly report, the
 * follow-ups), on the panel's type scale and tokens (DESIGN.md §3). The pages themselves use the
 * panel's classes (`components/panel/panel-styles.ts`).
 *
 * Fields, menus, date pickers and buttons are the app's shared components (`@mentor/ui`,
 * `MenuSelect`, `DateField`), the same ones the coach calendar uses; only the grouping lives here.
 */

export const INSET_GROUP_CLASS =
  "overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

/** Light `--color-border` is white; surface-container is the visible hairline on a white card. */
export const INSET_DIVIDE_CLASS = "divide-y divide-[var(--color-surface-container)]";

/** One row of an inset group. Put `INSET_DIVIDE_CLASS` on the group. */
export const INSET_ROW_CLASS = "flex min-h-11 items-center justify-between gap-3 px-4 py-2.5";

/** A small grey heading inside a section or panel ("Hızlı başlangıç", "Bu hafta"). */
export const SUBHEAD_CLASS = "px-1 text-caption font-extrabold text-[var(--color-secondary)]";

/** The quiet explanatory line under a block. */
export const NOTE_CLASS = "px-1 text-caption text-[var(--color-secondary)]";
