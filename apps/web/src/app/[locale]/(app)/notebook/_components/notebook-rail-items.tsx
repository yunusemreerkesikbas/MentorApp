"use client";

import { ListFilter, PanelTop, Pen, Plus, Smile } from "lucide-react";
import { motion } from "framer-motion";
import { boardChromeTransition } from "../../vision-board/board/_components/board-chrome-motion";
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
