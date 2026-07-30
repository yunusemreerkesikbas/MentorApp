"use client";

import type * as React from "react";
import { MENTOR_SKELETON_SHIMMER_CLASS } from "./skeleton-classes.js";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Shimmer placeholder — animation only (`mentor-skeleton-shimmer`).
 * Size, radius, and layout are set per screen via `className`.
 */
export function Skeleton({ className, style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden
      {...rest}
      className={`${MENTOR_SKELETON_SHIMMER_CLASS} ${className ?? ""}`}
      style={style}
    />
  );
}

/** Stagger delay helper for row-by-row shimmer offset (ms). */
export function skeletonStaggerStyle(
  index: number,
  stepMs = 60,
): React.CSSProperties {
  return { animationDelay: `${index * stepMs}ms` };
}
