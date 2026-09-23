/**
 * The panel's progress bar (DESIGN.md §6.1): 8px, full round, `--play-cta` on `--play-track`,
 * success when complete. The count belongs on the title line, never on the bar.
 */
export function ProgressLine({
  label,
  value,
  max,
  complete = false,
  className = "",
}: {
  label: string;
  value: number;
  max: number;
  complete?: boolean;
  className?: string;
}) {
  const percent = max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`h-2 overflow-hidden rounded-full bg-[var(--play-track)] ${className}`}
    >
      <span
        className={`block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${complete ? "bg-[var(--color-success)]" : "bg-[var(--play-cta)]"}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
