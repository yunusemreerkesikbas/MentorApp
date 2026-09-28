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
 * Portaled dialog overlay: solid scrim (no blur) z-60, 440px panel z-70.
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={closeLabel}
        className={`absolute inset-0 bg-[var(--color-scrim)] ${dialog.exiting ? "opacity-0" : "animate-dialog-backdrop-enter motion-reduce:animate-none"} transition-opacity duration-150 motion-reduce:transition-none`}
        onClick={onBackdropClick}
      />
      <div className="relative z-[70] flex w-full max-w-[440px] justify-center">
        <DialogPanel dialog={dialog} onAction={onAction} />
      </div>
    </div>,
    document.body,
  );
}
