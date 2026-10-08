"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * The profile photo, full size, over a dark scrim. Escape, the close button or a click outside
 * the photo closes it; focus goes back to whatever opened it (`onClosed`).
 */
export function ProfilePhotoPreview({
  open,
  src,
  name,
  onClose,
  onClosed,
}: {
  open: boolean;
  src: string;
  name: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const t = useTranslations("community");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  return createPortal(
    <AnimatePresence onExitComplete={onClosed} initial={!reduceMotion}>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t("profile_photo_preview_label", { name })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.25, 1, 0.5, 1] }}
          onClick={onClose}
        >
          <button
            type="button"
            aria-label={t("attach_close")}
            autoFocus
            onClick={onClose}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none sm:right-6 sm:top-6"
          >
            <X size={22} aria-hidden />
          </button>
          <motion.img
            src={src}
            alt={t("profile_photo_alt", { name })}
            className="max-h-full max-w-full object-contain"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.25, 1, 0.5, 1] }}
            onClick={(event) => event.stopPropagation()}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
