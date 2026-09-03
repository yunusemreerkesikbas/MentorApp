"use client";
import { PanelLeft } from "lucide-react";

import type { ReactNode } from "react";
export { HistoryFilterSelect } from "./history-filter-select";
export type {
  HistoryFilterOption,
  HistoryFilterSelectProps,
} from "./history-filter-select";

export interface HistorySidePanelProps {
  title: string;
  titleId?: string;
  /** Desktop rail only — collapse the sidebar. */
  onCollapse?: () => void;
  collapseLabel?: string;
  /** Optional actions below the title row (e.g. primary shortcut). */
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
  variant?: "default" | "liquid";
  className?: string;
}

/**
 * Shared history panel body — used by the desktop rail and the mobile drawer.
 */
export function HistorySidePanel({
  title,
  titleId,
  onCollapse,
  collapseLabel,
  headerActions,
  children,
  footer,
  testId,
  variant = "default",
  className,
}: HistorySidePanelProps) {
  const isLiquid = variant === "liquid";

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${className ?? ""}`}
      data-testid={testId}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-4"
        style={{
          borderColor: isLiquid
            ? "rgba(255, 255, 255, 0.15)"
            : "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
      >
        <h2
          id={titleId}
          className="min-w-0 flex-1 text-base font-bold leading-tight"
          style={{
            fontFamily: "var(--font-heading)",
            color: isLiquid ? "#ffffff" : "var(--color-main)",
          }}
        >
          {title}
        </h2>
        {onCollapse && collapseLabel ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={collapseLabel}
            data-testid="history-side-panel-collapse"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all hover:bg-white/10 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <PanelLeft
              className="size-5"
              style={{ color: isLiquid ? "#ffffff" : "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      {headerActions ? (
        <div className="shrink-0 px-3 pt-3">{headerActions}</div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-3 mentor-scrollarea">
        {children}
      </div>

      {footer ? (
        <div
          className="shrink-0 border-t px-4 py-3"
          style={{
            borderColor: isLiquid
              ? "rgba(255, 255, 255, 0.15)"
              : "color-mix(in srgb, var(--color-main) 8%, transparent)",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
