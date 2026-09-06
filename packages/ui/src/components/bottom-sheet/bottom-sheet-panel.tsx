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
    sheet.size === "full"
      ? "max-lg:rounded-none"
      : sheet.size === "wide"
        ? "max-lg:rounded-t-[20px]"
        : "max-lg:rounded-t-[16px]";

  const panelClass =
    "flex w-full flex-col overflow-hidden bg-[color-mix(in_srgb,var(--color-surface)_84%,transparent)] backdrop-blur-2xl backdrop-saturate-[190%] " +
    "max-lg:border-t max-lg:border-white/80 dark:max-lg:border-white/15 " +
    "max-lg:shadow-[0_-8px_32px_rgba(0,0,0,0.14),inset_0_1px_1px_0_rgba(255,255,255,0.7)] dark:max-lg:shadow-[0_-12px_44px_rgba(0,0,0,0.55),inset_0_1px_1px_0_rgba(255,255,255,0.12)] " +
    "lg:rounded-[var(--radius-card)] lg:border lg:border-white/70 dark:lg:border-white/12 " +
    "lg:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.22),inset_0_1px_1.5px_0_rgba(255,255,255,0.85)] dark:lg:shadow-[0_28px_60px_-15px_rgba(0,0,0,0.65),inset_0_1px_1.5px_0_rgba(255,255,255,0.14)]";

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
      {/* Drag handle / notch — mobile only, all sheet types (auth-shell reference) */}
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

      {/* Header */}
      <div
        className={`shrink-0 border-b px-5 pb-3 ${isFilter ? "flex items-center justify-between gap-3 pt-1 lg:pt-5" : "max-lg:pt-0 max-lg:text-center lg:pt-4 lg:text-left"}`}
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 7%, transparent)",
        }}
      >
        {isFilter ? <span className="w-9 shrink-0" aria-hidden /> : null}
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            aria-label={sheet.closeLabel}
          >
            <X size={18} strokeWidth={2.2} color="var(--color-secondary)" />
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
        <div className="shrink-0 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 lg:pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 w-full items-center justify-center rounded-[10px] text-sm font-bold transition-all active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.04] dark:border-white/[0.08]"
            style={{
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
          className="shrink-0 border-t px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 lg:pb-5"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 7%, transparent)",
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
