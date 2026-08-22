import type { JourneyLevelKey } from "@mentor/types";

interface JourneyLevelMedallionProps {
  tier: number;
  levelKey: JourneyLevelKey;
  current?: boolean;
  future?: boolean;
  className?: string;
}

/** Numbered fallback used until the complete 12-piece SVG family passes its release gate. */
export function JourneyLevelMedallion({
  tier,
  levelKey,
  current = false,
  future = false,
  className = "size-24",
}: JourneyLevelMedallionProps) {
  return (
    <span
      data-journey-level-key={levelKey}
      aria-hidden="true"
      className={`relative inline-grid shrink-0 place-items-center ${className} ${future ? "opacity-45" : ""}`}
    >
      <svg viewBox="0 0 80 80" className="absolute inset-0 size-full">
        <path
          d="M40 3 70 20v40L40 77 10 60V20Z"
          fill={
            current
              ? "var(--color-progress)"
              : future
                ? "transparent"
                : "color-mix(in srgb, var(--color-progress-track) 55%, var(--color-btn))"
          }
          stroke={
            future
              ? "color-mix(in srgb, var(--color-btn-label) 72%, transparent)"
              : current
                ? "var(--color-progress-track)"
                : "var(--color-btn-label)"
          }
          strokeWidth={current ? "3" : "2"}
        />
        <path
          d="M40 10 64 24v32L40 70 16 56V24Z"
          fill="none"
          stroke="color-mix(in srgb, var(--color-btn-label) 45%, transparent)"
          strokeWidth="1"
        />
      </svg>
      <span
        className={`relative text-xl font-extrabold tabular-nums ${current ? "text-white" : "text-[var(--color-btn-label)]"}`}
      >
        {tier}
      </span>
    </span>
  );
}

