"use client";

import type * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { forceReflow, prefersReducedMotion } from "./motion-utils.js";

export interface SlidingTabItem {
  id: string;
  label: React.ReactNode;
  panelId?: string;
}

export interface SlidingTabsProps {
  items: SlidingTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  equalWidth?: boolean;
  /** Pill segment (default) or bottom underline bar (drawer chrome). */
  variant?: "pill" | "underline";
  idPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SLIDE_TRANSITION =
  "transform var(--tabs-dur, 250ms) var(--tabs-ease, cubic-bezier(0.22, 1, 0.36, 1)), width var(--tabs-dur, 250ms) var(--tabs-ease, cubic-bezier(0.22, 1, 0.36, 1))";

/**
 * Sliding pill tablist — measures active tab and tweens pill width/transform
 * (transitions.dev tabs-sliding recipe).
 *
 * Important: snap (no transition) only on mount / resize / structure change.
 * Value changes must animate. Do NOT depend on a fresh `items` array identity
 * for the snap effect — parents recreate that array every render and would
 * cancel the slide by snapping before paint.
 */
export function SlidingTabs({
  items,
  value,
  onChange,
  ariaLabel,
  equalWidth = false,
  variant = "pill",
  idPrefix,
  className,
  style,
}: SlidingTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef(value);
  const hasPlacedRef = useRef(false);

  // Stable across parent re-renders that recreate the `items` array with the same ids.
  const itemsKey = items.map((item) => item.id).join("\0");

  const placePill = useCallback((animate: boolean) => {
    const root = rootRef.current;
    const pill = pillRef.current;
    if (!root || !pill) return;

    const active = root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!active) return;

    const nextTransform = `translateX(${active.offsetLeft}px)`;
    const nextWidth = `${active.offsetWidth}px`;
    const reduce = prefersReducedMotion();
    // Never animate the first placement — recipe snaps first paint / resize.
    const shouldAnimate = animate && !reduce && hasPlacedRef.current;

    if (!shouldAnimate) {
      pill.style.transition = "none";
      pill.style.transform = nextTransform;
      pill.style.width = nextWidth;
      forceReflow(pill);
      pill.style.transition = reduce ? "none" : SLIDE_TRANSITION;
    } else {
      pill.style.transition = SLIDE_TRANSITION;
      pill.style.transform = nextTransform;
      pill.style.width = nextWidth;
    }

    hasPlacedRef.current = true;
  }, []);

  // Snap on structure / layout — not on fresh `items` array identity.
  useLayoutEffect(() => {
    placePill(false);
  }, [placePill, itemsKey, equalWidth, variant]);

  // Animate when selection changes (mount skipped: valueRef starts equal).
  useEffect(() => {
    if (valueRef.current === value) return;
    valueRef.current = value;
    placePill(true);
  }, [placePill, value]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => placePill(false));
    ro.observe(root);
    return () => ro.disconnect();
  }, [placePill]);

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
      if (nextButtonId) document.getElementById(nextButtonId)?.focus();
    });
  }

  const underline = variant === "underline";
  const rootClass = [
    "t-tabs",
    "relative",
    underline
      ? "t-tabs--underline"
      : `inline-flex items-center gap-[3px] rounded-full p-[3px]${equalWidth ? " t-tabs--equal flex w-full" : ""}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label={ariaLabel}
      className={rootClass}
      style={
        underline
          ? style
          : {
              background:
                "var(--tabs-bar-bg, color-mix(in srgb, var(--color-surface-container) 58%, var(--color-surface)))",
              ...style,
            }
      }
    >
      <span
        ref={pillRef}
        className={
          underline
            ? "t-tabs-pill pointer-events-none absolute left-0 z-0"
            : "t-tabs-pill pointer-events-none absolute top-[3px] left-0 z-0 rounded-full shadow-[var(--shadow-card)]"
        }
        aria-hidden
        style={{
          background: underline
            ? "var(--tabs-pill-bg, var(--color-main))"
            : "var(--tabs-pill-bg, var(--color-surface))",
        }}
      />
      {items.map((item) => {
        const active = item.id === value;
        const buttonId = idPrefix ? `${idPrefix}-${item.id}` : undefined;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={buttonId}
            className={
              underline
                ? "t-tab relative z-[1] cursor-pointer appearance-none border-0 bg-transparent"
                : `t-tab relative z-[1] cursor-pointer appearance-none border-0 bg-transparent px-4 py-1.5 text-sm font-semibold${equalWidth ? " min-h-11 flex-1" : " min-h-9"}`
            }
            style={{
              fontFamily: "var(--font-heading)",
              color: active
                ? "var(--tabs-text-active, var(--color-main))"
                : "var(--tabs-text-muted, var(--color-secondary))",
              borderRadius: underline ? 0 : 9999,
            }}
            aria-selected={active}
            aria-controls={item.panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => moveFocus(event, item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
