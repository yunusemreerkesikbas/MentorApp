"use client";

import type { ReactNode } from "react";
import type { ToastVariant } from "@mentor/ui";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

const TOAST_PUHU_SIZE = 40;

/** Shared error circle icon for toast + confirm dialog. */
export function ErrorLeading() {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: "var(--color-error-container)" }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-danger)"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    </div>
  );
}

/** Maps toast variant → Puhu mascot or error icon (Stitch Prompt 01 / 13). */
export function getToastLeading(variant: ToastVariant): ReactNode {
  switch (variant) {
    case "success":
      return <PuhuImage variant="happy" size={TOAST_PUHU_SIZE} />;
    case "coach":
      return <PuhuImage variant="encouraging" size={TOAST_PUHU_SIZE} />;
    case "info":
      return <PuhuImage variant="surprised" size={TOAST_PUHU_SIZE} />;
    case "error":
      return <ErrorLeading />;
    default:
      return <PuhuImage variant="default" size={TOAST_PUHU_SIZE} />;
  }
}

/** Explicit Puhu variant for a toast (use when variant default is not enough). */
export function getPuhuToastLeading(variant: PuhuVariant): ReactNode {
  return <PuhuImage variant={variant} size={TOAST_PUHU_SIZE} />;
}
