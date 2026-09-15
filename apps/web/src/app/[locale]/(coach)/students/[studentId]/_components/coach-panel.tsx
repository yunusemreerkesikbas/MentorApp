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

  // A form can name its first field with `data-autofocus`; a panel without fields lands on close.
  useEffect(() => {
    const root = headingRef.current?.closest("[role='dialog']");
    const target =
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled])") ??
      closeRef.current;
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
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            ref={headingRef}
            id={titleId}
            className="text-xl font-semibold"
            style={{ color: "var(--color-main)" }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={common("close")}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed"
          style={{ color: "var(--color-main)" }}
        >
          <X aria-hidden size={22} />
        </button>
      </CoachOverlayHeader>
      {children}
    </CoachOverlay>
  );
}
