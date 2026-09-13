"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The report's side panel: the week planner, the note on a phone, and the follow-up history.
 *
 * Not a native `showModal()` dialog, on purpose. A top-layer modal leaves everything outside it
 * inert and underneath it, and the confirm dialog, the toasts and the popover menus all render from
 * root providers outside this subtree: "Şablonu sil" would open a confirm the coach cannot reach.
 * So this is an inline fixed drawer (`history-side-drawer.tsx`'s Esc and focus pattern) that stays
 * under those layers and, being inline, keeps inheriting the `.coach-theme` tokens.
 *
 * It stays mounted while closed, so a half-composed week survives closing the panel. `inert` and
 * `invisible` keep the closed content out of the tab order and the accessibility tree.
 */
export function CoachPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const common = useTranslations("common");
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The latest handler without re-running the open effect: a parent re-render while the panel is
  // open must not steal focus back to the first field.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.documentElement.classList.add("mentor-drawer-open");

    const frame = requestAnimationFrame(() => {
      const body = bodyRef.current;
      const target =
        body?.querySelector<HTMLElement>("[data-autofocus]") ??
        body?.querySelector<HTMLElement>(FOCUSABLE) ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });

    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("mentor-drawer-open");
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[var(--coach-scrim)] transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        // Visibility is transitioned on the way OUT only. Transitioning it on the way in keeps the
        // panel `hidden` for the first frame, and the focus call below silently misses it.
        className={`fixed inset-0 z-[41] flex flex-col bg-[var(--color-bg)] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:inset-y-2 sm:left-auto sm:right-2 sm:w-[min(35rem,calc(100vw-1rem))] sm:rounded-2xl sm:shadow-[var(--coach-panel-shadow)] ${
          open
            ? "visible translate-x-0 translate-y-0 transition-transform"
            : "invisible translate-y-full transition-[transform,visibility] sm:translate-x-[calc(100%+1rem)] sm:translate-y-0"
        }`}
      >
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="coach-title text-[var(--color-main)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="coach-footnote text-[var(--color-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={common("close")}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--color-surface-container)] text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <X aria-hidden size={18} strokeWidth={2.25} />
          </button>
        </header>
        <div ref={bodyRef} className="mentor-scrollarea flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </section>
    </>
  );
}
