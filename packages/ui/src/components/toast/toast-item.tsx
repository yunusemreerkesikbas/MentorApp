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
 * Single toast card (overlay kit, DESIGN.md §6.1): solid surface, bare status glyph, title 14/800
 * + message 13/600, one text action, dismiss, optional auto-dismiss progress bar.
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
      className={`pointer-events-auto relative w-full overflow-hidden rounded-[var(--play-radius)] border border-[var(--play-line)] bg-[var(--color-surface)] shadow-[var(--shadow-overlay)] transition-opacity duration-200 motion-reduce:transition-none ${stackOpacity} ${toast.exiting ? "!opacity-0" : stackIndex === 0 ? "animate-toast-enter motion-reduce:animate-none" : ""}`}
    >
      <div className="flex items-start gap-3 py-3.5 pl-3.5 pr-2">
        {leading ? (
          <div className="flex size-6 shrink-0 items-center justify-center">{leading}</div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <h4 className="text-sm font-extrabold leading-[1.35] text-[var(--color-main)]">
            {toast.title}
          </h4>
          {toast.message ? (
            <p className="line-clamp-2 text-caption font-semibold text-[var(--color-body)]">
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
              className="inline-flex min-h-9 cursor-pointer items-center self-start text-sm font-extrabold text-[var(--play-selected-ink)] underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label={toast.dismissLabel}
          className="-my-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] outline-none transition-colors hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
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
