"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { PlanViewMode } from "./plan-utils";

const MODES: PlanViewMode[] = ["list", "timeline", "calendar"];

const pillTransition = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function PlanViewSwitcher({
  value,
  onChange,
}: {
  value: PlanViewMode;
  onChange: (mode: PlanViewMode) => void;
}) {
  const t = useTranslations("plan");
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={t("view_switch_aria")}
      className="flex w-full rounded-full border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] p-1"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-surface-container) 80%, transparent)",
      }}
    >
      {MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className="relative min-h-10 flex-1 cursor-pointer rounded-full px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
            style={{
              fontFamily: "var(--font-heading)",
              color: active ? "var(--color-btn-label)" : "var(--color-secondary)",
            }}
          >
            {active ? (
              reduceMotion ? (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: "var(--color-main)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  aria-hidden
                />
              ) : (
                <motion.span
                  layoutId="plan-view-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: "var(--color-main)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  transition={pillTransition}
                  aria-hidden
                />
              )
            ) : null}
            <span className="relative z-10">{t(`view_${mode}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
