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
  fillClassName = "",
  appearance = "default",
}: {
  label: string;
  value: number;
  max: number;
  complete?: boolean;
  className?: string;
  /** Extra classes on the fill; the coach screens pass their one-time draw-in. */
  fillClassName?: string;
  /** Onboarding-style pill; other panel surfaces keep their compact line. */
  appearance?: "default" | "play";
}) {
  const percent = max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0;
  const play = appearance === "play";

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`overflow-hidden rounded-full bg-[var(--play-track)] ${play ? "h-3" : "h-2"} ${className}`}
    >
      <span
        className={`relative block h-full rounded-full transition-[width] motion-reduce:transition-none ${play ? "duration-300 ease-out" : "duration-500"} ${complete ? "bg-[var(--color-success)]" : "bg-[var(--play-cta)]"} ${fillClassName}`}
        style={{ width: `${percent}%` }}
      >
        {play ? (
          <span aria-hidden className="absolute inset-x-2 top-[3px] h-[3px] rounded-full bg-[var(--play-cta-shine)]" />
        ) : null}
      </span>
    </div>
  );
}
