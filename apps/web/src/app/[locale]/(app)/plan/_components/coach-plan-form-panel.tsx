"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CoachPlanOverlay, CoachPlanOverlayBody } from "./coach-plan-overlay";

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
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = headingRef.current?.closest("[role='dialog']");
    root?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
    )?.focus();
  }, []);

  return (
    <CoachPlanOverlay
      variant="drawer"
      layer="form"
      labelledBy="coach-plan-form-title"
      busy={busy}
      onClose={onClose}
    >
      <CoachPlanOverlayBody>
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2
            ref={headingRef}
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
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed"
            style={{ color: "var(--color-main)" }}
          >
            <X aria-hidden size={22} />
          </button>
        </div>
        {children}
      </CoachPlanOverlayBody>
    </CoachPlanOverlay>
  );
}
