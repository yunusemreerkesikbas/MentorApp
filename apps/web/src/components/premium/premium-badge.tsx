"use client";

import { useTranslations } from "next-intl";

/**
 * The canonical PREMIUM badge across the app (Paywall modal header, Dashboard membership card,
 * PremiumLockNudge triggers, Plan AI adaptation preview, Coach gate, and Sidebar coach standing).
 * Uses the aurora gradient pill (`#7eb6e8 → #c4b8e0 → #f3a6c8`) with dark `#12141a` ink (~10:1
 * contrast on both light and dark surfaces).
 *
 * The copy is already upper case (`PREMIUM`) in messages: CSS `uppercase` under `lang="tr"` would
 * turn the I into İ. `label` swaps the word for coach standing (`KOÇ PRO`).
 */
export function PremiumBadge({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  const t = useTranslations("common");

  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-micro font-black tracking-[0.06em] shadow-xs ${className}`.trim()}
      style={{
        backgroundImage:
          "var(--premium-badge-gradient, linear-gradient(135deg, #7eb6e8 0%, #c4b8e0 52%, #f3a6c8 100%))",
        backgroundColor: "var(--premium-badge-bg)",
        color: "var(--premium-badge-ink)",
      }}
    >
      {label ?? t("premium_badge")}
    </span>
  );
}
