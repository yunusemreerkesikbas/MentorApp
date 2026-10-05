"use client";

import type { ReactNode } from "react";

/**
 * Every control under the card: the two verdicts and the two arrows that move past one.
 *
 * One component because the four are one row and have to line up — same ring, same disabled
 * treatment, same tooltip — and three near-identical button bodies is how a row drifts out of
 * alignment on the next edit. What differs is only weight, which is the whole point: `solved` is a
 * filled disc, `missed` an outlined one the same size, and `ghost` is smaller and quieter, because
 * an arrow that looked like a verdict would invite walking the deck without grading a single card.
 *
 * ponytail: the tooltip is a sibling span on `group-hover` / `group-focus-visible`, not a floating
 * library. It has one placement (above), never flips, and lives inside a fixed dialog with room
 * over it — every reason to reach for a positioning engine is absent here. It is `aria-hidden`; the
 * accessible name is the `aria-label`, so the two never disagree.
 */
export function DeckButton({
  label,
  caption,
  variant,
  disabled,
  onClick,
  children,
}: {
  label: string;
  /**
   * A visible word under a verdict. The glyphs alone were not enough: the "missed" one was a
   * counter-clockwise arrow, the same shape as "Soruya dön" on the card above it, and a verdict that
   * reads as "undo" is one nobody presses with confidence. Arrows have none; they get a 44px disc
   * dropped by half the verdict's height so their centres still line up.
   */
  caption?: string;
  variant: "solved" | "missed" | "ghost";
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const verdict = variant !== "ghost";
  const style =
    variant === "solved"
      ? {
          // Same inversion the card's swipe cue handles: the success green flips between themes,
          // so the glyph on top of it takes the button label colour rather than a literal white.
          backgroundColor: "var(--color-success)",
          color: "var(--color-btn-label)",
          border: "1px solid transparent",
          boxShadow:
            "0 8px 24px color-mix(in srgb, var(--color-success) 35%, transparent)",
        }
      : variant === "missed"
        ? {
            // Outlined and never red. Missing a card costs a shorter interval, not a scolding —
            // the same reasoning as the swipe cue it mirrors.
            backgroundColor: "rgba(255,255,255,0.10)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.45)",
          }
        : {
            backgroundColor: "rgba(255,255,255,0.12)",
            color: "#ffffff",
            border: "1px solid transparent",
          };

  return (
    <div
      className={`group relative flex flex-col items-center gap-1.5 ${
        verdict ? "" : "mt-2"
      }`}
    >
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`flex ${
          verdict ? "size-[60px]" : "size-11"
        } shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100`}
        style={style}
      >
        {children}
      </button>
      {caption ? (
        <span
          aria-hidden
          className={`text-xs font-semibold ${disabled ? "opacity-30" : ""}`}
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {caption}
        </span>
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
        style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff" }}
      >
        {label}
      </span>
    </div>
  );
}
