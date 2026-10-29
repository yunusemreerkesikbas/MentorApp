"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useTranslations } from "next-intl";
import { Chart2Icon } from "@solar-icons/react/bold/chart-2";
import { ChatRoundDotsIcon } from "@solar-icons/react/bold/chat-round-dots";
import { CheckCircleIcon } from "@solar-icons/react/bold/check-circle";
import { ClipboardCheckIcon } from "@solar-icons/react/bold/clipboard-check";
import { NotebookIcon } from "@solar-icons/react/bold/notebook";
import { Sun2Icon } from "@solar-icons/react/bold/sun-2";
import type { PremiumFeatureId } from "@mentor/types";
import { orderPaywallBenefits, type PaywallBenefit } from "@/lib/paywall-benefits";

const EASE_SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

type DisplayedBenefit = PaywallBenefit | "notebook" | "adfree";

const DEFAULT_DISPLAY_BENEFITS: readonly DisplayedBenefit[] = [
  "coach",
  "notebook",
  "analysis",
  "plan",
  "adfree",
];

const benefitListVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.04,
    },
  },
};

const benefitItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_SMOOTH_OUT },
  },
};

const BENEFIT_ICONS: Record<DisplayedBenefit, typeof Chart2Icon> = {
  notebook: NotebookIcon,
  coach: ChatRoundDotsIcon,
  daily: Sun2Icon,
  analysis: Chart2Icon,
  plan: ClipboardCheckIcon,
  adfree: CheckCircleIcon,
};

function buildDisplayedBenefits(
  sourceFeature: PremiumFeatureId | undefined,
  highlightNotebook: boolean,
): { rows: readonly DisplayedBenefit[]; highlighted: DisplayedBenefit | undefined } {
  if (highlightNotebook) {
    return {
      rows: [
        "notebook",
        ...DEFAULT_DISPLAY_BENEFITS.filter((item) => item !== "notebook"),
      ],
      highlighted: "notebook",
    };
  }
  const base = orderPaywallBenefits(sourceFeature);
  if (!base.highlighted) {
    return { rows: DEFAULT_DISPLAY_BENEFITS, highlighted: undefined };
  }
  if (base.highlighted === "daily") {
    return {
      rows: ["daily", "coach", "notebook", "analysis", "adfree"],
      highlighted: "daily",
    };
  }
  return {
    rows: [
      base.highlighted,
      ...DEFAULT_DISPLAY_BENEFITS.filter((item) => item !== base.highlighted),
    ],
    highlighted: base.highlighted,
  };
}

interface PremiumPaywallBenefitsProps {
  sourceFeature?: PremiumFeatureId;
  /** When true (e.g. opened from a notebook quota limit), lifts the unlimited-notebook benefit to row 1. */
  highlightNotebook?: boolean;
}

export function PremiumPaywallBenefits({
  sourceFeature,
  highlightNotebook = false,
}: PremiumPaywallBenefitsProps) {
  const t = useTranslations("paywall");
  const reduceMotion = useReducedMotion();
  const { rows, highlighted } = buildDisplayedBenefits(
    sourceFeature,
    highlightNotebook,
  );

  return (
    <motion.ul
      className="mt-4 flex flex-col"
      variants={reduceMotion ? undefined : benefitListVariants}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {rows.map((benefit) => {
        const Icon = BENEFIT_ICONS[benefit];
        const isHighlighted = benefit === highlighted;
        return (
          <motion.li
            key={benefit}
            variants={reduceMotion ? undefined : benefitItemVariants}
            data-highlighted={isHighlighted || undefined}
            className={`flex items-center gap-3 text-left transition-colors px-1 py-1`}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
                isHighlighted
                  ? "border-white/25 bg-white/[0.14]"
                  : "border-white/10 bg-white/[0.06]"
              }`}
              style={{ color: "var(--color-main)" }}
            >
              <Icon size={18} aria-hidden />
            </span>
            <span
              className="min-w-0 text-[15px] font-semibold leading-snug"
              style={{ color: "var(--color-main)" }}
            >
              {t(`benefit_${benefit}_title`)}
            </span>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
