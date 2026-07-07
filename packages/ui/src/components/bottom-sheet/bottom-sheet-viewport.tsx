"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { BottomSheetPanel } from "./bottom-sheet-panel.js";
import type { BottomSheetRecord } from "./types.js";

export interface BottomSheetViewportProps {
  sheet: BottomSheetRecord | null;
  closeLabel: string;
  onBackdropClick: () => void;
  onActionSelect: (actionId: string) => void;
  onCancel: () => void;
  onApply: () => void;
  onClose: () => void;
}

/**
 * Portaled bottom sheet (Stitch Prompt 03): backdrop z-40, panel z-50.
 * Mobile: slide from bottom. Desktop: centered dialog (no drag handle).
 */
export function BottomSheetViewport({
  sheet,
  closeLabel,
  onBackdropClick,
  onActionSelect,
  onCancel,
  onApply,
  onClose,
}: BottomSheetViewportProps) {
  const [mounted, setMounted] = useState(false);
  const sheetOpen = sheet !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    document.documentElement.classList.add("mentor-sheet-open");
    return () => {
      document.documentElement.classList.remove("mentor-sheet-open");
    };
  }, [sheetOpen]);

  if (!mounted || !sheet) return null;

  return createPortal(
    <div className="fixed inset-0 z-[40]">
      <button
        type="button"
        aria-label={closeLabel}
        className={`absolute inset-0 bg-[#111111]/40 backdrop-blur-sm ${sheet.exiting ? "opacity-0" : "animate-dialog-backdrop-enter motion-reduce:animate-none"} motion-reduce:transition-none transition-opacity duration-200`}
        onClick={onBackdropClick}
      />
      <div className="pointer-events-none fixed inset-0 z-[50] flex max-lg:items-end lg:items-center lg:justify-center lg:p-5">
        <div className="pointer-events-auto w-full max-lg:max-h-[70vh] lg:w-full lg:max-h-[82dvh] lg:max-w-[480px]">
          <BottomSheetPanel
            sheet={sheet}
            onActionSelect={onActionSelect}
            onCancel={onCancel}
            onApply={onApply}
            onClose={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
