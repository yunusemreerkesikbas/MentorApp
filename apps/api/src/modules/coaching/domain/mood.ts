/**
 * Pure mood → encouragement mapping (rule-based, NO AI — guardrail §4 #5).
 *
 * Maps a 1..5 mood to a stable bucket. The bucket yields:
 *  - `code`: a stable machine code the client may branch on,
 *  - `i18nKey`: the i18n key whose value is the backend-localized message (resolved in the service).
 * Copy itself lives in the locale files (`coaching.mood.*`), never hardcoded here.
 */

export const MoodLevel = {
  VERY_LOW: "VERY_LOW",
  LOW: "LOW",
  OKAY: "OKAY",
  GOOD: "GOOD",
  GREAT: "GREAT",
} as const;
export type MoodLevel = (typeof MoodLevel)[keyof typeof MoodLevel];

/** 1..5 → mood level (indexed; 1 = very low … 5 = great). */
const LEVEL_BY_MOOD: Record<number, MoodLevel> = {
  1: MoodLevel.VERY_LOW,
  2: MoodLevel.LOW,
  3: MoodLevel.OKAY,
  4: MoodLevel.GOOD,
  5: MoodLevel.GREAT,
};

export interface MoodMapping {
  level: MoodLevel;
  /** Stable machine code returned to the client (e.g. "COACHING_MOOD_GOOD"). */
  code: string;
  /** i18n key for the localized encouragement (e.g. "coaching.mood.GOOD"). */
  i18nKey: string;
}

/** Map a validated 1..5 mood to its rule-based encouragement metadata. */
export function mapMood(mood: number): MoodMapping {
  const level = LEVEL_BY_MOOD[mood] ?? MoodLevel.OKAY;
  return {
    level,
    code: `COACHING_MOOD_${level}`,
    i18nKey: `coaching.mood.${level}`,
  };
}
