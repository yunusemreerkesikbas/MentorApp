"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";

/**
 * Full-size preview for a mistake's photo. One image, no carousel — every card holds exactly one
 * photo, so the community gallery's swipe/arrow machinery would be solving a problem this screen
 * does not have.
 */
export function NotebookImageLightbox({
  entry,
  onClose,
}: {
  entry: NotebookEntryDto | null;
  onClose: () => void;
}) {
  const t = useTranslations("notebook");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!entry) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  return (
    <AnimatePresence>
      {entry?.url ? (
        <motion.div
          key="notebook-lightbox"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t(`error_type.${entry.errorType}`)}
        >
          <button
            type="button"
            aria-label={t("card_preview_close")}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <X aria-hidden size={20} />
          </button>

          <div
            className="relative h-[85vh] w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image src={entry.url} alt="" fill className="object-contain" unoptimized />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
