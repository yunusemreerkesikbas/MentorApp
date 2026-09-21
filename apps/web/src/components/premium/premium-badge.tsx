"use client";

import { useTranslations } from "next-intl";

/**
 * The PREMIUM label (DESIGN.md §7): the cape's clasp, gold on night blue (~9:1 at 11px).
 * A word rather than a crown, because the crown needed explaining and the word does not.
 * The copy is already upper case in the messages: CSS `uppercase` under `lang="tr"` would turn
 * the I into İ.
 */
export function PremiumBadge({ className = "" }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center rounded-full bg-[var(--premium-badge-bg)] px-2 text-micro font-black tracking-[0.06em] text-[var(--premium-badge-ink)] ${className}`.trim()}
    >
      {t("premium_badge")}
    </span>
  );
}
