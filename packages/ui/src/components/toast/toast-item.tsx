"use client";
import { X } from "lucide-react";

import type * as React from "react";
import type { ToastRecord } from "./types.js";

export interface ToastItemProps {
  toast: ToastRecord;
  stackIndex: number;
  onDismiss: (id: string) => void;
  /** Optional default leading when toast.leading is unset (web bridge supplies Puhu/icons). */
  renderLeading?: (variant: ToastRecord["variant"]) => React.ReactNode;
}

/** Older stack entries fade slightly (Stitch stacked toast spec). */
const STACK_OPACITY: Record<number, string> = {
  0: "opacity-100",
  1: "opacity-70",
  2: "opacity-50",
};

/**
 * Single toast card (Stitch Prompt 01): translucent surface, optional leading,
 * title + message, dismiss, optional auto-dismiss progress bar.
 */
export function ToastItem({
  toast,
  stackIndex,
  onDismiss,
  renderLeading,
}: ToastItemProps) {
  const leading = toast.leading ?? renderLeading?.(toast.variant);
  const showProgress = toast.duration > 0;
  const stackOpacity = STACK_OPACITY[stackIndex] ?? STACK_OPACITY[2];

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      data-toast-id={toast.id}
      data-exiting={toast.exiting ? "" : undefined}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${stackOpacity} ${toast.exiting ? "!opacity-0" : stackIndex === 0 ? "animate-toast-enter motion-reduce:animate-none" : ""}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start p-3">
        {leading ? (
          <div className="mt-1 flex shrink-0 items-center justify-center">
            {leading}
          </div>
        ) : null}
        <div className={`min-w-0 flex-1 ${leading ? "ml-3" : ""}`}>
          <h4
            className="text-sm font-bold leading-snug"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-body)",
            }}
          >
            {toast.title}
          </h4>
          {toast.message ? (
            <p
              className="mt-0.5 line-clamp-2 text-sm leading-snug"
              style={{
                color: "var(--color-secondary)",
                fontFamily: "var(--font-body)",
              }}
            >
              {toast.message}
            </p>
          ) : null}
          {/* Under the text, not beside the dismiss button: it is a thing to do, not a way out.
              Acting also dismisses — the toast has said its piece and the user has answered it. */}
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className="mt-1.5 inline-flex min-h-9 cursor-pointer items-center rounded-[var(--radius-card)] px-2 text-sm font-bold outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                color: "var(--color-accent)",
                backgroundColor: "var(--color-accent-soft)",
                fontFamily: "var(--font-body)",
                marginLeft: "-0.5rem",
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label={toast.dismissLabel}
          className="-mr-2 -mt-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {showProgress ? (
        <div
          aria-hidden
          className="absolute bottom-0 left-0 h-1 w-full"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--color-progress-track) 30%, transparent)",
          }}
        >
          <div
            className="h-full motion-reduce:w-0"
            style={{
              backgroundColor: "var(--color-progress)",
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
