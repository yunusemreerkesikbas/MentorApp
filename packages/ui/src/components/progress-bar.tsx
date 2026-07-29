"use client";

export interface ProgressBarProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  className?: string;
}

/** Progress (DESIGN.md §6, nodes 15:1163/15:1164): track #C3D9FD, fill #55ACEE, h3 r3. */
export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-[3px] w-full rounded-[3px] ${className ?? ""}`}
      style={{ backgroundColor: "var(--color-progress-track)" }}
    >
      <div
        className="h-full rounded-[3px] transition-[width]"
        style={{
          width: `${clamped}%`,
          backgroundColor: "var(--color-progress)",
        }}
      />
    </div>
  );
}
