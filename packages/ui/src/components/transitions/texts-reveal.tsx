"use client";

import type * as React from "react";
import { useEffect, useState } from "react";

import { prefersReducedMotion } from "./motion-utils.js";

export interface TextsRevealProps {
  lines: React.ReactNode[];
  /** When true, play staggered entrance. */
  shown?: boolean;
  className?: string;
}

/**
 * Staggered blurred rise for stacked lines (headline + support).
 */
export function TextsReveal({ lines, shown = true, className }: TextsRevealProps) {
  const [visible, setVisible] = useState(() => prefersReducedMotion() && shown);

  useEffect(() => {
    if (!shown) {
      setVisible(false);
      return;
    }
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [shown]);

  return (
    <div
      className={`t-stagger${visible ? " is-shown" : ""}${!shown && visible === false ? " is-hiding" : ""}${className ? ` ${className}` : ""}`}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          className={`t-stagger-line t-stagger-line--${Math.min(i + 1, 3)}`}
        >
          {line}
        </span>
      ))}
    </div>
  );
}
