"use client";

import { useTranslations } from "next-intl";

// Premium Puhu's hero mask on a 24 grid: one outline with the eye holes cut out (evenodd).
const MASK =
  "M1.2 7Q1.25 5.6 2.1 6.25C3 7.1 4 7.7 5.3 7.7C7.2 7.6 8.7 7.3 10.2 8Q12 8.8 13.8 8C15.3 7.3 16.8 7.6 18.7 7.7C20 7.7 21 7.1 21.9 6.25Q22.75 5.6 22.8 7C22.9 9.6 22.4 12.6 21.2 14.8C20.2 16.6 18.6 17.7 16.6 17.7C15 17.7 14 16.9 13.3 15.8Q12 14.2 10.7 15.8C10 16.9 9 17.7 7.4 17.7C5.4 17.7 3.8 16.6 2.8 14.8C1.6 12.6 1.1 9.6 1.2 7Z";
const EYES =
  "M3.8 12.4a3.6 3.1 0 1 0 7.2 0a3.6 3.1 0 1 0-7.2 0ZM13 12.4a3.6 3.1 0 1 0 7.2 0a3.6 3.1 0 1 0-7.2 0Z";
/** The mask outline with its eye holes, for places that draw the mask without the identity meaning. */
export const PREMIUM_MASK_PATH = MASK + EYES;
const RING_INNER =
  "M4.8 12.4a2.6 2.1 0 1 0 5.2 0a2.6 2.1 0 1 0-5.2 0ZM14 12.4a2.6 2.1 0 1 0 5.2 0a2.6 2.1 0 1 0-5.2 0Z";

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
        <path fill="currentColor" fillRule="evenodd" d={MASK + EYES} />
        {size > 16 ? (
          <path style={{ fill: "var(--premium-ring-to)" }} fillRule="evenodd" d={EYES + RING_INNER} />
        ) : null}
      </svg>
    </span>
  );
}
