"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Card } from "@mentor/ui";
import { useTranslations } from "next-intl";

export function CoachPlanFormPanel({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("coachPlan");
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
    )?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end p-3 sm:p-5"
      style={{ background: "color-mix(in srgb, var(--color-main) 45%, transparent)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-plan-form-title"
        className="h-full w-full max-w-xl overflow-y-auto focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") trapFocus(event, panelRef.current);
        }}
      >
        <Card className="min-h-full">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2
              id="coach-plan-form-title"
              className="text-xl font-semibold"
              style={{ color: "var(--color-main)" }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={t("form_close")}
              className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ color: "var(--color-main)" }}
            >
              <X aria-hidden size={22} />
            </button>
          </div>
          {children}
        </Card>
      </aside>
    </div>
  );
}

function trapFocus(
  event: KeyboardEvent,
  panel: HTMLElement | null,
): void {
  if (!panel) return;
  const focusable = [...panel.querySelectorAll<HTMLElement>(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]",
  )];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
