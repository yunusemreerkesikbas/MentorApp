"use client";

import { useId } from "react";
import X from "lucide-react/dist/esm/icons/x.mjs";
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
  const panelSize = bodyScroll
    ? "max-lg:max-h-[70vh] lg:max-h-[82dvh]"
    : "max-lg:h-[70vh] lg:h-[82dvh]";

  const panelAnimation = sheet.exiting
    ? "max-lg:animate-sheet-exit lg:animate-dialog-exit motion-reduce:opacity-0"
    : "max-lg:animate-sheet-enter lg:animate-dialog-enter motion-reduce:animate-none";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-mentor-bottom-sheet-panel
      className={`flex w-full flex-col overflow-hidden bg-white ${panelSize} max-lg:rounded-t-[16px] max-lg:shadow-[0px_-4px_10px_rgba(37,73,150,0.10)] lg:max-w-[480px] lg:rounded-[var(--radius-card)] lg:border lg:border-white lg:shadow-[var(--shadow-card)] ${panelAnimation}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle — mobile only */}
      {isAction ? (
        <div
          className="flex h-6 shrink-0 items-center justify-center lg:hidden"
          aria-hidden
        >
          <div
            className="h-1 w-9 rounded-full"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--color-secondary) 40%, transparent)",
            }}
          />
        </div>
      ) : null}

      {/* Header */}
      <div
        className={`shrink-0 border-b px-5 pb-3 ${isFilter ? "flex items-center justify-between gap-3 pt-4 lg:pt-5" : "max-lg:pt-1 max-lg:text-center lg:pt-4 lg:text-left"}`}
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 6%, transparent)",
        }}
      >
        {isFilter ? <span className="w-6 shrink-0" aria-hidden /> : null}
        <h2
          id={titleId}
          className={`text-lg font-semibold leading-snug ${isFilter ? "flex-1 text-center" : ""}`}
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {sheet.title}
        </h2>
        {isFilter ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            aria-label={sheet.closeLabel}
          >
            <X size={20} strokeWidth={2} color="var(--color-secondary)" />
          </button>
        ) : null}
      </div>

      {/* Body */}
      <div
        className={`min-h-0 flex-1 px-5 ${bodyScroll ? "mentor-scrollarea overflow-y-auto" : "overflow-hidden"} ${isAction ? "py-0" : "py-3"}`}
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
                ? "flex flex-col gap-4"
                : "flex h-full min-h-0 flex-col gap-4 overflow-hidden"
            }
          >
            {sheet.children}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {isAction && sheet.cancelLabel ? (
        <div className="shrink-0 px-5 pb-[34px] pt-2 lg:pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 w-full items-center justify-center rounded-[10px] text-sm font-bold transition-transform active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
            style={{
              backgroundColor: "var(--color-surface-container, #f0edec)",
              color: "var(--color-main)",
              fontFamily: "var(--font-body)",
            }}
          >
            {sheet.cancelLabel}
          </button>
        </div>
      ) : null}

      {isFilter && sheet.applyLabel ? (
        <div
          className="shrink-0 border-t px-5 pb-[34px] pt-4 lg:pb-5"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 6%, transparent)",
          }}
        >
          <Button fullWidth busy={sheet.busyApply} onClick={onApply}>
            {sheet.applyLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
