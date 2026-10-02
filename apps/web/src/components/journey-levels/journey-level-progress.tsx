import type { CommunityLevelProgress } from "@mentor/types";

interface JourneyLevelProgressBarProps {
  progress: CommunityLevelProgress;
  ariaLabel: string;
  ariaValueText: string;
  className?: string;
  appearance?: "default" | "play";
}

export function JourneyLevelProgressBar({
  progress,
  ariaLabel,
  ariaValueText,
  className = "mt-2",
  appearance = "default",
}: JourneyLevelProgressBarProps) {
  const play = appearance === "play";
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={progress.target}
      aria-valuenow={progress.current}
      aria-valuetext={ariaValueText}
      className={`${className} overflow-hidden rounded-full ${play ? "h-3 bg-[var(--play-track)]" : "h-1.5 bg-[var(--color-progress-track)]"}`}
    >
      <span
        className={`relative block h-full rounded-full transition-[width] motion-reduce:transition-none ${play ? "bg-[var(--play-cta)] duration-300 ease-out" : "bg-[var(--color-progress)]"}`}
        style={{ width: `${progress.percent}%` }}
      >
        {play ? (
          <span aria-hidden className="absolute inset-x-2 top-[3px] h-[3px] rounded-full bg-[var(--play-cta-shine)]" />
        ) : null}
      </span>
    </div>
  );
}
