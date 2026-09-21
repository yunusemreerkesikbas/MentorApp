"use client";

import { ChevronRight } from "lucide-react";

import { PremiumBadge } from "./premium-badge";

/**
 * A free user's way into a premium feature: the feature's own words, then the PREMIUM label
 * (the same one premium members carry in the sidebar), never a padlock or a blurred preview.
 */
export function PremiumLockNudge({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ color: "var(--play-selected-ink)" }}
    >
      {/* In a narrow bubble the badge drops to its own line; the label never breaks word by word. */}
      <span className="min-w-0">{label}</span>
      <ChevronRight
        size={16}
        strokeWidth={2.25}
        className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden
      />
      <PremiumBadge />
    </button>
  );
}
