"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface CompletionOverlayProps {
  open: boolean;
  /** Accessible name for the dialog (localized at the call site). */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Full-viewport blur stage for a completion ritual.
 * Below `lg` the panel is the screen and scrolls itself. At `lg` a grid cell
 * centers the card; the card scrolls, the page does not.
 * Does not dismiss on backdrop or Escape. z-[54] sits above app chrome / FAB (z-30)
 * and below bottom sheet (55), dialog (60), streak (80), and toast (100).
 */
export function CompletionOverlay({
  open,
  label,
  children,
  className,
}: CompletionOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("mentor-dialog-open");
    return () => {
      document.documentElement.classList.remove("mentor-dialog-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[54] overflow-hidden" role="presentation">
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-md"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-main) 40%, transparent)",
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative z-[1] h-full min-h-0 w-full overflow-y-auto overscroll-contain outline-none lg:grid lg:place-items-center lg:overflow-hidden lg:p-5 ${className ?? ""}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
