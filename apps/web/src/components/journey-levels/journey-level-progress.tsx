import type { CommunityLevelProgress } from "@mentor/types";

interface JourneyLevelProgressBarProps {
  progress: CommunityLevelProgress;
  ariaLabel: string;
  ariaValueText: string;
  className?: string;
}

export function JourneyLevelProgressBar({
  progress,
  ariaLabel,
  ariaValueText,
  className = "mt-2",
}: JourneyLevelProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={progress.target}
      aria-valuenow={progress.current}
      aria-valuetext={ariaValueText}
      className={`${className} h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]`}
    >
      <span
        className="block h-full rounded-full bg-[var(--color-progress)] transition-[width] motion-reduce:transition-none"
        style={{ width: `${progress.percent}%` }}
      />
    </div>
  );
}

