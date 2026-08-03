"use client";
import { PanelLeft } from "lucide-react";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  HISTORY_RAIL_COLLAPSED_PX,
  HISTORY_RAIL_EXPANDED_PX,
} from "./constants";
import { HistorySidePanel } from "./history-side-panel";

const railTransition = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

const railIconBtn =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

export interface HistorySideRailProps {
  title: string;
  railOpen: boolean;
  onRailOpenChange: (open: boolean) => void;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  /** Extra icon buttons shown in the collapsed strip (below expand). */
  collapsedActions?: ReactNode;
  ariaLabel?: string;
  testId?: string;
}

/**
 * Desktop collapsible history rail (Koç-style). Hidden below `lg`.
 */
export function HistorySideRail({
  title,
  railOpen,
  onRailOpenChange,
  expandLabel,
  collapseLabel,
  children,
  footer,
  headerActions,
  collapsedActions,
  ariaLabel,
  testId = "history-side-rail",
}: HistorySideRailProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      className="relative z-[1] hidden h-full shrink-0 overflow-hidden border-r bg-white/85 backdrop-blur-md lg:flex lg:flex-col"
      style={{
        borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
      }}
      initial={false}
      animate={{
        width: railOpen ? HISTORY_RAIL_EXPANDED_PX : HISTORY_RAIL_COLLAPSED_PX,
      }}
      transition={reduceMotion ? { duration: 0 } : railTransition}
      aria-label={ariaLabel ?? title}
      data-testid={testId}
    >
      <div
        className="absolute inset-y-0 left-0 flex w-[52px] flex-col items-center gap-1 px-1.5 pt-3 transition-opacity"
        style={{
          opacity: railOpen ? 0 : 1,
          pointerEvents: railOpen ? "none" : "auto",
          transitionDuration: reduceMotion ? "0ms" : "180ms",
        }}
        aria-hidden={railOpen}
        data-testid={`${testId}-collapsed`}
      >
        <button
          type="button"
          onClick={() => onRailOpenChange(true)}
          className={railIconBtn}
          aria-label={expandLabel}
          data-testid={`${testId}-expand`}
        >
          <PanelLeft
            className="size-5"
            style={{ color: "var(--color-main)" }}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        {collapsedActions}
      </div>

      <div
        className="flex h-full w-72 min-w-72 flex-col transition-opacity"
        style={{
          opacity: railOpen ? 1 : 0,
          pointerEvents: railOpen ? "auto" : "none",
          transitionDuration: reduceMotion ? "0ms" : "180ms",
        }}
        aria-hidden={!railOpen}
      >
        <HistorySidePanel
          title={title}
          onCollapse={() => onRailOpenChange(false)}
          collapseLabel={collapseLabel}
          headerActions={headerActions}
          footer={footer}
        >
          {children}
        </HistorySidePanel>
      </div>
    </motion.aside>
  );
}
