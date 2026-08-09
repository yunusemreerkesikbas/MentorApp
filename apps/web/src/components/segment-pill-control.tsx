"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

const pillTransition = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

export interface SegmentPillItem {
  id: string;
  label: ReactNode;
  /** Associated tabpanel id for aria-controls. */
  panelId?: string;
}

export interface SegmentPillControlProps {
  items: SegmentPillItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Unique Framer layoutId per surface so pills don't animate across pages. */
  layoutId: string;
  /** Stretch tabs equally across the track (Analysis). */
  equalWidth?: boolean;
  /** Prefix for tab button ids: `{idPrefix}-{item.id}`. */
  idPrefix?: string;
  className?: string;
}

/**
 * Sliding pill segment control — Plan Gün/Hafta/Ay visual, reusable across app surfaces.
 */
export function SegmentPillControl({
  items,
  value,
  onChange,
  ariaLabel,
  layoutId,
  equalWidth = false,
  idPrefix,
  className = "",
}: SegmentPillControlProps) {
  const reduceMotion = useReducedMotion();

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const currentIndex = items.findIndex((item) => item.id === id);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex == null) return;
    event.preventDefault();
    const next = items[nextIndex]!;
    onChange(next.id);
    requestAnimationFrame(() => {
      const nextButtonId = idPrefix ? `${idPrefix}-${next.id}` : undefined;
      if (nextButtonId) {
        document.getElementById(nextButtonId)?.focus();
      }
    });
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        "flex shrink-0 rounded-full p-1",
        equalWidth ? "w-full" : "self-start",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-surface-container) 58%, white)",
      }}
    >
      {items.map((item) => {
        const active = item.id === value;
        const buttonId = idPrefix ? `${idPrefix}-${item.id}` : undefined;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={buttonId}
            aria-selected={active}
            aria-controls={item.panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => moveFocus(event, item.id)}
            className={[
              "relative cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
              equalWidth ? "min-h-11 flex-1" : "min-h-9",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              fontFamily: "var(--font-heading)",
              color: active ? "var(--color-main)" : "var(--color-secondary)",
            }}
          >
            {active ? (
              reduceMotion ? (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  aria-hidden
                />
              ) : (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    boxShadow: "var(--shadow-card)",
                  }}
                  transition={pillTransition}
                  aria-hidden
                />
              )
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
