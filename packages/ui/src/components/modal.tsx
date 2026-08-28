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
}

/**
 * Form/content modal on the native `<dialog>` top layer (DESIGN.md §5–§6).
 * Distinct from `DialogProvider` confirm/promo overlays — those are a single
 * stacked prompt, not a form surface.
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
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);

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
      <header
        className="flex items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold leading-snug"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          disabled={closeDisabled}
          onClick={requestClose}
          aria-label={closeLabel}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors duration-150 hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          style={{ color: "var(--color-main)" }}
        >
          <X aria-hidden size={20} strokeWidth={2} />
        </button>
      </header>
      <div className="mentor-scrollarea flex flex-col gap-5 overflow-y-auto p-5">
        {children}
      </div>
      {footer ? (
        <footer
          className="flex justify-end gap-3 border-t p-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          {footer}
        </footer>
      ) : null}
    </>
  );

  const shellClass = `flex max-h-[90dvh] flex-col ${className ?? ""}`;

  return (
    <motion.dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={closing ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
      transition={{
        duration: reduceMotion ? 0 : closing ? 0.15 : 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
      onAnimationComplete={() => {
        if (closing) onClose();
      }}
      className="m-auto w-[min(92vw,32rem)] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-main)] shadow-[var(--shadow-card)] backdrop:bg-[color-mix(in_srgb,var(--color-main)_40%,transparent)]"
    >
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
