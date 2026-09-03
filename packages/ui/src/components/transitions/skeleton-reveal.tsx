"use client";

import type * as React from "react";
import { useEffect, useState } from "react";

export interface SkeletonRevealProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Optional size hint; grid stacking usually sizes from content. */
  style?: React.CSSProperties;
}

/**
 * Skeleton → content cross-fade + blur reveal.
 * Delays `.is-revealed` one frame after `loading` clears so content mounts at opacity 0 first.
 */
export function SkeletonReveal({
  loading,
  skeleton,
  children,
  className,
  style,
}: SkeletonRevealProps) {
  const [shown, setShown] = useState(() => !loading);

  useEffect(() => {
    if (loading) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  return (
    <div
      className={`t-skel${shown ? " is-revealed" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      aria-busy={loading || undefined}
    >
      <div className={`t-skel-skeleton${loading || !shown ? " is-pulsing" : ""}`}>{skeleton}</div>
      <div className="t-skel-content">{children}</div>
    </div>
  );
}
