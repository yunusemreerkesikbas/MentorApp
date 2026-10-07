/**
 * Session share card: what it is allowed to say, decided purely. The sheet maps the parts to i18n
 * text and `session-share-card.ts` draws them. Effort only, never exam results (§4).
 */

export interface SessionShareParts {
  /** Whole focused minutes for the finished session. */
  minutes: number;
}

/**
 * Null → nothing worth sharing (the button stays hidden): under a minute, or a session that did
 * not count. A "kısa deneme" stays between the student and the app; no card leaves for it.
 */
export function resolveSessionShare(
  focusElapsedSeconds: number,
  countsAsFocusSession: boolean,
): SessionShareParts | null {
  const minutes = Math.floor(focusElapsedSeconds / 60);
  if (minutes <= 0 || !countsAsFocusSession) return null;
  return { minutes };
}

export type ShareDaypart = "morning" | "noon" | "afternoon" | "evening" | "night";

/** The part of the day a session ended in, by local hour, for the card's second line. */
export function shareDaypart(endedAt: Date): ShareDaypart {
  const hour = endedAt.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "noon";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}
