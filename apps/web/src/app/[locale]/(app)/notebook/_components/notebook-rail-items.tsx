"use client";

import type { ReactNode } from "react";
import { ChevronsDownUp, ListFilter, PanelTop, Pen, Plus, Smile } from "lucide-react";
import { motion } from "framer-motion";
import { boardChromeTransition } from "../../vision-board/board/_components/board-chrome-motion";
import { NOTEBOOK_TRAY_RADIUS_CLASS } from "./notebook-shell-layout";
import type { NotebookPanelCategory } from "./notebook-side-panel";

/**
 * What the notebook's icon rail is made of. No shell state involved — the list is a constant and
 * the fill only needs to know whether motion is allowed.
 */

/** Rail buttons that open a category panel. "Not" is a quick action, not a category — it is inlined
 *  in the rail's JSX rather than listed here, so it has no panel body to switch to. */
export const RAIL_CATEGORIES: {
  id: NotebookPanelCategory;
  icon: typeof Plus;
  labelKey:
    | "sidebar_add"
    | "sidebar_index"
    | "sidebar_sticker"
    | "edit_paper"
    | "sidebar_draw";
}[] = [
  { id: "add", icon: Plus, labelKey: "sidebar_add" },
  { id: "index", icon: ListFilter, labelKey: "sidebar_index" },
  { id: "sticker", icon: Smile, labelKey: "sidebar_sticker" },
  { id: "paper", icon: PanelTop, labelKey: "edit_paper" },
  // "draw" has no panel body of its own — its controls are the tray over the notebook. It is
  // still a category rather than an action like "Not", because it is a *mode*: while it is on,
  // the pages stop being arrangeable and start taking ink.
  { id: "draw", icon: Pen, labelKey: "sidebar_draw" },
];

/**
 * Shared active fill for the notebook rail. `layoutId` morphs the pill between neighbours the
 * same way the vision board's editor nav does; reduced-motion skips the travel and snaps.
 * Only one rail item may own it at a time — overlapping fills (e.g. "Not" while another
 * category panel is open) would give Framer two elements with the same id.
 */
export function NotebookRailActiveFill({
  reduceMotion,
}: {
  reduceMotion: boolean | null;
}) {
  if (reduceMotion) {
    return (
      <span
        aria-hidden
        className="absolute inset-0 rounded-[var(--radius-card)]"
        style={{ backgroundColor: "var(--color-btn)" }}
      />
    );
  }
  return (
    <motion.span
      layoutId="notebook-rail-active"
      aria-hidden
      className="absolute inset-0 rounded-[var(--radius-card)]"
      style={{ backgroundColor: "var(--color-btn)" }}
      transition={boardChromeTransition}
    />
  );
}

/**
 * Mobile page-tool rail. Collapsed it is the ink tray's pen circle; tap grows the pill to full
 * width (clip-reveal, not scale) so the icon row slides out of the circle instead of popping.
 */
export function NotebookMobileToolRail({
  open,
  reduceMotion,
  navLabel,
  showLabel,
  hideLabel,
  onOpen,
  onClose,
  children,
}: {
  open: boolean;
  reduceMotion: boolean | null;
  navLabel: string;
  showLabel: string;
  hideLabel: string;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const trayStyle = {
    backgroundColor: "var(--color-surface)",
    borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
    boxShadow: "var(--shadow-card)",
  } as const;

  return (
    <div className="w-full min-w-0 [container-type:inline-size]">
      <motion.nav
        aria-label={navLabel}
        initial={false}
        animate={{
          width: open ? "100%" : "2.75rem",
          height: open ? "auto" : "2.75rem",
        }}
        transition={reduceMotion ? { duration: 0 } : boardChromeTransition}
        className={`relative overflow-hidden border ${NOTEBOOK_TRAY_RADIUS_CLASS}`}
        style={trayStyle}
      >
        <div
          inert={!open}
          aria-hidden={!open}
          className="flex w-[100cqw] max-w-[100cqw] items-center px-1 py-0.5"
        >
          {children}
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={hideLabel}
            onClick={onClose}
            className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <ChevronsDownUp aria-hidden size={18} />
          </button>
        </div>
        <motion.button
          type="button"
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          aria-label={showLabel}
          onClick={onOpen}
          initial={false}
          animate={{ opacity: open ? 0 : 1 }}
          transition={reduceMotion ? { duration: 0 } : boardChromeTransition}
          className="absolute top-0 left-0 z-[1] inline-flex size-11 cursor-pointer items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: "var(--color-main)",
            backgroundColor: "var(--color-surface)",
            pointerEvents: open ? "none" : "auto",
          }}
        >
          <Pen aria-hidden size={18} />
        </motion.button>
      </motion.nav>
    </div>
  );
}
