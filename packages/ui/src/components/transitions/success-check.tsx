"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";

export interface SuccessCheckProps {
  /** Cold load `out`; set `in` to play appear + stroke draw. */
  state?: "out" | "in";
  className?: string;
  style?: React.CSSProperties;
  /** Optional custom SVG; default is a checkmark path. */
  children?: React.ReactNode;
  size?: number;
  stroke?: string;
}

const DEFAULT_PATH = "M14 24 L22 32 L36 16";

/**
 * Success check appear — fade + rotate + blur + Y-bob + path stroke-draw.
 */
export function SuccessCheck({
  state = "out",
  className,
  style,
  children,
  size = 48,
  stroke = "var(--color-success)",
}: SuccessCheckProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const path = wrap.querySelector("path");
    if (!path || !(path instanceof SVGPathElement)) return;
    const len = Math.ceil(path.getTotalLength()) + 1;
    path.style.setProperty("--check-len", String(len));
    path.style.strokeDasharray = String(len);
    if (state === "out") {
      path.style.strokeDashoffset = String(len);
    }
  }, [state, children]);

  return (
    <span
      ref={wrapRef}
      className={`t-success-check${className ? ` ${className}` : ""}`}
      data-state={state}
      style={style}
      aria-hidden
    >
      {children ?? (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <path
            d={DEFAULT_PATH}
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
