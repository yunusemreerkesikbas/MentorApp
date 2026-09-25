"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

/**
 * Puhu speaking in a bubble (DESIGN.md §1 rule 4, §6.1): one line, first person. An AI-written line
 * carries its provenance label; a rule-based line passes none and never pretends to be AI.
 */
export function CompanionBubble({
  puhu,
  text,
  aiLabel = null,
  busy = false,
  children,
}: {
  puhu: PuhuVariant;
  text: string;
  aiLabel?: string | null;
  /** The AI line is still being written; `text` is the waiting line. */
  busy?: boolean;
  /** Under the line: a free user's lock nudge. */
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <PuhuImage variant={puhu} size={72} className="shrink-0" />
      <div
        aria-busy={busy || undefined}
        className={`min-w-0 flex-1 rounded-[var(--play-radius)] px-4 py-3 ${aiLabel ? "bg-[color-mix(in_srgb,var(--premium-ring-from)_10%,var(--color-surface))]" : "bg-[var(--play-selected)]"}`}
      >
        {aiLabel ? (
          <span className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-[var(--play-selected-ink)]">
            <Sparkles
              className="size-3.5 fill-current text-[var(--premium-ring-from)]"
              aria-hidden
            />
            {aiLabel}
          </span>
        ) : null}
        {busy ? (
          <p className="text-body-sm font-semibold leading-6 text-[var(--color-secondary)]">
            {text}
          </p>
        ) : (
          <ExpandableNote text={text} />
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Long notes fold to three lines behind "Daha fazla göster". A note only one line longer shows
 * whole: the toggle would take more room than the line it hides.
 */
function ExpandableNote({ text }: { text: string }) {
  // `common`, not `panel`: the coach routes load a narrower message scope without `panel`.
  const t = useTranslations("common");
  const reduceMotion = useReducedMotion();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<{ line: number; full: number } | null>(null);

  // Collapse when the note changes — adjust during render, not in an effect.
  const [renderedText, setRenderedText] = useState(text);
  if (renderedText !== text) {
    setRenderedText(text);
    setExpanded(false);
  }

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 24;
    setHeights({ line, full: el.scrollHeight });
  }, [text]);

  const needsToggle = heights != null && heights.full > heights.line * 4 + 1;

  return (
    <div>
      <motion.div
        initial={false}
        animate={{
          height: needsToggle ? (expanded ? heights.full : Math.round(heights.line * 3)) : "auto",
        }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
        }
        className="relative overflow-hidden"
      >
        <p
          ref={textRef}
          className="text-body-sm font-semibold leading-6 text-[var(--color-body)]"
        >
          {text}
        </p>
      </motion.div>
      {needsToggle ? (
        <button
          type="button"
          className="mt-1 min-h-9 text-sm font-bold text-[var(--color-main)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("show_less") : t("show_more")}
        </button>
      ) : null}
    </div>
  );
}
