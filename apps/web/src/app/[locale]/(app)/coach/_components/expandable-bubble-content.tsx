"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

/** Collapsed line caps — desktop (lg+) vs mobile/tablet. */
const COLLAPSED_LINES_DESKTOP = 10;
const COLLAPSED_LINES_MOBILE = 20;

function useCollapsedLineLimit(): number {
  const [lines, setLines] = useState(COLLAPSED_LINES_MOBILE);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setLines(mq.matches ? COLLAPSED_LINES_DESKTOP : COLLAPSED_LINES_MOBILE);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return lines;
}

type ExpandableBubbleContentProps = {
  children: ReactNode;
  /** Remeasure / collapse when the message body changes. */
  contentKey: string;
  /** Skip clamp (kept for callers that conditionally wrap). */
  disabled?: boolean;
  /** Fade gradient base — matches user bubble surface (`from-…`). */
  fadeFromClassName: string;
  /** Toggle link color — readable on the user bubble. */
  toggleClassName: string;
  className?: string;
};

/**
 * Panel-style expand/collapse for long **user** chat bubbles (measure + height motion + fade).
 * Coach replies stay unclamped. Collapsed: 10 lines on desktop (lg+), 20 on mobile.
 */
export function ExpandableBubbleContent({
  children,
  contentKey,
  disabled = false,
  fadeFromClassName,
  toggleClassName,
  className,
}: ExpandableBubbleContentProps) {
  const t = useTranslations("coach_chat");
  const reduceMotion = useReducedMotion();
  const collapsedLines = useCollapsedLineLimit();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);

  // Collapse when the bubble switches content. Adjusting state during render (React's documented
  // "changing state when props change" pattern) — an effect here cascades an extra render.
  const [renderedKey, setRenderedKey] = useState(contentKey);
  if (renderedKey !== contentKey) {
    setRenderedKey(contentKey);
    setExpanded(false);
  }

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el || disabled) {
      setNeedsToggle(false);
      setCollapsedHeight(null);
      setFullHeight(null);
      return;
    }
    const styles = getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

    const maxCollapsed = Math.round(lineHeight * collapsedLines);
    const nextFull = el.scrollHeight;
    setCollapsedHeight(maxCollapsed);
    setFullHeight(nextFull);
    setNeedsToggle(nextFull > maxCollapsed + 1);
  }, [collapsedLines, disabled]);

  useLayoutEffect(() => {
    measure();
  }, [measure, contentKey, children]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  const targetHeight = expanded
    ? (fullHeight ?? "auto")
    : (collapsedHeight ?? "auto");

  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")}>
      <motion.div
        initial={false}
        animate={{ height: needsToggle ? targetHeight : "auto" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
        }
        className="relative overflow-hidden"
      >
        <div ref={contentRef}>{children}</div>
        {!expanded && needsToggle ? (
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent ${fadeFromClassName}`}
          />
        ) : null}
      </motion.div>
      {needsToggle ? (
        <button
          type="button"
          className={`mt-1 min-h-9 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${toggleClassName}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("show_less") : t("show_more")}
        </button>
      ) : null}
    </div>
  );
}
