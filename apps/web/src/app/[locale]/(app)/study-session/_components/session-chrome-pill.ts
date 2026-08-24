/** Shared pill chrome for subject + ambient dropdowns on /seans. */

export const SESSION_CHROME_PILL_CLASS =
  "inline-flex min-h-11 max-w-[12.5rem] cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:opacity-80 motion-reduce:transition-none";

export const SESSION_CHROME_PILL_STYLE = {
  backgroundColor: "color-mix(in srgb, var(--color-surface) 78%, transparent)",
  color: "var(--color-main)",
  boxShadow: "var(--shadow-card)",
  fontFamily: "var(--font-body)",
} as const;
