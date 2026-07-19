/** Calendar day key (UTC) — pairs with backend "today" mood upsert. */
export function moodPromptDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const DEFERRED_KEY = "mentor_mood_prompt_deferred_date";

/** User dismissed auto-prompt or we already auto-opened today (soft mode). */
export function isMoodPromptDeferredToday(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DEFERRED_KEY) === moodPromptDayKey();
}

/** Snooze auto-prompt until tomorrow; manual hero tap still opens the wheel. */
export function deferMoodPromptForToday(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEFERRED_KEY, moodPromptDayKey());
}

export function shouldAutoPromptMood(hasMoodToday: boolean): boolean {
  return !hasMoodToday && !isMoodPromptDeferredToday();
}
