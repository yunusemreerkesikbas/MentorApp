"use client";

import type { ReactNode } from "react";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left.mjs";

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
}: HistorySidePanelProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid={testId}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
      >
        <h2
          id={titleId}
          className="min-w-0 flex-1 text-base font-bold leading-tight"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-main)",
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
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "var(--color-main)" }}
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
            borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
