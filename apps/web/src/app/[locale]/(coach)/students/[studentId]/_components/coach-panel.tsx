"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CoachOverlay, CoachOverlayHeader } from "@/components/coach-overlay";

/**
 * The report's side panel, on the same overlay the coach calendar uses: a right-hand drawer on
 * desktop, a bottom sheet with a drag handle on phones.
 *
 * Render it inside `AnimatePresence`. It unmounts when it closes, so anything that has to survive a
 * close (the week's drafts) is held by the report shell, not by the form inside.
 */
export function CoachPanel({
  title,
  subtitle,
  busy,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  busy?: boolean;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const common = useTranslations("common");
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A panel names where focus starts with `data-autofocus` (the form's first field, the planner's
  // selected day); without one it lands on close. Never "the first input": in the planner that is
  // a checkbox at the far end of the panel, and focusing it scrolled the week out of view.
  useEffect(() => {
    const root = headingRef.current?.closest("[role='dialog']");
    const target = root?.querySelector<HTMLElement>("[data-autofocus]") ?? closeRef.current;
    target?.focus();
  }, []);

  return (
    <CoachOverlay
      variant="drawer"
      layer="form"
      grouped
      size={wide ? "wide" : "default"}
      labelledBy={titleId}
      busy={busy}
      onClose={onClose}
    >
      <CoachOverlayHeader>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 ref={headingRef} id={titleId} className="text-title font-extrabold leading-tight text-[var(--color-main)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{subtitle}</p>
          ) : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={common("close")}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-main)] outline-none hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed"
        >
          <X aria-hidden className="size-5.5" />
        </button>
      </CoachOverlayHeader>
      {children}
    </CoachOverlay>
  );
}
