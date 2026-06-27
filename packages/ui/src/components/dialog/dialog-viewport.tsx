"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { DialogPanel } from "./dialog-panel.js";
import type { DialogRecord } from "./types.js";

export interface DialogViewportProps {
  dialog: DialogRecord | null;
  closeLabel: string;
  onBackdropClick: () => void;
  onAction: (actionId: string) => void;
}

/**
 * Portaled dialog overlay (Stitch Prompt 02): backdrop z-60, panel z-70.
 */
export function DialogViewport({
  dialog,
  closeLabel,
  onBackdropClick,
  onAction,
}: DialogViewportProps) {
  const [mounted, setMounted] = useState(false);
  const dialogOpen = dialog !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    document.documentElement.classList.add("mentor-dialog-open");
    return () => {
      document.documentElement.classList.remove("mentor-dialog-open");
    };
  }, [dialogOpen]);

  if (!mounted || !dialog) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label={closeLabel}
        className={`absolute inset-0 bg-[#111111]/40 backdrop-blur-sm ${dialog.exiting ? "opacity-0" : "animate-dialog-backdrop-enter motion-reduce:animate-none"} motion-reduce:transition-none transition-opacity duration-200`}
        onClick={onBackdropClick}
      />
      <div className="relative z-[70] flex w-full max-w-[335px] justify-center lg:max-w-[480px]">
        <DialogPanel dialog={dialog} onAction={onAction} />
      </div>
    </div>,
    document.body,
  );
}
