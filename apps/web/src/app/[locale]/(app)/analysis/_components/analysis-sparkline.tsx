"use client";

type SparklineTone = "up" | "down" | "neutral";

interface SparklinePoint {
  id: string;
  totalNet: string;
}

interface AnalysisSparklineProps {
  points: SparklinePoint[];
  label: string;
  width?: number;
  height?: number;
  className?: string;
  /** Trend tone — colors line + area fill (DESIGN tokens). */
  tone?: SparklineTone;
  /** Soft area fill under the line (reference KPI cards). */
  withFill?: boolean;
}

const TONE_STROKE: Record<SparklineTone, string> = {
  up: "var(--color-success)",
  down: "var(--color-danger)",
  neutral: "var(--color-progress)",
};

export function AnalysisSparkline({
  points,
  label,
  width = 280,
  height = 72,
  className = "h-[72px] w-full max-w-full",
  tone = "neutral",
  withFill = false,
}: AnalysisSparklineProps) {
  const padX = 8;
  const padY = 10;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stroke = TONE_STROKE[tone];
  const gradientId = `analysis-spark-fill-${tone}`;

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

  const areaPath =
    withFill && coords.length > 1
      ? [
          `M ${coords[0]!.x} ${padY + innerH}`,
          ...coords.map((c) => `L ${c.x} ${c.y}`),
          `L ${coords[coords.length - 1]!.x} ${padY + innerH}`,
          "Z",
        ].join(" ")
      : null;

  const accessibleLabel = `${label}: ${points
    .map((point) => point.totalNet)
    .join(" → ")}`;

  return (
    <svg
      viewBox={["0", "0", width, height].join(" ")}
      className={className}
      role="img"
      aria-label={accessibleLabel}
    >
      {withFill ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      ) : null}
      {areaPath ? (
        <path d={areaPath} fill={`url(#${gradientId})`} />
      ) : null}
      {polyline ? (
        <polyline
          fill="none"
          stroke={stroke}
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
          fill={stroke}
        />
      ))}
    </svg>
  );
}
