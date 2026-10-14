/**
 * One segment of the /seans top bar (subject, scene, sound). The bar itself is the single glass
 * strip (`SessionTopBar`); a segment is only its hit area, tinted on hover.
 */
export const SESSION_CHROME_PILL_CLASS =
  "inline-flex min-h-11 max-w-[12.5rem] cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:opacity-80 motion-reduce:transition-none";

export const SESSION_CHROME_PILL_STYLE = {
  color: "var(--color-main)",
  fontFamily: "var(--font-body)",
} as const;
