"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The one overlay every short room flow uses — create, join, invite, theme. Bottom sheet on
 * phones, centred dialog from `sm` up, because a thumb reaches the bottom of a screen and a
 * cursor does not.
 *
 * Escape closes and body scroll locks while open; the surrounding page is a stage you should
 * not be able to scroll behind a modal.
 */
export function RoomSheet({
  open,
  onClose,
  title,
  children,
  /** Rendered edge-to-edge above the title — used for the theme preview. */
  banner,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const t = useTranslations("session_room");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label={t("cancel")}
            className="absolute inset-0 cursor-default"
            style={{ backgroundColor: "color-mix(in srgb, #000 48%, transparent)" }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-md overflow-hidden rounded-t-[1.5rem] shadow-[var(--shadow-card-hover)] sm:m-4 sm:rounded-[1.25rem]"
            style={{ backgroundColor: "var(--color-surface)" }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {banner}
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <h2
                className="text-base font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h2>
              <button
                type="button"
                aria-label={t("cancel")}
                onClick={onClose}
                className="-mr-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] motion-reduce:transition-none"
                style={{ color: "var(--color-secondary)" }}
              >
                <X className="size-4" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            <div className="px-5 pb-5 pt-3">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
