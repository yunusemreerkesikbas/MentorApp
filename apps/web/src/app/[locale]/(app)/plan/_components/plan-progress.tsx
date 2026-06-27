"use client";

/** Plan page progress — 8px track (Stitch mock), DESIGN.md token colors. */
export function PlanProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 w-full overflow-hidden rounded-full ${className ?? ""}`}
      style={{ backgroundColor: "var(--color-progress-track)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{
          width: `${clamped}%`,
          backgroundColor: "var(--color-progress)",
        }}
      />
    </div>
  );
}
