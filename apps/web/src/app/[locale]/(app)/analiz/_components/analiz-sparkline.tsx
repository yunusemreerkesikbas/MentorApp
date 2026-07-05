"use client";

import type { MockExamTrendPointDto } from "@mentor/types";

interface AnalizSparklineProps {
  points: MockExamTrendPointDto[];
  /** Accessible label for the chart. */
  label: string;
  width?: number;
  height?: number;
}

/**
 * Minimal SVG sparkline — no chart library (DESIGN.md constraint).
 */
export function AnalizSparkline({
  points,
  label,
  width = 280,
  height = 72,
}: AnalizSparklineProps) {
  const padX = 8;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  if (points.length === 0) return null;

  const values = points.map((p) => Number(p.totalNet));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padX + innerW / 2
        : padX + (i / (points.length - 1)) * innerW;
    const y = padY + innerH - ((Number(p.totalNet) - min) / span) * innerH;
    return { x, y, id: p.id };
  });

  const polyline =
    coords.length > 1
      ? coords.map((c) => `${c.x},${c.y}`).join(" ")
      : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[72px] w-full max-w-full"
      role="img"
      aria-label={label}
    >
      {polyline ? (
        <polyline
          fill="none"
          stroke="var(--color-progress)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
      ) : null}
      {coords.map((c) => (
        <circle
          key={c.id}
          cx={c.x}
          cy={c.y}
          r={points.length === 1 ? 5 : 3.5}
          fill="var(--color-progress)"
        />
      ))}
    </svg>
  );
}
