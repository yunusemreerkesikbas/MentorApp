"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { COLOR_NAMES } from "./board-palettes";

/**
 * One color dot, shared by the side panel's inline rows and the full color panel.
 *
 * Small color dots alone don't say what they are; naming them only in `aria-label` leaves sighted
 * mouse/touch users guessing. Clicking (which also focuses the button) surfaces the name as a
 * label until focus moves on — no separate state to wire from the caller.
 */

export interface SwatchProps {
  color: string;
  label: string;
  active?: boolean;
  /** "lg" for the full-screen color panel's bigger touch targets; "sm" for inline rows. */
  size?: "sm" | "lg";
  onClick: () => void;
}

export function Swatch({ color, label, active, size = "sm", onClick }: SwatchProps) {
  const t = useTranslations("vision.board");
  const [showName, setShowName] = useState(false);
  const nameKey = COLOR_NAMES[color.toLowerCase()];
  const name = nameKey ? t(`color_name_${nameKey}`) : color;
  const hit = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const dot = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <button
      type="button"
      aria-label={`${label}: ${name}`}
      aria-pressed={active}
      onClick={() => {
        onClick();
        setShowName(true);
      }}
      onBlur={() => setShowName(false)}
      className={`relative grid ${hit} shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]`}
    >
      <span
        className={`block ${dot} rounded-full`}
        style={{
          backgroundColor: color,
          outline: active ? "2px solid var(--color-accent)" : "1px solid var(--color-border)",
          outlineOffset: "2px",
        }}
      />
      {showName ? (
        <span
          className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: "var(--color-btn)",
            color: "var(--color-btn-label)",
          }}
        >
          {name}
        </span>
      ) : null}
    </button>
  );
}
