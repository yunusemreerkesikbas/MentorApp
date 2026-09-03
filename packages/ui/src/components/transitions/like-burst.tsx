"use client";

import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { prefersReducedMotion } from "./motion-utils.js";

export interface LikeBurstProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  liked: boolean;
  /** Increment to fire particle burst (typically on like-on). */
  burstKey?: number;
  children?: React.ReactNode;
}

const PARTICLE_COUNT = 8;

function particleStyle(i: number): React.CSSProperties {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 2) * 0.2;
  const dist = 14 + (i % 3) * 4;
  return {
    ["--px" as string]: `${Math.cos(angle) * dist}px`,
    ["--py" as string]: `${Math.sin(angle) * dist}px`,
    ["--pdur" as string]: `${500 + (i % 3) * 80}ms`,
    ["--pdelay" as string]: `${i * 20}ms`,
    ["--p-end-scale" as string]: `${0.4 + (i % 3) * 0.1}`,
    ["--psize" as string]: `${0.8 + (i % 2) * 0.4}`,
  };
}

const DEFAULT_HEART = (
  <svg className="t-like-heart" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 21s-6.7-4.35-9.33-7.4C.8 11.4.5 8.5 2.3 6.5 4 4.6 6.9 4.4 9 6.1L12 8.7l3-2.6c2.1-1.7 5-1.5 6.7.4 1.8 2 1.5 4.9-.37 7.1C18.7 16.65 12 21 12 21z"
      strokeWidth="1.6"
    />
  </svg>
);

/**
 * Like heart fill + optional particle burst. Wrap icon in `.t-like-icon` for crisp pop.
 */
export function LikeBurst({
  liked,
  burstKey = 0,
  className,
  children,
  ...rest
}: LikeBurstProps) {
  const [bursting, setBursting] = useState(false);
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => particleStyle(i)),
    [],
  );

  useEffect(() => {
    if (burstKey <= 0 || prefersReducedMotion()) return;
    setBursting(true);
    const t = window.setTimeout(() => setBursting(false), 700);
    return () => window.clearTimeout(t);
  }, [burstKey]);

  return (
    <button
      type="button"
      className={`t-like${bursting ? " is-bursting" : ""}${className ? ` ${className}` : ""}`}
      data-liked={liked ? "true" : "false"}
      aria-pressed={liked}
      {...rest}
    >
      <span className="t-like-icon relative inline-flex">{children ?? DEFAULT_HEART}</span>
      <span className="t-like-particles" aria-hidden>
        {particles.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </span>
    </button>
  );
}
