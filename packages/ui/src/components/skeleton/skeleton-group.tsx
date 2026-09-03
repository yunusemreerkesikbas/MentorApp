"use client";

import type * as React from "react";
import { MENTOR_SKELETON_ENTER_CLASS } from "./skeleton-classes.js";
import { SkeletonReveal } from "../transitions/skeleton-reveal.js";

export interface SkeletonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Screen-reader label while content loads. */
  label: string;
  /** Fade/slide-in on mount (`mentor-skeleton-enter` in theme.css). Default true. */
  entering?: boolean;
  /**
   * When set with `revealed`, swaps skeleton → content via SkeletonReveal
   * (cross-fade + blur). Grid stacking sizes from the taller layer.
   */
  loading?: boolean;
  revealed?: React.ReactNode;
}

/**
 * Accessible wrapper for page-composed skeleton layouts.
 * Sets `role="status"` + `aria-busy`; enter motion is global, children are page-owned.
 * Optional `loading` + `revealed` uses the shared SkeletonReveal transition.
 */
export function SkeletonGroup({
  children,
  label,
  entering = true,
  loading,
  revealed,
  className,
  style,
  ...rest
}: SkeletonGroupProps) {
  if (loading != null && revealed != null) {
    return (
      <div
        role="status"
        aria-busy={loading || undefined}
        aria-live="polite"
        aria-label={label}
        {...rest}
        className={className}
        style={style}
      >
        <SkeletonReveal loading={loading} skeleton={children}>
          {revealed}
        </SkeletonReveal>
        {loading ? <span className="sr-only">{label}</span> : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      {...rest}
      style={style}
      className={`${entering ? `${MENTOR_SKELETON_ENTER_CLASS} motion-reduce:animate-none` : ""} ${className ?? ""}`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}
