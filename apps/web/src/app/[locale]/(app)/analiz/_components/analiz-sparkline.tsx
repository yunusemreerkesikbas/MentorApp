"use client";

interface SparklinePoint {
  id: string;
  totalNet: string;
}

interface AnalizSparklineProps {
  points: SparklinePoint[];
  label: string;
  width?: number;
  height?: number;
}

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

  const values = points.map((point) => Number(point.totalNet));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? padX + innerW / 2
        : padX + (index / (points.length - 1)) * innerW;
    const y = padY + innerH - ((Number(point.totalNet) - min) / span) * innerH;
    return { x, y, id: point.id };
  });

  const polyline =
    coords.length > 1
      ? coords.map((coordinate) => coordinate.x + "," + coordinate.y).join(" ")
      : null;
  const accessibleLabel = `${label}: ${points
    .map((point) => point.totalNet)
    .join(" → ")}`;

  return (
    <svg
      viewBox={["0", "0", width, height].join(" ")}
      className="h-[72px] w-full max-w-full"
      role="img"
      aria-label={accessibleLabel}
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
      {coords.map((coordinate) => (
        <circle
          key={coordinate.id}
          cx={coordinate.x}
          cy={coordinate.y}
          r={points.length === 1 ? 5 : 3.5}
          fill="var(--color-progress)"
        />
      ))}
    </svg>
  );
}

