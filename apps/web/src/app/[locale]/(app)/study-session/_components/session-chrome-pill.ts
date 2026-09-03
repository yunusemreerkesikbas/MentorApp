/** Shared pill chrome for subject + ambient dropdowns on /seans. */

export const SESSION_CHROME_PILL_CLASS =
  "inline-flex min-h-11 max-w-[12.5rem] cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-semibold session-liquid-pill transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default disabled:opacity-80 motion-reduce:transition-none motion-reduce:hover:scale-100";

export const SESSION_CHROME_PILL_STYLE = {
  color: "#ffffff",
  fontFamily: "var(--font-body)",
} as const;
