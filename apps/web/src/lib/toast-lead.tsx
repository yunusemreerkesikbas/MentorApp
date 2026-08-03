"use client";
import { CircleAlert } from "lucide-react";

import type { ReactNode } from "react";
import type { ToastVariant } from "@mentor/ui";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

/** Toast companion — `sm` (40px; DESIGN.md §8.2). */
const TOAST_PUHU_SIZE = "sm" as const;

/** Shared error circle icon for toast + confirm dialog. */
export function ErrorLeading() {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: "var(--color-error-container)" }}
    >
      <CircleAlert size={24} color="var(--color-danger)" strokeWidth={2} aria-hidden />
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
