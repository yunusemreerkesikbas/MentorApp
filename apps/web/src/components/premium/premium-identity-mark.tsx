"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Name-adjacent premium identity — not an avatar overlay, not a verification tick.
 * Amber crown only; the word "Premium" lives in the accessible name, not on the chrome.
 */
export function PremiumIdentityMark() {
  const t = useTranslations("common");
  const label = t("premium_member");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="premium-identity-mark"
      className="inline-flex shrink-0"
      style={{ color: "var(--color-star)" }}
    >
      <Crown className="size-4" strokeWidth={2.2} aria-hidden />
    </span>
  );
}
