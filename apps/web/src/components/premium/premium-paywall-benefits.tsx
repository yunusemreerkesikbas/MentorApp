"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Chart2Icon } from "@solar-icons/react/bold/chart-2";
import { ChatRoundDotsIcon } from "@solar-icons/react/bold/chat-round-dots";
import { ClipboardCheckIcon } from "@solar-icons/react/bold/clipboard-check";
import { Sun2Icon } from "@solar-icons/react/bold/sun-2";
import type { PremiumFeatureId } from "@mentor/types";
import { orderPaywallBenefits, type PaywallBenefit } from "@/lib/paywall-benefits";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";

/** Each row takes one hue the sheet already owns (blobs, the Premium star, the chip lavender), so the list is four things, not one thing four times. */
const BENEFIT_LOOK: Record<PaywallBenefit, { Icon: typeof Chart2Icon; hue: string }> = {
  // Solar Bold, the panel's glyphs for the same destinations (DESIGN.md §7).
  coach: { Icon: ChatRoundDotsIcon, hue: "var(--blob-blue)" },
  daily: { Icon: Sun2Icon, hue: "var(--color-star)" },
  analysis: { Icon: Chart2Icon, hue: "var(--color-chip-text)" },
  plan: { Icon: ClipboardCheckIcon, hue: "var(--blob-pink)" },
};

export function PremiumPaywallBenefits({ sourceFeature }: { sourceFeature?: PremiumFeatureId }) {
  const t = useTranslations("paywall");
  const reduceMotion = useReducedMotion();
  const { order, highlighted } = orderPaywallBenefits(sourceFeature);

  return (
    <motion.ul
      className="mt-4 flex flex-col gap-1.5 lg:mt-6"
      variants={reduceMotion ? undefined : staggerListVariants}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {order.map((benefit) => {
        const { Icon, hue } = BENEFIT_LOOK[benefit];
        const isHighlighted = benefit === highlighted;
        return (
          <motion.li
            key={benefit}
            variants={reduceMotion ? undefined : staggerItemVariants}
            data-highlighted={isHighlighted || undefined}
            className="flex items-center gap-3 py-1.5 text-left"
          >
            {/* No tile and no row wash: the hue lives in the glyph alone. The lifted row is told by its place. */}
            <span
              className="grid size-8 shrink-0 place-items-center"
              style={{ color: `color-mix(in srgb, ${hue} 70%, var(--color-main))` }}
            >
              <Icon size={24} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className="text-base font-bold leading-snug"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {t(`benefit_${benefit}_title`)}
              </span>
              <span className="text-sm leading-snug" style={{ color: "var(--color-body)" }}>
                {t(`benefit_${benefit}_desc`)}
              </span>
            </span>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
