"use client";

import type * as React from "react";

export interface ShimmerTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "p" | "strong";
}

/**
 * Pure CSS shimmer band across muted status text (AI thinking lines).
 */
export function ShimmerText({
  text,
  className,
  style,
  as: Tag = "span",
}: ShimmerTextProps) {
  return (
    <Tag
      className={`t-shimmer${className ? ` ${className}` : ""}`}
      data-text={text}
      style={style}
    >
      {text}
    </Tag>
  );
}
