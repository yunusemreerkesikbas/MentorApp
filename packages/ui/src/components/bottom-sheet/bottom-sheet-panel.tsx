"use client";
import { X } from "lucide-react";

import { useId } from "react";
import { Button } from "../button.js";
import { BottomSheetActionList } from "./bottom-sheet-action-list.js";
import type { BottomSheetRecord } from "./types.js";

export interface BottomSheetPanelProps {
  sheet: BottomSheetRecord;
  onActionSelect: (actionId: string) => void;
  onCancel: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function BottomSheetPanel({
  sheet,
  onActionSelect,
  onCancel,
  onApply,
  onClose,
}: BottomSheetPanelProps) {
  const titleId = useId();
  const isAction = sheet.layout === "action";
  const isFilter = sheet.layout === "filter";
  const bodyScroll = sheet.bodyScroll ?? true;
  const panelSize =
    sheet.size === "full"
      ? bodyScroll
        ? "max-lg:max-h-dvh lg:max-h-[88dvh]"
        : "max-lg:h-dvh lg:h-[88dvh]"
      : sheet.size === "wide"
        ? bodyScroll
          ? "max-lg:max-h-[92dvh] lg:max-h-[84dvh]"
          : "max-lg:h-[92dvh] lg:h-[84dvh]"
        : bodyScroll
          ? "max-lg:max-h-[70vh] lg:max-h-[82dvh]"
          : "max-lg:h-[70vh] lg:h-[82dvh]";

  const panelAnimation = sheet.exiting
    ? "max-lg:animate-sheet-exit lg:animate-dialog-exit motion-reduce:opacity-0"
    : "max-lg:animate-sheet-enter lg:animate-dialog-enter motion-reduce:animate-none";

  const maxWidthClass =
    sheet.size === "full"
      ? "lg:max-w-[560px]"
      : sheet.size === "wide"
        ? "lg:max-w-[520px]"
        : sheet.size === "compact"
          ? "lg:max-w-[400px]"
          : "lg:max-w-[480px]";

  const roundedClass =
    sheet.size === "full" ? "max-lg:rounded-none" : "max-lg:rounded-t-[var(--play-sheet-radius)]";

  // Overlay kit: solid surface, no glass. Phones lift the sheet upward; desktop floats a card.
  const panelClass =
    "flex w-full flex-col overflow-hidden bg-[var(--color-surface)] max-lg:shadow-[var(--shadow-sheet)] " +
    "lg:rounded-[var(--play-radius)] lg:border lg:border-[var(--color-border)] lg:shadow-[var(--shadow-overlay)]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-mentor-bottom-sheet-panel
      data-exiting={sheet.exiting ? "true" : undefined}
      className={`${panelClass} ${panelSize} ${roundedClass} ${maxWidthClass} ${panelAnimation}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle — mobile only, decorative (the sheet closes by backdrop, cancel or Escape). */}
      <div className="flex shrink-0 justify-center pb-1 pt-2.5 lg:hidden" aria-hidden>
        <div className="h-[5px] w-10 rounded-full bg-[color-mix(in_srgb,var(--color-secondary)_40%,transparent)]" />
      </div>

      {/* Header — an action sheet's rows draw their own top rules, so only the filter needs one. */}
      <div
        className={`shrink-0 px-5 ${isFilter ? "flex items-center justify-between gap-2 border-b border-[var(--play-line)] pb-2.5 pt-1.5 lg:pt-4" : "pb-3.5 pt-2 max-lg:text-center lg:pt-6"}`}
      >
        {isFilter ? <span className="w-11 shrink-0" aria-hidden /> : null}
        <h2
          id={titleId}
          className={`text-base font-extrabold leading-snug text-[var(--color-main)] ${isFilter ? "flex-1 text-center" : ""}`}
        >
          {sheet.title}
        </h2>
        {isFilter ? (
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] outline-none transition-colors hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            aria-label={sheet.closeLabel}
          >
            <X size={22} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Body */}
      <div
        // Action rows skip `mentor-scrollarea`: its stable gutter made them narrower than cancel.
        className={`min-h-0 flex-1 px-5 ${bodyScroll ? (isAction ? "overflow-y-auto" : "mentor-scrollarea overflow-y-auto") : "overflow-hidden"} ${isAction ? "py-0" : "py-4"}`}
      >
        {isAction && sheet.actions ? (
          <BottomSheetActionList
            actions={sheet.actions}
            onSelect={onActionSelect}
          />
        ) : null}
        {isFilter && sheet.children ? (
          <div
            className={
              bodyScroll
                ? "flex flex-col gap-4.5"
                : "flex h-full min-h-0 flex-col gap-4.5 overflow-hidden"
            }
          >
            {sheet.children}
          </div>
        ) : null}
      </div>

      {/* Footer — cancel is a quiet full-width row, never a second ledge. */}
      {isAction && sheet.cancelLabel ? (
        <div className="shrink-0 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2.5 lg:pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-[52px] w-full cursor-pointer items-center justify-center rounded-[var(--play-radius)] bg-[var(--color-surface-container)] text-body-sm font-extrabold text-[var(--color-main)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] active:opacity-70 motion-reduce:transition-none"
          >
            {sheet.cancelLabel}
          </button>
        </div>
      ) : null}

      {isFilter && sheet.applyLabel ? (
        <div className="shrink-0 border-t border-[var(--play-line)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3.5 lg:pb-5">
          <Button fullWidth busy={sheet.busyApply} onClick={onApply}>
            {sheet.applyLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
