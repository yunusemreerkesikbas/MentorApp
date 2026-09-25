/**
 * The panel's shared classes (DESIGN.md §4–§6.1). Every screen that converges to the panel uses
 * these, so the page frame, cards and actions look the same from `/panel` to `/analiz`.
 */

/** Page frame shared by a screen and its skeleton, so the swap moves nothing. */
export const PANEL_MAIN_CLASS =
  "mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-4 sm:px-8 lg:px-10 lg:py-8";

export const PANEL_GRID_CLASS =
  "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start";

/** Plain panel card (rail and main column alike). */
export const PANEL_CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]";

/** A screen's hero card: the plain card with the hero's 20 / 28px padding (DESIGN.md §4). */
export const PANEL_HERO =
  "flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-5 pt-5 shadow-[var(--shadow-card)] sm:px-7 sm:pt-6";

/** The hero's heading, 20 → 22 / 800. */
export const PANEL_HERO_TITLE =
  "text-xl font-extrabold leading-snug text-[var(--color-main)] sm:text-title";

export const PANEL_CARD_TITLE =
  "text-base font-extrabold leading-snug text-[var(--color-main)]";

/** Quiet text action inside a card ("Tümü", "Topluluğa git"). */
export const PANEL_TEXT_LINK =
  "inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/** A card link one step quieter, beside a card link or a small button ("Vazgeç", "Arşiv"). */
export const PANEL_QUIET_LINK =
  "inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-extrabold text-[var(--color-secondary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-wait";

/** The one text action that sits beside a ledge ("Planı düzenle"): one step larger than a card link. */
export const LEDGE_TEXT_LINK =
  "inline-flex min-h-11 items-center text-body-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/** Play ledge (DESIGN.md §6) as a link: `@mentor/ui` Button is a `<button>`. */
export const LEDGE =
  "inline-flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-[var(--play-radius)] px-5 text-base font-extrabold sm:px-6 sm:text-lg outline-none transition-[transform,box-shadow] duration-[120ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:translate-y-1 active:shadow-none motion-reduce:transition-none";

export const LEDGE_FILLED =
  "bg-[var(--play-cta)] text-[var(--play-cta-ink)] shadow-[0_4px_0_var(--play-cta-edge)]";

export const LEDGE_OUTLINE =
  "border-2 border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--play-selected-ink)] shadow-[0_4px_0_var(--play-line)]";
