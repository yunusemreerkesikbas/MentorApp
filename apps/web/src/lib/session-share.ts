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

export interface ShareDaySession {
  id: string;
  status: string;
  startedAt: string;
  countsAsFocusSession?: boolean;
}

/**
 * Which counted session of the day this one was, 1-based, from today's list (any order). The
 * finished session counts even if the list has not caught up with it yet.
 */
export function shareSessionOrdinal(today: ShareDaySession[], sessionId: string | null): number {
  const counted = today.filter(
    (s) => s.status === "COMPLETED" && s.countsAsFocusSession !== false,
  );
  const self = counted.find((s) => s.id === sessionId);
  if (!self) return counted.length + 1;
  return counted.filter((s) => s.startedAt <= self.startedAt).length;
}
