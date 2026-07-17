/**
 * Session-summary share (Web Share / clipboard). Pure resolver — the component
 * maps the parts to i18n text. Effort only, never exam results (§4).
 */

export interface SessionShareParts {
  /** Whole focused minutes for the finished session. */
  minutes: number;
  /** Current streak to brag about; null when there is no streak yet. */
  streakDays: number | null;
}

/** Null → nothing worth sharing (the button stays hidden). */
export function resolveSessionShare(
  focusElapsedSeconds: number,
  currentStreak: number | null,
): SessionShareParts | null {
  const minutes = Math.floor(focusElapsedSeconds / 60);
  if (minutes <= 0) return null;
  return {
    minutes,
    streakDays: currentStreak != null && currentStreak > 0 ? currentStreak : null,
  };
}
