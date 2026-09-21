/** Page frame shared by the panel and its skeleton, so the swap moves nothing. */
export const PANEL_MAIN_CLASS =
  "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-8 lg:px-10 lg:py-8";

export const PANEL_GRID_CLASS =
  "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start";

/** Plain panel card (rail and main column alike). */
export const PANEL_CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]";

export const PANEL_CARD_TITLE =
  "text-base font-extrabold leading-snug text-[var(--color-main)]";

/** Quiet text action inside a card ("Tümü", "Topluluğa git"). */
export const PANEL_TEXT_LINK =
  "inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";
