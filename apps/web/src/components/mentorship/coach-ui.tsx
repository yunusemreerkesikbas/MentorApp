/**
 * Inset group classes for the coach's side panels (the week composer, the weekly report, the
 * follow-ups), on the panel's type scale and tokens (DESIGN.md §3). The pages themselves use the
 * panel's classes (`components/panel/panel-styles.ts`).
 *
 * Fields, menus, date pickers and buttons are the app's shared components (`@mentor/ui`,
 * `MenuSelect`, `DateField`), the same ones the coach calendar uses; only the grouping lives here.
 */
import { PANEL_QUIET_LINK, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";

export const INSET_GROUP_CLASS =
  "overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

/** Light `--color-border` is white; surface-container is the visible hairline on a white card. */
export const INSET_DIVIDE_CLASS = "divide-y divide-[var(--color-surface-container)]";

/** One row of an inset group. Put `INSET_DIVIDE_CLASS` on the group. */
export const INSET_ROW_CLASS = "flex min-h-11 items-center justify-between gap-3 px-4 py-2.5";

/** The quiet explanatory line under a block. */
export const NOTE_CLASS = "px-1 text-caption text-[var(--color-secondary)]";

/**
 * A panel action drawn as a text link ("Düzenle", "Tarihi kaydet", "Şablondan yükle"). It is a
 * `<button>`, so it gets the pointer and a visibly off state the link classes do not carry.
 */
export const PANEL_LINK_BUTTON = `${PANEL_TEXT_LINK} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline`;

/** The quieter sibling beside it ("Çıkar", "Vazgeç", "Takibi iptal et"). */
export const PANEL_QUIET_BUTTON = `${PANEL_QUIET_LINK} disabled:opacity-50 disabled:no-underline`;
