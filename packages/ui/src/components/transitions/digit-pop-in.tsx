"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { forceReflow, prefersReducedMotion } from "./motion-utils.js";

export interface DigitPopInProps {
  /** Display value — digits/punctuation get staggered pop-in on change. */
  value: string | number;
  className?: string;
  style?: React.CSSProperties;
}

function splitChars(value: string): string[] {
  return Array.from(value);
}

/**
 * Number pop-in — replays digit entrance when `value` changes.
 * Infrequent updates only (XP, days, goal minutes). Not for 1Hz timers.
 */
export function DigitPopIn({ value, className, style }: DigitPopInProps) {
  const text = String(value);
  const chars = splitChars(text);
  const groupRef = useRef<HTMLSpanElement>(null);
  const [animating, setAnimating] = useState(true);
  const prevRef = useRef(text);

  useEffect(() => {
    if (prevRef.current === text) return;
    prevRef.current = text;
    const el = groupRef.current;
    if (!el || prefersReducedMotion()) return;
    setAnimating(false);
    requestAnimationFrame(() => {
      forceReflow(el);
      setAnimating(true);
    });
  }, [text]);

  return (
    <span
      ref={groupRef}
      className={`t-digit-group${animating ? " is-animating" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {chars.map((ch, i) => (
        <span
          key={`${text}-${i}-${ch}`}
          className="t-digit"
          data-stagger={i > 0 ? Math.min(i, 5) : undefined}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
