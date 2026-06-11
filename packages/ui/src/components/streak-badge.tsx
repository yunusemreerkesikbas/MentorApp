import { Card } from "./card.js";

export interface StreakBadgeProps {
  /** Current streak in days (computed server-side from daily activity). */
  currentStreak: number;
  /** Remaining streak-freeze tokens this month (anti-shaming safety net). */
  freezeTokens?: number;
  className?: string;
}

/** Warm flame glyph in a soft amber disc — celebratory, not alarming (DESIGN.md §7). */
function FlameGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)]"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-star) 22%, transparent)" }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-star)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2c1 3-1.5 4.5-1.5 7A3.5 3.5 0 0 0 14 12c0-1 .5-2 .5-2 .8 1 2.5 2.6 2.5 5a5 5 0 1 1-10 0c0-3.5 4-5.5 5-13z" />
      </svg>
    </span>
  );
}

/**
 * Streak badge (DESIGN.md §9 "streak / progress"; AGENTS §0 anti-shaming tone).
 * A streak of 0 is framed as an invitation, never a failure. Freeze tokens are shown as
 * a reassuring safety net. Values are derived server-side (frontend standard — no logic here).
 */
export function StreakBadge({ currentStreak, freezeTokens, className }: StreakBadgeProps) {
  const hasStreak = currentStreak > 0;
  const title = hasStreak ? `${currentStreak} günlük seri` : "Serini bugün başlat";
  const subline = hasStreak
    ? "Harika gidiyorsun — devam et."
    : "Tek bir görev bile seriyi başlatır.";

  return (
    <Card className={className}>
      <div className="flex items-center gap-4">
        <FlameGlyph />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className="text-base font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {title}
          </span>
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {subline}
          </span>
          {typeof freezeTokens === "number" && freezeTokens > 0 ? (
            <span className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
              {freezeTokens} dondurma hakkın var — bir günü kaçırsan seri bozulmaz.
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
