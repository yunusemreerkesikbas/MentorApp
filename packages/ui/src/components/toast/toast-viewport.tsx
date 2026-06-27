"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { ToastItem } from "./toast-item.js";
import type { ToastRecord } from "./types.js";

export interface ToastViewportProps {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
  renderLeading?: (variant: ToastRecord["variant"]) => ReactNode;
}

/**
 * Fixed toast stack viewport (Stitch 01 mobile / 07 desktop):
 * mobile top-center 335px, desktop top-right 380px, max 3 stacked.
 * Portaled to document.body so no ancestor transform/overflow can hide it.
 */
export function ToastViewport({
  toasts,
  onDismiss,
  renderLeading,
}: ToastViewportProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-12 z-[100] flex flex-col items-center px-5 lg:inset-x-auto lg:right-6 lg:top-6 lg:items-end lg:px-0"
    >
      <div className="flex w-full max-w-[335px] flex-col gap-3 lg:max-w-[380px]">
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            stackIndex={index}
            onDismiss={onDismiss}
            renderLeading={renderLeading}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
