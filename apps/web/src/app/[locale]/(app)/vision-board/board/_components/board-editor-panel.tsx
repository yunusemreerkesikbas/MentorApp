"use client";

import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { boardChromeFastTransition, boardChromeTransition } from "./board-chrome-motion";
import { BOARD_CHROME_Z } from "./board-editor-rail";

/**
 * The panel a rail category opens. From `lg` it floats beside the rail, as in the notebook; below
 * it is a sheet that rises behind the dock. It is never modal: the board stays arrangeable while a
 * frame or a colour is tried on.
 */
export function BoardEditorPanel({
  open,
  title,
  bodyKey,
  reduceMotion,
  onCollapse,
  children,
}: {
  open: boolean;
  title: string;
  /** Changes when the body does, so the swap fades rather than cuts. */
  bodyKey: string;
  reduceMotion: boolean | null;
  onCollapse: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("vision.board");

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          key="board-detail-panel"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={boardChromeTransition}
          /*
            The bottom padding below `lg` is the dock's own height and margin: the sheet runs to
            the screen's edge behind it, so the two read as one surface.
          */
          className="absolute inset-x-0 bottom-0 flex max-h-[50dvh] min-h-0 flex-col rounded-t-[var(--play-sheet-radius)] bg-[var(--color-surface)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-sheet)] lg:inset-x-auto lg:bottom-2 lg:left-[5.5rem] lg:top-2 lg:max-h-none lg:w-80 lg:rounded-[var(--radius-card)] lg:border lg:border-[color-mix(in_srgb,var(--color-main)_10%,transparent)] lg:pb-0 lg:shadow-[var(--shadow-card)]"
          style={{ zIndex: BOARD_CHROME_Z.panel }}
        >
          <span
            aria-hidden
            className="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-full bg-[var(--play-line)] lg:hidden"
          />
          <div className="flex shrink-0 items-center justify-between gap-2 pe-2 ps-5 lg:py-2 lg:ps-4">
            <h2 className="truncate text-base font-bold text-[var(--color-main)]">{title}</h2>
            <button
              type="button"
              aria-label={t("collapse_panel")}
              onClick={onCollapse}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-secondary)] outline-none transition-colors hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            >
              <ChevronLeft aria-hidden size={18} className="hidden lg:block" />
              <X aria-hidden size={18} className="lg:hidden" />
            </button>
          </div>
          {/* The one scroller: the sheet's height is a ceiling, not a number, so a body that
              scrolled itself would have nothing to measure against. */}
          <div className="mentor-scrollarea min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={bodyKey}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={boardChromeFastTransition}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
