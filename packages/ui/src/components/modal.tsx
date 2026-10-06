"use client";

import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type * as React from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";

export interface ModalProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Blocks X, Escape, and backdrop dismiss (in-flight save). */
  closeDisabled?: boolean;
  /** Focused after `showModal()` — typically the first field. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * When set, header + body + footer wrap in a `<form>`. Callers must
   * `preventDefault` in `onSubmit` (do not use `method="dialog"`).
   */
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  className?: string;
  /** Rendered edge to edge above the title, for a picture that is part of the choice. */
  banner?: React.ReactNode;
  /**
   * `sheet` docks to the bottom edge below `lg`, like the kit's bottom sheet, and stays a
   * centred dialog from `lg` up. `center` (default) is centred at every width.
   */
  placement?: "center" | "sheet";
  /** `wide` gives a two-column body room from `lg` (52rem); the default fits one column. */
  size?: "default" | "wide";
}

/** Where `placement="sheet"` turns into a bottom sheet (the kit bottom sheet's breakpoint). */
const SHEET_QUERY = "(max-width: 1023px)";

const SHEET_CLASS =
  "max-lg:mb-0 max-lg:mt-auto max-lg:w-full max-lg:max-w-none max-lg:rounded-b-none max-lg:rounded-t-[var(--play-sheet-radius)] max-lg:border-x-0 max-lg:border-b-0 max-lg:shadow-[var(--shadow-sheet)]";

/**
 * Form/content modal on the native `<dialog>` top layer (DESIGN.md §5–§6).
 * Distinct from `DialogProvider` confirm/promo overlays — those are a single
 * stacked prompt, not a form surface. A press that starts and ends on the scrim
 * closes it; one that starts inside (a text selection dragged out) does not.
 */
export function Modal({
  title,
  closeLabel,
  onClose,
  children,
  footer,
  closeDisabled,
  initialFocusRef,
  onSubmit,
  className,
  banner,
  placement = "center",
  size = "default",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressOnScrimRef = useRef(false);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const sheet = placement === "sheet";
  // Read once at open: a sheet slides up on a phone and scales in on a desktop. A resize
  // while it is open keeps the entrance it started with; the layout itself follows CSS.
  const [slides] = useState(
    () => sheet && typeof window !== "undefined" && window.matchMedia(SHEET_QUERY).matches,
  );
  const hidden = slides ? { opacity: 0, y: 48 } : { opacity: 0, scale: 0.96 };
  const shown = slides ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 };

  useLayoutEffect(() => {
    const node = dialogRef.current;
    if (!node || node.open) return;
    node.showModal();
    initialFocusRef?.current?.focus();
  }, [initialFocusRef]);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    requestClose();
  }

  function requestClose() {
    if (!closeDisabled && !closing) setClosing(true);
  }

  const chrome = (
    <>
      {banner}
      <header
        className={`flex items-center justify-between gap-3 border-b border-[var(--play-line)] pb-3 pl-6 pr-3 pt-4 ${sheet && !banner ? "max-lg:pt-6" : ""}`}
      >
        <h2 id={titleId} className="text-xl font-extrabold leading-snug text-[var(--color-main)]">
          {title}
        </h2>
        <button
          type="button"
          disabled={closeDisabled}
          onClick={requestClose}
          aria-label={closeLabel}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        >
          <X aria-hidden size={22} strokeWidth={1.75} />
        </button>
      </header>
      <div className="mentor-scrollarea flex flex-col gap-4 overflow-y-auto px-6 py-5">
        {children}
      </div>
      {footer ? (
        <footer className="flex items-center justify-end gap-[18px] border-t border-[var(--play-line)] px-6 py-4">
          {footer}
        </footer>
      ) : null}
    </>
  );

  const shellClass = `flex max-h-[90dvh] flex-col ${sheet ? "max-lg:pb-[env(safe-area-inset-bottom)]" : ""} ${className ?? ""}`;

  return (
    <motion.dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onPointerDown={(event) => {
        pressOnScrimRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressOnScrimRef.current && event.target === event.currentTarget) requestClose();
      }}
      initial={reduceMotion ? false : hidden}
      animate={closing ? hidden : shown}
      transition={{
        duration: reduceMotion ? 0 : closing ? 0.15 : slides ? 0.25 : 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
      onAnimationComplete={() => {
        if (closing) onClose();
      }}
      className={`m-auto w-[min(92vw,32.5rem)] rounded-[var(--play-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-main)] shadow-[var(--shadow-overlay)] backdrop:bg-[var(--color-scrim)] ${size === "wide" ? "lg:w-[min(92vw,52rem)]" : ""} ${sheet ? SHEET_CLASS : ""}`}
    >
      {sheet ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-2.5 z-10 h-[5px] w-10 -translate-x-1/2 rounded-full bg-[var(--play-line)] lg:hidden"
        />
      ) : null}
      {onSubmit ? (
        <form onSubmit={onSubmit} className={shellClass}>
          {chrome}
        </form>
      ) : (
        <div className={shellClass}>{chrome}</div>
      )}
    </motion.dialog>
  );
}
