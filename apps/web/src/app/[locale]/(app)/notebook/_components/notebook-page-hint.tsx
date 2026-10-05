"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Side } from "./notebook-shell-layout";

/**
 * Which page something will land on.
 *
 * `target` is the quiet one: with a panel open on a wide screen, the page "Ekle", a sticker or a
 * note goes to wears a faint outline, so the student never has to guess, and tapping the other page
 * moves it. `drop` is the loud one, shown while something is held over a page: let go here and it
 * lands here.
 *
 * Drawn over the page as an inset ring rather than as a border on the paper, so it never shifts the
 * page by a pixel, and it takes no pointers, so the page underneath stays fully usable.
 */
export function NotebookPageHint({
  mode,
  reduceMotion,
}: {
  mode: "target" | "drop" | null;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {mode ? (
        <motion.div
          key={mode}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          style={{
            zIndex: 1,
            boxShadow:
              mode === "drop"
                ? "inset 0 0 0 3px color-mix(in srgb, var(--color-accent) 70%, transparent)"
                : "inset 0 0 0 3px color-mix(in srgb, var(--color-accent) 50%, transparent)",
            backgroundColor:
              mode === "drop"
                ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                : "transparent",
          }}
        />
      ) : null}
    </AnimatePresence>
  );
}

/**
 * A phone's stand-in for the facing page: one leaf is on screen, so the edge an item is dragged to
 * lights up and says what letting go there does.
 */
export function NotebookEdgeHint({
  toward,
  label,
  reduceMotion,
}: {
  /** The leaf the item would move to; the strip sits on that edge. */
  toward: Side | null;
  label: string;
  reduceMotion: boolean;
}) {
  const Chevron = toward === "right" ? ChevronRight : ChevronLeft;
  return (
    <AnimatePresence>
      {toward ? (
        <motion.div
          key={toward}
          role="status"
          className="pointer-events-none absolute inset-y-0 flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          style={{
            zIndex: 2,
            [toward]: 0,
            flexDirection: toward === "right" ? "row-reverse" : "row",
          }}
        >
          <div
            className="h-full w-3"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--color-accent) 55%, transparent)",
            }}
          />
          <div
            className="mx-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              color: "var(--color-main)",
              backgroundColor: "var(--color-surface)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {toward === "left" ? <Chevron aria-hidden size={14} /> : null}
            {label}
            {toward === "right" ? <Chevron aria-hidden size={14} /> : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
