"use client";

import Check from "lucide-react/dist/esm/icons/check.mjs";

/**
 * Designed welcome headline — Family/Ley-style hierarchy, not plain H1.
 * Lead line + pill emphasis (soft shadow chip) over the soft-fade band.
 */
export function WelcomeHeroSlogan({
  lead,
  emphasis,
  fullTitle,
}: {
  lead: string;
  emphasis: string;
  /** Full sentence for accessibility. */
  fullTitle: string;
}) {
  return (
    <h1 className="flex flex-col items-center gap-3 text-center">
      <span className="sr-only">{fullTitle}</span>
      <span
        aria-hidden
        className="text-base font-semibold tracking-[-0.01em]"
        style={{ color: "var(--color-secondary)", fontFamily: "var(--font-heading)" }}
      >
        {lead}
      </span>
      <span
        aria-hidden
        className="inline-flex max-w-full items-center gap-2.5 rounded-full px-5 py-3"
        style={{
          backgroundColor: "var(--color-surface)",
          boxShadow: "var(--shadow-card)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-main)" }}
        >
          <Check size={14} strokeWidth={3} color="var(--color-bg)" aria-hidden />
        </span>
        <span
          className="text-lg font-bold leading-none tracking-[-0.02em] sm:text-xl"
          style={{ color: "var(--color-main)" }}
        >
          {emphasis}
        </span>
      </span>
    </h1>
  );
}
