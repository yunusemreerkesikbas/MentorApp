"use client";

/** Nuton-style dash bullets — active 25px main, inactive 10px secondary. */
export function DashProgress({
  step,
  total,
  ariaLabel,
}: {
  step: number;
  total: number;
  ariaLabel: string;
}) {
  const current = step + 1;

  return (
    <div
      className="flex justify-center gap-2.5 py-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={ariaLabel}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-0.5 rounded-md transition-all motion-reduce:transition-none"
          style={{
            width: i === step ? 25 : 10,
            backgroundColor:
              i === step ? "var(--color-main)" : "var(--color-secondary)",
          }}
        />
      ))}
    </div>
  );
}
