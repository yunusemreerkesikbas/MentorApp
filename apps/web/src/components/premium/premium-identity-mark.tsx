"use client";

import { useTranslations } from "next-intl";
import { PREMIUM_MASK_EYES, PREMIUM_MASK_PATH, PREMIUM_MASK_RING_INNER } from "./premium-mask";

/**
 * Name-adjacent premium identity (DESIGN.md §7): premium Puhu's hero mask in `--premium-mark`,
 * not an avatar overlay, not a verification tick. The gold eye rings sit inside the holes, so the
 * outline is the same at every size; at 16 px they would blur under a pixel, so they start at 20.
 * The word "Premium" lives in the accessible name, not on the chrome.
 */
export function PremiumIdentityMark({ size = 16 }: { size?: 16 | 20 | 24 }) {
  const t = useTranslations("common");
  const label = t("premium_member");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="premium-identity-mark"
      className="inline-flex shrink-0"
      style={{ color: "var(--premium-mark)" }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable="false">
        <path fill="currentColor" fillRule="evenodd" d={PREMIUM_MASK_PATH} />
        {size > 16 ? (
          <path style={{ fill: "var(--premium-ring-to)" }} fillRule="evenodd" d={PREMIUM_MASK_EYES + PREMIUM_MASK_RING_INNER} />
        ) : null}
      </svg>
    </span>
  );
}
