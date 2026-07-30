"use client";

import type * as React from "react";
import { MENTOR_SKELETON_ENTER_CLASS } from "./skeleton-classes.js";

export interface SkeletonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Screen-reader label while content loads. */
  label: string;
  /** Fade/slide-in on mount (`mentor-skeleton-enter` in theme.css). Default true. */
  entering?: boolean;
}

/**
 * Accessible wrapper for page-composed skeleton layouts.
 * Sets `role="status"` + `aria-busy`; enter motion is global, children are page-owned.
 */
export function SkeletonGroup({
  children,
  label,
  entering = true,
  className,
  ...rest
}: SkeletonGroupProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      {...rest}
      className={`${entering ? `${MENTOR_SKELETON_ENTER_CLASS} motion-reduce:animate-none` : ""} ${className ?? ""}`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}
