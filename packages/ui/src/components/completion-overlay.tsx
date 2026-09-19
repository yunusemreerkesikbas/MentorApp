"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface CompletionOverlayProps {
  open: boolean;
  /** Accessible name for the dialog (localized at the call site). */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Full-viewport blur stage for a completion ritual.
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
    <div
      className="fixed inset-0 z-[54] flex items-center justify-center p-5"
      role="presentation"
    >
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
        className={`relative z-[1] max-h-[min(90dvh,44rem)] w-full overflow-y-auto outline-none ${className ?? ""}`}
      >
        <div className="flex justify-center py-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
